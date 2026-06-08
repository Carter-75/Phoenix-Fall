import { Injectable, signal, computed, effect, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AudioService } from './audio.service';
import { AuthService } from './auth.service';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { App } from '@capacitor/app';

export interface AbilityData {
  level: number;
  modifiers: Record<string, number>;
}

export interface WorldStats {
  maxHealth: number;
  speed: number; // Flight speed/handling
  magnetism: number; // Item pickup range
  damage: number; // Auto-attack damage
  attackSpeed: number; // Auto-attack fire rate
  burstDamage: number; // Double tap damage
  auraRadius: number; // Hold still radius
  homingLevel: number; // Seeker upgrade
  attackRange: number; // How far projectiles fly
  unlockedAbilities: Record<string, AbilityData>;
  activeTapAbility: string | null;
  activeHoldAbility: string | null;
}

export interface PhysicsEntity {
  id: string;
  x: number; // 2D screen x
  y: number; // 2D screen y
  type: string;
  size: number;
  width?: number;
  height?: number;
  isLeft?: boolean;
}

export interface World {
  id: number;
  name: string;
  theme: string;
  textColorClass: string;
  isComingSoon?: boolean;
}

export const WORLDS: World[] = [
  { id: 0, name: 'Ember Wastes', theme: 'orange', textColorClass: 'from-orange-400 to-red-600' },
  { id: 1, name: 'Cerulean Depths', theme: 'blue', textColorClass: 'from-blue-400 to-cyan-600' },
  { id: 2, name: 'Amethyst Void', theme: 'purple', textColorClass: 'from-purple-400 to-fuchsia-600', isComingSoon: true },
  { id: 3, name: 'Verdant Canopy', theme: 'green', textColorClass: 'from-green-400 to-emerald-600', isComingSoon: true },
  { id: 4, name: 'Ashen Peaks', theme: 'gray', textColorClass: 'from-gray-300 to-gray-600', isComingSoon: true },
  { id: 5, name: 'Crystal Caverns', theme: 'cyan', textColorClass: 'from-cyan-300 to-blue-500', isComingSoon: true },
  { id: 6, name: 'Neon Nebula', theme: 'magenta', textColorClass: 'from-fuchsia-400 to-pink-600', isComingSoon: true },
  { id: 7, name: 'Golden Sands', theme: 'yellow', textColorClass: 'from-yellow-300 to-amber-600', isComingSoon: true },
  { id: 8, name: 'Blood Moon', theme: 'crimson', textColorClass: 'from-red-500 to-rose-800', isComingSoon: true },
  { id: 9, name: 'Abyssal Rift', theme: 'void', textColorClass: 'from-slate-700 to-black', isComingSoon: true },
];

export const ABILITIES: Record<string, { id: string, type: 'tap' | 'hold', name: string, desc: string, icon: string, unlockCost: number, upgradeCost: number }> = {
  'drill_attack': { id: 'drill_attack', type: 'tap', name: 'Drill Attack', desc: 'Spin dash through enemies', icon: '🌪️', unlockCost: 500, upgradeCost: 200 },
  'fire_breath': { id: 'fire_breath', type: 'tap', name: 'Fire Breath', desc: 'Continuous short-range flame', icon: '🔥', unlockCost: 500, upgradeCost: 200 },
  'burst': { id: 'burst', type: 'tap', name: 'Burst', desc: 'Explosive radial attack', icon: '💥', unlockCost: 0, upgradeCost: 350 },
  
  'phoenix_turret': { id: 'phoenix_turret', type: 'hold', name: 'Phoenix Turret', desc: 'Drop an egg that hatches a turret', icon: '🥚', unlockCost: 800, upgradeCost: 300 },
  'rebirth': { id: 'rebirth', type: 'hold', name: 'Rebirth (Passive)', desc: 'Revive upon death with shockwave', icon: '✨', unlockCost: 1000, upgradeCost: 500 },
  'aura': { id: 'aura', type: 'hold', name: 'Aura', desc: 'Continuous damage zone', icon: '🌀', unlockCost: 0, upgradeCost: 400 },
};

const DEFAULT_STATS: WorldStats = { 
  maxHealth: 100, speed: 1.0, magnetism: 1.0, damage: 10, attackSpeed: 1.0, 
  burstDamage: 20, auraRadius: 250, homingLevel: 0, attackRange: 400,
  unlockedAbilities: { 
    'burst': { level: 1, modifiers: { cooldown: 1.0, damage: 1.0, radius: 1.0 } }, 
    'aura': { level: 1, modifiers: { damage: 1.0, radius: 1.0 } } 
  }, 
  activeTapAbility: 'burst', activeHoldAbility: 'aura'
};

const ABILITY_UPGRADE_TARGETS: Record<string, { targetLevel: number, stats: Record<string, number> }> = {
  drill_attack: { targetLevel: 30, stats: { cooldown: 0.25, speed: 3.0, duration: 5.0 } },
  burst: { targetLevel: 30, stats: { cooldown: 0.25, damage: 5.0, radius: 3.0 } },
  phoenix_turret: { targetLevel: 30, stats: { cooldown: 0.5, duration: 3.0, damage: 3.0 } },
  fire_breath: { targetLevel: 30, stats: { cooldown: 0.25, damage: 5.0, range: 3.0, ammo: 3.0 } },
  aura: { targetLevel: 30, stats: { damage: 5.0, radius: 3.0 } },
  rebirth: { targetLevel: 30, stats: { cooldown: 0.25, damage: 5.0 } }
};

@Injectable({
  providedIn: 'root'
})
export class GameStateService {
  public audio = inject(AudioService);
  private auth = inject(AuthService);
  private http = inject(HttpClient);

  public isGuest = computed(() => !this.auth.currentUser() || this.auth.currentUser()?.isTemp);

  // Currency & Progress
  public level = signal<number>(0);
  public xp = signal<number>(0);
  public trophies = signal<string[]>([]);
  public coins = signal<number>(100); 
  public gems = signal<number>(0);
  public hasPurchasedGems = signal<boolean>(false);
  public upsellChance = signal<number>(1.0);
  public acceptedLegalPolicies = signal<boolean>(false);
  public unlockedEnemies = signal<string[]>([]);

  // Stats Tracking (Session only, for trophies)
  public sessionKills = signal<Record<string, number>>({});
  public sessionPlayTime = signal<number>(0);
  public heartsCollected = signal<number>(0);

  // Per-World Stats
  public worldUpgrades = signal<Record<number, WorldStats>>({
    0: { ...DEFAULT_STATS },
    1: { ...DEFAULT_STATS },
    2: { ...DEFAULT_STATS },
    3: { ...DEFAULT_STATS },
    4: { ...DEFAULT_STATS },
    5: { ...DEFAULT_STATS },
    6: { ...DEFAULT_STATS },
    7: { ...DEFAULT_STATS },
    8: { ...DEFAULT_STATS },
    9: { ...DEFAULT_STATS }
  });

  // UI State
  // Screens: 'menu' | 'game' | 'shop' | 'login' | 'profile' | 'leaderboard'
  public activeScreen = signal<'menu' | 'game' | 'shop' | 'login' | 'profile' | 'leaderboard' | 'codex'>('menu');
  public unlockedWorlds = signal<number[]>([0]); // IDs of unlocked worlds
  public selectedWorldIndex = signal<number>(0);
  public crazyDealTimer = signal<number>(0);
  public crazyDealExpiresAt = signal<number | null>(null);
  public coinMultiplier = signal<number>(1);
  public xpMultiplier = signal<number>(1);
  public hasCosmicTrail = signal<boolean>(false);
  public hasGoldenAura = signal<boolean>(false);
  public hasCelestialShield = signal<boolean>(false);
  
  public toggleCosmicTrail = signal<boolean>(true);
  public toggleGoldenAura = signal<boolean>(true);
  public toggleCelestialShield = signal<boolean>(true);

  constructor() {
      this.setupNotifications();
      const localData = localStorage.getItem('phoenix_guest_data');
      if (localData) {
          try {
              const parsed = JSON.parse(localData);
              this.level.set(parsed.level || 0);
              this.xp.set(parsed.xp || 0);
              this.trophies.set(parsed.trophies || []);
              const data = JSON.parse(localData);
              this.level.set(data.level || 0);
              this.xp.set(data.xp || 0);
              this.trophies.set(data.trophies || []);
              this.coins.set(Math.floor(data.coins !== undefined ? data.coins : 100));
              
              // Boot-up creep: Increase chance of popup by 10% each session
              if (data.gems !== undefined) this.gems.set(Math.floor(data.gems));
              if (data.hasPurchasedGems !== undefined) this.hasPurchasedGems.set(data.hasPurchasedGems);
              if (data.acceptedLegalPolicies !== undefined) this.acceptedLegalPolicies.set(data.acceptedLegalPolicies);
              if (data.upsellChance !== undefined) {
                  this.upsellChance.set(Math.min(1.0, data.upsellChance + 0.1));
              } else {
                  if (data.activeScreen) this.activeScreen.set(data.activeScreen);
                  if (data.unlockedWorlds) this.unlockedWorlds.set(data.unlockedWorlds);
                  if (data.selectedWorldIndex) this.selectedWorldIndex.set(data.selectedWorldIndex);
                  if (data.coinMultiplier) this.coinMultiplier.set(data.coinMultiplier);
                  if (data.xpMultiplier) this.xpMultiplier.set(data.xpMultiplier);
                  if (data.hasCosmicTrail !== undefined) this.hasCosmicTrail.set(data.hasCosmicTrail);
                  if (data.hasGoldenAura !== undefined) this.hasGoldenAura.set(data.hasGoldenAura);
                  if (data.hasCelestialShield !== undefined) this.hasCelestialShield.set(data.hasCelestialShield);
                  
                  if (data.toggleCosmicTrail !== undefined) this.toggleCosmicTrail.set(data.toggleCosmicTrail);
                  if (data.toggleGoldenAura !== undefined) this.toggleGoldenAura.set(data.toggleGoldenAura);
                  if (data.toggleCelestialShield !== undefined) this.toggleCelestialShield.set(data.toggleCelestialShield);

                  if (data.unlockedEnemies !== undefined) this.unlockedEnemies.set(data.unlockedEnemies);
                  if (data.crazyDealExpiresAt) {
                      this.crazyDealExpiresAt.set(data.crazyDealExpiresAt);
                  }
                  
                  // Restore world upgrades
                  if (data.worldUpgrades) {
                      Object.keys(data.worldUpgrades).forEach(key => {
                          const upgrades = data.worldUpgrades[key as unknown as number];
                          Object.keys(upgrades).forEach(statKey => {
                              if (statKey === 'unlockedAbilities') {
                                  const abilities = (upgrades as any)[statKey] as Record<string, any>;
                                  Object.keys(abilities).forEach(abKey => {
                                      const ability = abilities[abKey];
                                      if (ability && typeof ability.level === 'number' && !ability.modifiers) {
                                          ability.modifiers = {
                                              cooldown: 1.0, speed: 1.0, duration: 1.0, damage: 1.0, radius: 1.0, range: 1.0, ammo: 1.0
                                          };
                                      }
                                  });
                              } else if (typeof upgrades[statKey as keyof WorldStats] === 'number' && isNaN(upgrades[statKey as keyof WorldStats] as number)) {
                                  (upgrades as any)[statKey] = (DEFAULT_STATS as any)[statKey];
                              }
                          });
                      });
                  }
                  this.worldUpgrades.set(data.worldUpgrades);
              }
          } catch (e) {}
      }

      effect(() => {
          const screen = this.activeScreen();
          if (screen === 'menu' || screen === 'shop' || screen === 'login' || screen === 'profile' || screen === 'leaderboard' || screen === 'codex') {
              setTimeout(() => this.audio.playMenuBgm(), 0);
          } else if (screen === 'game') {
              setTimeout(() => this.audio.playWorldBgm(this.selectedWorldIndex()), 0);
          }
      });

      // Save guest state
      effect(() => {
          const stateToSave = {
              level: this.level(),
              xp: this.xp(),
              trophies: this.trophies(),
              coins: this.coins(),
              gems: this.gems(),
              hasPurchasedGems: this.hasPurchasedGems(),
              acceptedLegalPolicies: this.acceptedLegalPolicies(),
              upsellChance: this.upsellChance(),
              unlockedWorlds: this.unlockedWorlds(),
              worldUpgrades: this.worldUpgrades(),
              coinMultiplier: this.coinMultiplier(),
              xpMultiplier: this.xpMultiplier(),
              hasCosmicTrail: this.hasCosmicTrail(),
              hasGoldenAura: this.hasGoldenAura(),
              hasCelestialShield: this.hasCelestialShield(),
              toggleCosmicTrail: this.toggleCosmicTrail(),
              toggleGoldenAura: this.toggleGoldenAura(),
              toggleCelestialShield: this.toggleCelestialShield(),
              unlockedEnemies: this.unlockedEnemies(),
              crazyDealExpiresAt: this.crazyDealExpiresAt()
          };
          if (!this.auth.currentUser() || this.auth.currentUser()?.isTemp) {
              localStorage.setItem('phoenix_guest_data', JSON.stringify(stateToSave));
          }
      });
      
      // Global Trophy Trackers
      effect(() => {
          if (this.coins() >= 1000) this.awardTrophy("Wealthy");
          if (this.gems() >= 10) this.awardTrophy("Gem Hoarder");
      }, { allowSignalWrites: true });

      // Crazy Deal Timer Interval (Calculates remaining seconds from absolute expiry timestamp)
      setInterval(() => {
          const expiresAt = this.crazyDealExpiresAt();
          if (expiresAt) {
              const remaining = Math.floor((expiresAt - Date.now()) / 1000);
              if (remaining > 0) {
                  this.crazyDealTimer.set(remaining);
              } else {
                  this.crazyDealExpiresAt.set(null);
                  this.crazyDealTimer.set(0);
              }
          }
      }, 1000);

      // Web Push Check
      const params = new URLSearchParams(window.location.search);
      if (params.get('crazyDealExpiresAt')) {
          const expiresAt = parseInt(params.get('crazyDealExpiresAt') || '0', 10);
          this.triggerCrazyDeal(expiresAt);
          window.history.replaceState({}, document.title, window.location.pathname);
      }
  }

  public triggerCrazyDeal(expiresAt?: number) {
      if (expiresAt) {
          this.crazyDealExpiresAt.set(expiresAt);
      } else {
          // Fallback if no specific expiry was given: 5 Minutes (300 seconds) from now
          this.crazyDealExpiresAt.set(Date.now() + 1000 * 60 * 5);
      }
      this.activeScreen.set('shop');
  }

  async setupNotifications() {
      if (Capacitor.isNativePlatform()) {
          // Native Android/iOS Local Notifications
          const permStatus = await LocalNotifications.requestPermissions();
          if (permStatus.display === 'granted') {
              // Cancel existing
              await LocalNotifications.cancel({ notifications: [{ id: 1 }, { id: 2 }, { id: 3 }] });
              
              // Handle tap
              LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
                  if (action.notification.extra && action.notification.extra.crazyDealExpiresAt) {
                      this.triggerCrazyDeal(action.notification.extra.crazyDealExpiresAt);
                  }
              });

              // Schedule new reminders on backgrounding
              App.addListener('appStateChange', async ({ isActive }) => {
                  if (!isActive) {
                      this.audio.pauseAudioForAd();
                      const notificationsToSchedule: any[] = [
                          {
                              title: "We miss you!",
                              body: "Come back and defeat some enemies. Your Phoenix needs you!",
                              id: 1,
                              schedule: { at: new Date(Date.now() + 1000 * 60 * 60 * 24) } // 24 hours
                          },
                          {
                              title: "A Deal Awaits! 💎",
                              body: "A massive Gem deal is waiting for you in the shop.",
                              id: 2,
                              schedule: { at: new Date(Date.now() + 1000 * 60 * 60 * 48) } // 48 hours
                          }
                      ];

                      // 30% chance for crazy deal
                      if (Math.random() < 0.3) {
                          const triggerTime = Date.now() + 1000 * 60 * 60 * 72; // 72 hours from now
                          const expiryTime = triggerTime + 1000 * 60 * 5; // 5 minutes after trigger
                          
                          notificationsToSchedule.push({
                              title: "Hey! Don't miss this crazy once in a lifetime deal!",
                              body: "250 Gems for $9.99. Offer expires 5 minutes from this notification!",
                              id: 3,
                              schedule: { at: new Date(triggerTime) },
                              extra: { crazyDealExpiresAt: expiryTime }
                          });
                      }

                      await LocalNotifications.schedule({ notifications: notificationsToSchedule });
                  } else {
                      this.audio.resumeAudioAfterAd();
                      // Cancel when active
                      await LocalNotifications.cancel({ notifications: [{ id: 1 }, { id: 2 }, { id: 3 }] });
                  }
              });
          }
      } else if ('serviceWorker' in navigator && 'PushManager' in window) {
          // Web Push API
          try {
              const registration = await navigator.serviceWorker.register('/service-worker.js');
              
              const res = await firstValueFrom(this.http.get<any>(environment.apiUrl + '/notifications/vapidPublicKey'));
              const vapidPublicKey = res.publicKey;
              
              if (!vapidPublicKey) return;

              const permission = await Notification.requestPermission();
              if (permission !== 'granted') return;

              const subscription = await registration.pushManager.subscribe({
                  userVisibleOnly: true,
                  applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey)
              });

              if (this.auth.currentUser() && !this.auth.currentUser()?.isTemp) {
                  await firstValueFrom(this.http.post(environment.apiUrl + '/notifications/subscribe', subscription));
              }
          } catch (e) {
              console.log('Web Push error', e);
          }
      }
  }

  private urlBase64ToUint8Array(base64String: string) {
      const padding = '='.repeat((4 - base64String.length % 4) % 4);
      const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) {
          outputArray[i] = rawData.charCodeAt(i);
      }
      return outputArray;
  }

  // World State
  public worlds = WORLDS;

  // Computed helper for current world's stats, falling back to defaults for any newly added stats missing in local storage
  public currentStats = computed(() => {
      const stats = this.worldUpgrades()[this.selectedWorldIndex()];
      return { 
          ...DEFAULT_STATS, 
          ...stats,
          unlockedAbilities: { ...DEFAULT_STATS.unlockedAbilities, ...(stats?.unlockedAbilities || {}) }
      };
  });

  // Phoenix Automation State
  public phoenixOverridePosition = signal<{x: number, y: number} | null>(null);
  public phoenixScreenPos = signal<{x: number, y: number}>({x: 0, y: 0});
  public activeEntities = signal<PhysicsEntity[]>([]);
  public isPaused = signal<boolean>(false);
  public isDrilling = signal<boolean>(false);
  public isRebirthing = signal<boolean>(false);

  // Sync with DB User
  syncWithUser(user: any) {
      if (user) {
          this.level.set(user.level || 0);
          this.xp.set(user.xp || 0);
          this.trophies.set(user.trophies || []);
          this.coins.set(Math.floor(Number(user.coins !== undefined && user.coins !== null ? user.coins : 100)) || 100);
          this.gems.set(Math.floor(Number(user.gems)) || 0);
          if (user.acceptedLegalPolicies) this.acceptedLegalPolicies.set(true);
          this.unlockedWorlds.set(user.unlockedWorlds && user.unlockedWorlds.length > 0 ? user.unlockedWorlds : [0]);
          if (user.worldUpgrades && Object.keys(user.worldUpgrades).length > 0) {
              const upgrades = user.worldUpgrades;
              // Migration for old saves
              Object.keys(upgrades).forEach(key => {
                  if (!upgrades[key]) upgrades[key] = { ...DEFAULT_STATS };
                  if (upgrades[key].auraRadius < 250) upgrades[key].auraRadius = 250;
                  if (upgrades[key].attackRange === undefined) upgrades[key].attackRange = 400;
                  if (!upgrades[key].unlockedAbilities) upgrades[key].unlockedAbilities = {};
                  if (upgrades[key].activeTapAbility === undefined) upgrades[key].activeTapAbility = null;
                  if (upgrades[key].activeHoldAbility === undefined) upgrades[key].activeHoldAbility = null;
                  
              // Auto-heal NaN
                  Object.keys(upgrades[key]).forEach(statKey => {
                      if (statKey === 'unlockedAbilities') {
                          const abilities = upgrades[key][statKey] as Record<string, any>;
                          Object.keys(abilities).forEach(abKey => {
                              const ability = abilities[abKey];
                              if (ability && typeof ability.level === 'number' && !ability.modifiers) {
                                  // Migrate old format to AbilityData
                                  ability.modifiers = {
                                      cooldown: 1.0, speed: 1.0, duration: 1.0, damage: 1.0, radius: 1.0, range: 1.0, ammo: 1.0
                                  };
                              }
                          });
                      } else if (typeof upgrades[key][statKey] === 'number' && isNaN(upgrades[key][statKey])) {
                          upgrades[key][statKey] = (DEFAULT_STATS as any)[statKey];
                      }
                  });
              });
              this.worldUpgrades.set(upgrades);
          }
      }
  }

  // Dynamic Upgrade System
  public upgradeAbility(worldId: number, abilityId: string) {
      const abilityConfig = ABILITIES[abilityId];
      if (!abilityConfig) return;
      if (this.coins() < abilityConfig.upgradeCost) return;

      this.coins.set(this.coins() - abilityConfig.upgradeCost);

      const upgrades = { ...this.worldUpgrades() };
      const worldStats = upgrades[worldId];
      if (!worldStats.unlockedAbilities[abilityId]) {
          worldStats.unlockedAbilities[abilityId] = { level: 1, modifiers: { cooldown: 1.0, speed: 1.0, duration: 1.0, damage: 1.0, radius: 1.0, range: 1.0, ammo: 1.0 } };
      }

      const abilityData = worldStats.unlockedAbilities[abilityId];
      abilityData.level++;
      abilityData.modifiers = this.generateAbilityUpgrade(abilityId, abilityData.level, abilityData.modifiers);

      this.worldUpgrades.set(upgrades);
      this.audio.playSFX('heal'); // Level up sound
  }

  public generateAbilityUpgrade(abilityId: string, currentLevel: number, currentModifiers: Record<string, number>): Record<string, number> {
      const config = ABILITY_UPGRADE_TARGETS[abilityId] || { targetLevel: 30, stats: { cooldown: 0.25, damage: 5.0 } };
      const newModifiers = { ...currentModifiers };
      
      const stats = Object.keys(config.stats);
      if (stats.length === 0) return newModifiers;

      // Ensure stats exist
      for (const stat of stats) {
          if (newModifiers[stat] === undefined) newModifiers[stat] = 1.0;
      }

      const expectedProgress = currentLevel / config.targetLevel; 
      
      let weights = stats.map(stat => {
          const targetVal = config.stats[stat];
          const currentVal = newModifiers[stat];
          const isReduction = targetVal < 1.0; 
          
          let progress = 0;
          if (isReduction) {
              progress = (1.0 - currentVal) / (1.0 - targetVal);
          } else {
              progress = (currentVal - 1.0) / (targetVal - 1.0);
          }
          
          // The "Cone Idea": Heavily weight stats that fall behind
          let deficit = expectedProgress - progress;
          let weight = Math.max(0.01, 1.0 + (deficit * 10)); 
          return { stat, weight };
      });
      
      const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
      let rand = Math.random() * totalWeight;
      let chosenStat = stats[0];
      for (const w of weights) {
          rand -= w.weight;
          if (rand <= 0) {
              chosenStat = w.stat;
              break;
          }
      }
      
      // Apply buff
      const targetVal = config.stats[chosenStat];
      const isReduction = targetVal < 1.0;
      const totalDelta = Math.abs(targetVal - 1.0);
      const avgDeltaPerLevel = totalDelta / config.targetLevel;
      
      // Randomize between 0.5x and 1.5x of the average step
      const buffAmount = avgDeltaPerLevel * (0.5 + Math.random());
      
      if (isReduction) {
          newModifiers[chosenStat] = Math.max(0.05, newModifiers[chosenStat] - buffAmount);
      } else {
          newModifiers[chosenStat] += buffAmount;
      }
      
      return newModifiers;
  }

  // Helper for XP math
  public getXpRequiredForLevel(level: number): number {
      return Math.floor(100 * Math.pow(1.05, level));
  }

  public addXp(amount: number) {
      let currentXp = this.xp() + amount;
      let currentLevel = this.level();
      let leveledUp = false;
      
      while (true) {
          let req = this.getXpRequiredForLevel(currentLevel);
          if (currentXp >= req) {
              currentXp -= req;
              currentLevel++;
              leveledUp = true;
          } else {
              break;
          }
      }
      
      this.xp.set(currentXp);
      this.level.set(currentLevel);
      if (leveledUp) {
          this.audio.playSFX('heal'); // Level up sound placeholder
      }
  }

  public awardTrophy(name: string) {
      const current = this.trophies();
      if (!current.includes(name)) {
          this.trophies.set([...current, name]);
          // Simple visual notification
          const el = document.createElement('div');
          el.className = 'fixed bottom-4 right-4 bg-black/90 text-yellow-400 border border-yellow-500/30 px-5 py-2 rounded-xl font-bold shadow-[0_0_15px_rgba(255,200,0,0.15)] z-50 flex items-center gap-2 animate-fade-in transition-opacity duration-500';
          el.innerHTML = `<span class="text-2xl">🏆</span> <span>${name} Unlocked</span>`;
          document.body.appendChild(el);
          setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 500); }, 3000);
      }
  }

  public async syncProgressToServer() {
      if (!this.auth.currentUser() || this.auth.currentUser()?.isTemp) return;
      
      this.coins.update(c => Math.floor(c));
      this.gems.update(g => Math.floor(g));

      const payload = {
          level: this.level(),
          xp: this.xp(),
          trophies: this.trophies(),
          coins: this.coins(),
          gems: this.gems(),
          unlockedWorlds: this.unlockedWorlds(),
          worldUpgrades: this.worldUpgrades(),
          hasPurchasedGems: this.hasPurchasedGems(),
          acceptedLegalPolicies: this.acceptedLegalPolicies(),
          upsellChance: this.upsellChance(),
          coinMultiplier: this.coinMultiplier(),
          xpMultiplier: this.xpMultiplier(),
          hasCosmicTrail: this.hasCosmicTrail(),
          hasGoldenAura: this.hasGoldenAura(),
          hasCelestialShield: this.hasCelestialShield(),
          toggleCosmicTrail: this.toggleCosmicTrail(),
          toggleGoldenAura: this.toggleGoldenAura(),
          toggleCelestialShield: this.toggleCelestialShield(),
          unlockedEnemies: this.unlockedEnemies(),
          crazyDealExpiresAt: this.crazyDealExpiresAt()
      };
      
      try {
          await firstValueFrom(this.http.post(environment.apiUrl + '/auth/sync', payload));
      } catch (e) {
          console.error("Failed to sync progress", e);
      }
  }

  async migrateGuestData() {
      const localData = localStorage.getItem('phoenix_guest_data');
      if (!localData) return;
      
      try {
          const parsed = JSON.parse(localData);
          await firstValueFrom(this.http.post(environment.apiUrl + '/auth/sync', parsed));
          localStorage.removeItem('phoenix_guest_data');
      } catch (e) {
          console.error("Failed to migrate guest data", e);
      }
  }

  // Upgrades
  public purchaseUpgrade(type: keyof WorldStats, cost: number, amount: number) {
    if (this.coins() >= cost) {
      this.coins.update(c => c - cost);
      
      this.worldUpgrades.update(upgrades => {
        const currentWorldId = this.selectedWorldIndex();
        const currentWorldStats = upgrades[currentWorldId];
        let currentVal = currentWorldStats[type] as number;
        if (currentVal === undefined || isNaN(currentVal)) {
            currentVal = DEFAULT_STATS[type] as number;
        }
        
        return {
          ...upgrades,
          [currentWorldId]: {
            ...currentWorldStats,
            [type]: currentVal + amount
          }
        };
      });
      this.awardTrophy("Upgraded");
      return true;
    }
    return false;
  }

  public startGame() {
    this.activeScreen.set('game');
  }
}
