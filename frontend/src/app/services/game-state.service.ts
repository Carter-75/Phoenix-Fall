import { Injectable, signal, computed, effect, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AudioService } from './audio.service';
import { AuthService } from './auth.service';

export interface WorldStats {
  maxHealth: number;
  speed: number; // Flight speed/handling
  magnetism: number; // Item pickup range
  damage: number; // Auto-attack damage
  attackSpeed: number; // Auto-attack fire rate
  burstDamage: number; // Double tap damage
  auraRadius: number; // Hold still radius
  homingLevel: number; // Seeker upgrade
}

export interface PhysicsEntity {
  id: string;
  x: number; // 2D screen x
  y: number; // 2D screen y
  type: string;
  size: number;
}

export interface World {
  id: number;
  name: string;
  theme: string;
  textColorClass: string;
}

export const WORLDS: World[] = [
  { id: 0, name: 'Ember Wastes', theme: 'orange', textColorClass: 'from-orange-400 to-red-600' },
  { id: 1, name: 'Cerulean Depths', theme: 'blue', textColorClass: 'from-blue-400 to-cyan-600' },
  { id: 2, name: 'Amethyst Void', theme: 'purple', textColorClass: 'from-purple-400 to-fuchsia-600' },
  { id: 3, name: 'Verdant Canopy', theme: 'green', textColorClass: 'from-green-400 to-emerald-600' },
  { id: 4, name: 'Ashen Peaks', theme: 'gray', textColorClass: 'from-gray-300 to-gray-600' },
  { id: 5, name: 'Crystal Caverns', theme: 'cyan', textColorClass: 'from-cyan-300 to-blue-500' },
  { id: 6, name: 'Neon Nebula', theme: 'magenta', textColorClass: 'from-fuchsia-400 to-pink-600' },
  { id: 7, name: 'Golden Sands', theme: 'yellow', textColorClass: 'from-yellow-300 to-amber-600' },
  { id: 8, name: 'Blood Moon', theme: 'crimson', textColorClass: 'from-red-500 to-rose-800' },
  { id: 9, name: 'Abyssal Rift', theme: 'void', textColorClass: 'from-slate-700 to-black' },
];

const DEFAULT_STATS: WorldStats = { 
  maxHealth: 100, speed: 1.0, magnetism: 1.0, damage: 10, attackSpeed: 1.0, 
  burstDamage: 20, auraRadius: 250, homingLevel: 0
};

@Injectable({
  providedIn: 'root'
})
export class GameStateService {
  private audio = inject(AudioService);
  private auth = inject(AuthService);
  private http = inject(HttpClient);

  // Currency & Progress
  public level = signal<number>(0);
  public xp = signal<number>(0);
  public trophies = signal<string[]>([]);
  public coins = signal<number>(100); 
  public gems = signal<number>(0);

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
  public activeScreen = signal<'menu' | 'game' | 'shop' | 'login' | 'profile' | 'leaderboard'>('menu');
  public unlockedWorlds = signal<number[]>([0]); // IDs of unlocked worlds
  public selectedWorldIndex = signal<number>(0);

  constructor() {
      // Load initial state from local storage if guest
      const localData = localStorage.getItem('phoenix_guest_data');
      if (localData) {
          try {
              const parsed = JSON.parse(localData);
              this.level.set(parsed.level || 0);
              this.xp.set(parsed.xp || 0);
              this.trophies.set(parsed.trophies || []);
              this.coins.set(parsed.coins !== undefined ? parsed.coins : 100);
              this.gems.set(parsed.gems || 0);
              this.unlockedWorlds.set(parsed.unlockedWorlds || [0]);
              if (parsed.worldUpgrades) this.worldUpgrades.set(parsed.worldUpgrades);
          } catch (e) {}
      }

      effect(() => {
          const screen = this.activeScreen();
          if (screen === 'menu' || screen === 'shop' || screen === 'login' || screen === 'profile' || screen === 'leaderboard') {
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
              unlockedWorlds: this.unlockedWorlds(),
              worldUpgrades: this.worldUpgrades()
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
  }

  // World State
  public worlds = WORLDS;

  // Computed helper for current world's stats
  public currentStats = computed(() => this.worldUpgrades()[this.selectedWorldIndex()]);

  // Phoenix Automation State
  public phoenixOverridePosition = signal<{x: number, y: number} | null>(null);
  public phoenixScreenPos = signal<{x: number, y: number}>({x: 0, y: 0});
  public activeEntities = signal<PhysicsEntity[]>([]);
  public isPaused = signal<boolean>(false);

  // Sync with DB User
  syncWithUser(user: any) {
      if (user) {
          this.level.set(user.level || 0);
          this.xp.set(user.xp || 0);
          this.trophies.set(user.trophies || []);
          this.coins.set(user.coins !== undefined ? user.coins : 100);
          this.gems.set(user.gems || 0);
          this.unlockedWorlds.set(user.unlockedWorlds && user.unlockedWorlds.length > 0 ? user.unlockedWorlds : [0]);
          if (user.worldUpgrades && Object.keys(user.worldUpgrades).length > 0) {
              this.worldUpgrades.set(user.worldUpgrades);
          }
      }
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
      
      const payload = {
          level: this.level(),
          xp: this.xp(),
          trophies: this.trophies(),
          coins: this.coins(),
          gems: this.gems(),
          unlockedWorlds: this.unlockedWorlds(),
          worldUpgrades: this.worldUpgrades()
      };
      
      try {
          await firstValueFrom(this.http.post('/api/auth/sync', payload));
      } catch (e) {
          console.error("Failed to sync progress", e);
      }
  }

  async migrateGuestData() {
      const localData = localStorage.getItem('phoenix_guest_data');
      if (!localData) return;
      
      try {
          const parsed = JSON.parse(localData);
          await firstValueFrom(this.http.post('/api/auth/sync', parsed));
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
        return {
          ...upgrades,
          [currentWorldId]: {
            ...currentWorldStats,
            [type]: currentWorldStats[type] + amount
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
