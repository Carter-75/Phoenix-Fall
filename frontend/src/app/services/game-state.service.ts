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
  burstDamage: 20, auraRadius: 150 
};

@Injectable({
  providedIn: 'root'
})
export class GameStateService {
  private audio = inject(AudioService);
  private auth = inject(AuthService);
  private http = inject(HttpClient);

  // Currency
  public coins = signal<number>(100); 
  public gems = signal<number>(0);

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
              coins: this.coins(),
              gems: this.gems(),
              unlockedWorlds: this.unlockedWorlds(),
              worldUpgrades: this.worldUpgrades()
          };
          if (!this.auth.currentUser() || this.auth.currentUser()?.isTemp) {
              localStorage.setItem('phoenix_guest_data', JSON.stringify(stateToSave));
          } else {
              // Could debounce sync to backend here if needed
          }
      });
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
          this.coins.set(user.coins !== undefined ? user.coins : 100);
          this.gems.set(user.gems || 0);
          this.unlockedWorlds.set(user.unlockedWorlds && user.unlockedWorlds.length > 0 ? user.unlockedWorlds : [0]);
          if (user.worldUpgrades && Object.keys(user.worldUpgrades).length > 0) {
              this.worldUpgrades.set(user.worldUpgrades);
          }
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
      return true;
    }
    return false;
  }

  public startGame() {
    this.activeScreen.set('game');
  }
}
