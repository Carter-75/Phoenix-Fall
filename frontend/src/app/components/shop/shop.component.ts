import { Component, signal, computed } from '@angular/core';
import { GameStateService, ABILITIES } from '../../services/game-state.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-shop',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed inset-0 flex flex-col items-center justify-start w-full min-h-screen text-white bg-black/80 backdrop-blur-md p-6 overflow-y-auto">
      <!-- Header -->
      <div class="w-full max-w-5xl flex justify-between items-center mb-8 mt-4">
        <button (click)="closeShop()" class="text-white/70 hover:text-white flex items-center gap-2 transition px-4 py-2 bg-white/5 rounded-full border border-white/10 hover:bg-white/10">
          <span class="text-xl">&larr;</span> Back
        </button>
        
        <!-- Current World Badge -->
        <div class="hidden md:flex flex-col items-center">
          <span class="text-xs uppercase tracking-widest text-white/50">Upgrading Realm</span>
          <span class="font-bold text-lg" [ngClass]="currentWorld().textColorClass">{{ currentWorld().name }}</span>
        </div>

        <div class="flex gap-4">
          <div class="flex items-center gap-2 bg-black/60 px-4 py-2 rounded-full border border-white/10 shadow-[0_0_15px_rgba(255,100,0,0.2)]">
            <img src="assets/coin_icon.png" alt="Coins" class="w-6 h-6 object-contain" />
            <span class="text-xl font-bold text-orange-400">{{ gameState.coins() }}</span>
          </div>
          <div class="flex items-center gap-2 bg-black/60 px-4 py-2 rounded-full border border-white/10 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
            <img src="assets/gem_icon.png" alt="Gems" class="w-6 h-6 object-contain" />
            <span class="text-xl font-bold text-purple-400">{{ gameState.gems() }}</span>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="w-full max-w-lg flex bg-black/40 border border-white/10 rounded-full p-1 mb-8">
        <button (click)="activeTab.set('passives')" 
                [class.bg-white_10]="activeTab() === 'passives'"
                [class.text-orange-400]="activeTab() === 'passives'"
                class="flex-1 py-3 rounded-full font-bold transition-all"
                [ngClass]="activeTab() === 'passives' ? 'bg-white/10 text-orange-400 shadow-md' : 'text-white/50 hover:text-white'">
          Passives
        </button>
        <button (click)="activeTab.set('abilities')" 
                [class.bg-white_10]="activeTab() === 'abilities'"
                [class.text-cyan-400]="activeTab() === 'abilities'"
                class="flex-1 py-3 rounded-full font-bold transition-all"
                [ngClass]="activeTab() === 'abilities' ? 'bg-white/10 text-cyan-400 shadow-md' : 'text-white/50 hover:text-white'">
          Abilities
        </button>
        <button (click)="activeTab.set('gems')" 
                [class.bg-white_10]="activeTab() === 'gems'"
                [class.text-purple-400]="activeTab() === 'gems'"
                class="flex-1 py-3 rounded-full font-bold transition-all flex justify-center items-center gap-2"
                [ngClass]="activeTab() === 'gems' ? 'bg-white/10 text-purple-400 shadow-md' : 'text-white/50 hover:text-white'">
          Premium
        </button>
      </div>

      <!-- Passives Tab -->
      @if (activeTab() === 'passives') {
        <div class="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in pb-12">
          
          <!-- Max Health Upgrade -->
          <div class="bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col items-center gap-4 hover:bg-white/10 transition shadow-lg shadow-black/50">
            <div class="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center border border-red-500/30">
              <span class="text-4xl">❤️</span>
            </div>
            <div class="text-center">
              <h3 class="text-2xl font-bold text-white">Vitality</h3>
              <p class="text-white/50 text-sm">Increase Max Health</p>
              <p class="text-red-400 font-mono mt-1">Lvl {{ (gameState.currentStats().maxHealth - 100) / 10 }}</p>
            </div>
            <button (click)="buyHealth()" class="mt-4 w-full py-3 bg-gradient-to-r from-orange-600 to-red-600 rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition disabled:opacity-50 disabled:grayscale" [disabled]="gameState.coins() < 100">
              <img src="assets/coin_icon.png" class="w-5 h-5"/> 100
            </button>
          </div>

          <!-- Speed Upgrade -->
          <div class="bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col items-center gap-4 hover:bg-white/10 transition shadow-lg shadow-black/50">
            <div class="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center border border-blue-500/30">
              <span class="text-4xl">⚡</span>
            </div>
            <div class="text-center">
              <h3 class="text-2xl font-bold text-white">Agility</h3>
              <p class="text-white/50 text-sm">Increase Flight Speed</p>
              <p class="text-blue-400 font-mono mt-1">Lvl {{ ((gameState.currentStats().speed - 1) * 10).toFixed(0) }}</p>
            </div>
            <button (click)="buySpeed()" class="mt-4 w-full py-3 bg-gradient-to-r from-orange-600 to-red-600 rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition disabled:opacity-50 disabled:grayscale" [disabled]="gameState.coins() < 150">
              <img src="assets/coin_icon.png" class="w-5 h-5"/> 150
            </button>
          </div>

          <!-- Magnetism Upgrade -->
          <div class="bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col items-center gap-4 hover:bg-white/10 transition shadow-lg shadow-black/50">
            <div class="w-20 h-20 bg-purple-500/20 rounded-full flex items-center justify-center border border-purple-500/30">
              <span class="text-4xl">🧲</span>
            </div>
            <div class="text-center">
              <h3 class="text-2xl font-bold text-white">Magnetism</h3>
              <p class="text-white/50 text-sm">Attract more coins</p>
              <p class="text-purple-400 font-mono mt-1">Lvl {{ ((gameState.currentStats().magnetism - 1) * 10).toFixed(0) }}</p>
            </div>
            <button (click)="buyMagnet()" class="mt-4 w-full py-3 bg-gradient-to-r from-orange-600 to-red-600 rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition disabled:opacity-50 disabled:grayscale" [disabled]="gameState.coins() < 200">
              <img src="assets/coin_icon.png" class="w-5 h-5"/> 200
            </button>
          </div>

          <!-- Damage Upgrade -->
          <div class="bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col items-center gap-4 hover:bg-white/10 transition shadow-lg shadow-black/50">
            <div class="w-20 h-20 bg-orange-500/20 rounded-full flex items-center justify-center border border-orange-500/30">
              <span class="text-4xl">🔥</span>
            </div>
            <div class="text-center">
              <h3 class="text-2xl font-bold text-white">Firepower</h3>
              <p class="text-white/50 text-sm">Increase Damage</p>
              <p class="text-orange-400 font-mono mt-1">Lvl {{ gameState.currentStats().damage - 10 }}</p>
            </div>
            <button (click)="buyDamage()" class="mt-4 w-full py-3 bg-gradient-to-r from-orange-600 to-red-600 rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition disabled:opacity-50 disabled:grayscale" [disabled]="gameState.coins() < 250">
              <img src="assets/coin_icon.png" class="w-5 h-5"/> 250
            </button>
          </div>

          <!-- Attack Speed Upgrade -->
          <div class="bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col items-center gap-4 hover:bg-white/10 transition shadow-lg shadow-black/50">
            <div class="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center border border-green-500/30">
              <span class="text-4xl">🏹</span>
            </div>
            <div class="text-center">
              <h3 class="text-2xl font-bold text-white">Rapid Fire</h3>
              <p class="text-white/50 text-sm">Increase Attack Speed</p>
              <p class="text-green-400 font-mono mt-1">Lvl {{ ((gameState.currentStats().attackSpeed - 1) * 10).toFixed(0) }}</p>
            </div>
            <button (click)="buyAttackSpeed()" class="mt-4 w-full py-3 bg-gradient-to-r from-orange-600 to-red-600 rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition disabled:opacity-50 disabled:grayscale" [disabled]="gameState.coins() < 300">
              <img src="assets/coin_icon.png" class="w-5 h-5"/> 300
            </button>
          </div>

          <!-- Attack Range Upgrade -->
          <div class="bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col items-center gap-4 hover:bg-white/10 transition shadow-lg shadow-black/50">
            <div class="w-20 h-20 bg-teal-500/20 rounded-full flex items-center justify-center border border-teal-500/30">
              <span class="text-4xl">🔭</span>
            </div>
            <div class="text-center">
              <h3 class="text-2xl font-bold text-white">Reach</h3>
              <p class="text-white/50 text-sm">Increase Attack Range</p>
              <p class="text-teal-400 font-mono mt-1">Lvl {{ (gameState.currentStats().attackRange - 400) / 50 }}</p>
            </div>
            <button (click)="buyAttackRange()" class="mt-4 w-full py-3 bg-gradient-to-r from-orange-600 to-red-600 rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition disabled:opacity-50 disabled:grayscale" [disabled]="gameState.coins() < 250">
              <img src="assets/coin_icon.png" class="w-5 h-5"/> 250
            </button>
          </div>

          <!-- Aura Radius Upgrade -->
          <div class="bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col items-center gap-4 hover:bg-white/10 transition shadow-lg shadow-black/50">
            <div class="w-20 h-20 bg-cyan-500/20 rounded-full flex items-center justify-center border border-cyan-500/30">
              <span class="text-4xl">🌀</span>
            </div>
            <div class="text-center">
              <h3 class="text-2xl font-bold text-white">Aura (Hold)</h3>
              <p class="text-white/50 text-sm">Increase Aura Radius</p>
              <p class="text-cyan-400 font-mono mt-1">Lvl {{ (gameState.currentStats().auraRadius - 250) / 10 }}</p>
            </div>
            <button (click)="buyAuraRadius()" class="mt-4 w-full py-3 bg-gradient-to-r from-orange-600 to-red-600 rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition disabled:opacity-50 disabled:grayscale" [disabled]="gameState.coins() < 400">
              <img src="assets/coin_icon.png" class="w-5 h-5"/> 400
            </button>
          </div>

          <!-- Homing Bullets Upgrade -->
          <div class="bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col items-center gap-4 hover:bg-white/10 transition shadow-lg shadow-black/50">
            <div class="w-20 h-20 bg-indigo-500/20 rounded-full flex items-center justify-center border border-indigo-500/30">
              <span class="text-4xl">🎯</span>
            </div>
            <div class="text-center">
              <h3 class="text-2xl font-bold text-white">Seeker</h3>
              <p class="text-white/50 text-sm">Homing Bullets</p>
              <p class="text-indigo-400 font-mono mt-1">Lvl {{ gameState.currentStats().homingLevel }}</p>
            </div>
            <button (click)="buyHoming()" class="mt-4 w-full py-3 bg-gradient-to-r from-orange-600 to-red-600 rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition disabled:opacity-50 disabled:grayscale" [disabled]="gameState.coins() < 300">
              <img src="assets/coin_icon.png" class="w-5 h-5"/> 300
            </button>
          </div>

          <!-- Currency Exchange -->
          <div class="col-span-full md:col-span-2 lg:col-span-3 xl:col-span-4 bg-white/5 border border-purple-500/30 rounded-3xl p-6 mt-4 flex flex-col items-center gap-4 hover:bg-white/10 transition shadow-[0_0_20px_rgba(168,85,247,0.15)] relative overflow-hidden">
            <div class="absolute inset-0 bg-gradient-to-r from-purple-900/20 to-transparent"></div>
            <div class="flex flex-col md:flex-row items-center justify-between w-full relative z-10 gap-6">
               <div class="flex items-center gap-4">
                  <div class="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center border border-purple-500/50 shrink-0">
                    <img src="assets/gem_icon.png" class="w-10 h-10 drop-shadow-[0_0_10px_rgba(168,85,247,1)]"/>
                  </div>
                  <div>
                    <h3 class="text-2xl font-bold text-white">Alchemist's Exchange</h3>
                    <p class="text-white/50 text-sm">Convert your rare Gems into Coins instantly.</p>
                  </div>
               </div>
               <div class="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
                  <div class="text-right">
                    <p class="text-white font-bold text-xl flex items-center gap-2 justify-end">
                       -1 <img src="assets/gem_icon.png" class="w-5 h-5"/>
                    </p>
                    <p class="text-orange-400 font-bold text-xl flex items-center gap-2 justify-end mt-1">
                       +1000 <img src="assets/coin_icon.png" class="w-5 h-5"/>
                    </p>
                  </div>
                  <button (click)="exchangeGem()" class="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-bold text-xl hover:brightness-110 active:scale-95 transition disabled:opacity-50 disabled:grayscale shrink-0" [disabled]="gameState.gems() < 1">
                    Exchange
                  </button>
               </div>
            </div>
          </div>

        </div>
      }

      <!-- Abilities Tab -->
      @if (activeTab() === 'abilities') {
         <div class="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 animate-fade-in pb-12">
            @for (ability of abilitiesList; track ability.id) {
               <div class="bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col hover:bg-white/10 transition shadow-lg relative">
                  <!-- Equipped Badge -->
                  @if (gameState.currentStats().activeTapAbility === ability.id || gameState.currentStats().activeHoldAbility === ability.id) {
                     <div class="absolute -top-3 right-4 bg-cyan-500 text-black px-3 py-1 rounded-full text-xs font-bold uppercase shadow-lg">Equipped</div>
                  }
                  <div class="flex items-center gap-4 mb-4">
                     <div class="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20 shrink-0 text-3xl">
                        {{ ability.icon }}
                     </div>
                     <div>
                        <h3 class="text-xl font-bold text-white flex items-center gap-2">
                           {{ ability.name }}
                           <span class="text-xs bg-white/20 px-2 py-0.5 rounded text-white/70 uppercase">{{ ability.type }}</span>
                        </h3>
                        <p class="text-white/50 text-sm mt-1">{{ ability.desc }}</p>
                     </div>
                  </div>
                  
                  <div class="mt-auto pt-4 border-t border-white/10 flex items-center gap-4">
                     @if (!gameState.currentStats().unlockedAbilities[ability.id]) {
                        <!-- Locked -->
                        <button (click)="unlockAbility(ability.id, ability.unlockCost)" class="flex-1 py-3 bg-gradient-to-r from-orange-600 to-red-600 rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition disabled:opacity-50" [disabled]="gameState.coins() < ability.unlockCost">
                           Unlock <img src="assets/coin_icon.png" class="w-5 h-5"/> {{ ability.unlockCost }}
                        </button>
                     } @else {
                        <!-- Unlocked -->
                        <div class="flex flex-col w-full gap-2">
                           <div class="flex items-center justify-between">
                              <span class="text-cyan-400 font-mono text-sm">Level {{ gameState.currentStats().unlockedAbilities[ability.id].level }}</span>
                           </div>
                           <div class="flex gap-2">
                              <button (click)="equipAbility(ability.id, ability.type)" class="flex-1 py-2 bg-white/10 border border-white/20 rounded-xl font-bold text-white hover:bg-white/20 transition">
                                 Equip
                              </button>
                              <button (click)="upgradeAbility(ability.id, ability.upgradeCost)" class="flex-1 py-2 bg-gradient-to-r from-orange-600 to-red-600 rounded-xl font-bold text-white flex items-center justify-center gap-2 hover:brightness-110 transition disabled:opacity-50" [disabled]="gameState.coins() < ability.upgradeCost">
                                 Upgrade <img src="assets/coin_icon.png" class="w-4 h-4"/> {{ ability.upgradeCost }}
                              </button>
                           </div>
                        </div>
                     }
                  </div>
               </div>
            }
         </div>
      }

      <!-- Gems Tab -->
      @if (activeTab() === 'gems') {
        <div class="w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
          
          <!-- Package 1 -->
          <div class="bg-white/5 border border-purple-500/20 rounded-3xl p-6 flex flex-col items-center gap-4 hover:bg-white/10 transition shadow-[0_0_20px_rgba(168,85,247,0.1)] hover:shadow-[0_0_30px_rgba(168,85,247,0.2)]">
            <img src="assets/gem_icon.png" class="w-24 h-24 object-contain drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]" />
            <div class="text-center">
              <h3 class="text-2xl font-bold text-white">Single Gem</h3>
              <p class="text-purple-400 font-bold text-xl mt-1">1 Gem</p>
            </div>
            <button (click)="buyGems(1, 4.99)" class="mt-4 w-full py-3 bg-white/10 border border-purple-500/50 rounded-xl font-bold text-lg text-white hover:bg-purple-600/50 hover:border-purple-500 active:scale-95 transition">
              $4.99
            </button>
          </div>

          <!-- Package 2 (Best Value) -->
          <div class="relative bg-gradient-to-b from-purple-900/40 to-black/40 border border-purple-500/50 rounded-3xl p-6 flex flex-col items-center gap-4 hover:brightness-110 transition shadow-[0_0_30px_rgba(168,85,247,0.3)] transform md:-translate-y-2 mt-4 md:mt-0">
            <div class="absolute -top-3 bg-purple-500 text-white px-4 py-1 rounded-full text-sm font-bold tracking-widest uppercase shadow-lg">Most Popular</div>
            <img src="assets/gem_icon.png" class="w-32 h-32 object-contain drop-shadow-[0_0_25px_rgba(168,85,247,0.8)] mt-2" />
            <div class="text-center">
              <h3 class="text-2xl font-bold text-white">Handful of Gems</h3>
              <p class="text-purple-400 font-bold text-xl mt-1">10 Gems</p>
            </div>
            <button (click)="buyGems(10, 44.99)" class="mt-4 w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl font-bold text-lg text-white hover:brightness-110 active:scale-95 transition shadow-lg shadow-purple-500/30">
              $44.99
            </button>
          </div>

          <!-- Package 3 -->
          <div class="bg-white/5 border border-purple-500/20 rounded-3xl p-6 flex flex-col items-center gap-4 hover:bg-white/10 transition shadow-[0_0_20px_rgba(168,85,247,0.1)] hover:shadow-[0_0_30px_rgba(168,85,247,0.2)]">
            <img src="assets/gem_icon.png" class="w-24 h-24 object-contain drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]" />
            <div class="text-center">
              <h3 class="text-2xl font-bold text-white">Chest of Gems</h3>
              <p class="text-purple-400 font-bold text-xl mt-1">25 Gems</p>
            </div>
            <button (click)="buyGems(25, 99.99)" class="mt-4 w-full py-3 bg-white/10 border border-purple-500/50 rounded-xl font-bold text-lg text-white hover:bg-purple-600/50 hover:border-purple-500 active:scale-95 transition">
              $99.99
            </button>
          </div>

        </div>
      }
      <!-- Payment Processing Modal -->
      @if (isProcessingPayment()) {
        <div class="fixed inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center z-50">
           <div class="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4"></div>
           <h3 class="text-2xl font-bold text-white mb-2">Processing Payment...</h3>
           <p class="text-white/50">Contacting Google Play / Payment Provider</p>
        </div>
      }
    </div>
  `,
  styles: [`
    .animate-fade-in {
      animation: fadeIn 0.3s ease-out;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class ShopComponent {
  activeTab = signal<'passives' | 'abilities' | 'gems'>('passives');
  isProcessingPayment = signal<boolean>(false);
  currentWorld = computed(() => this.gameState.worlds[this.gameState.selectedWorldIndex()]);

  constructor(public gameState: GameStateService) {}

  get abilitiesList() { return Object.values(ABILITIES); }

  closeShop() {
    this.gameState.activeScreen.set('menu');
  }

  unlockAbility(id: string, cost: number) {
     if (this.gameState.coins() >= cost) {
         this.gameState.coins.update(c => c - cost);
         this.gameState.worldUpgrades.update(upgrades => {
             const worldId = this.gameState.selectedWorldIndex();
             const stats = upgrades[worldId];
             return { ...upgrades, [worldId]: { ...stats, unlockedAbilities: { ...stats.unlockedAbilities, [id]: { level: 1 } } } };
         });
         this.gameState.awardTrophy("Ability Unlocked");
     }
  }

  upgradeAbility(id: string, cost: number) {
     if (this.gameState.coins() >= cost) {
         this.gameState.coins.update(c => c - cost);
         this.gameState.worldUpgrades.update(upgrades => {
             const worldId = this.gameState.selectedWorldIndex();
             const stats = upgrades[worldId];
             const currentLvl = stats.unlockedAbilities[id]?.level || 1;
             return { ...upgrades, [worldId]: { ...stats, unlockedAbilities: { ...stats.unlockedAbilities, [id]: { level: currentLvl + 1 } } } };
         });
     }
  }

  equipAbility(id: string, type: 'tap' | 'hold') {
      this.gameState.worldUpgrades.update(upgrades => {
          const worldId = this.gameState.selectedWorldIndex();
          const stats = upgrades[worldId];
          return {
              ...upgrades,
              [worldId]: {
                  ...stats,
                  activeTapAbility: type === 'tap' ? id : stats.activeTapAbility,
                  activeHoldAbility: type === 'hold' ? id : stats.activeHoldAbility
              }
          };
      });
  }

  buyHealth() { this.gameState.purchaseUpgrade('maxHealth', 100, 10); }
  buySpeed() { this.gameState.purchaseUpgrade('speed', 150, 0.1); }
  buyMagnet() { this.gameState.purchaseUpgrade('magnetism', 200, 0.1); }
  buyDamage() { this.gameState.purchaseUpgrade('damage', 250, 1); }
  buyAttackSpeed() { this.gameState.purchaseUpgrade('attackSpeed', 300, 0.1); }
  buyAttackRange() { this.gameState.purchaseUpgrade('attackRange', 250, 50); }
  buyHoming() { this.gameState.purchaseUpgrade('homingLevel', 300, 1); }

  exchangeGem() {
    if (this.gameState.gems() >= 1) {
      this.gameState.gems.update(g => g - 1);
      this.gameState.coins.update(c => c + 1000);
    }
  }

  buyGems(amount: number, price: number) {
    // Stub for Google Play Billing / Web Payments
    console.log(`Initiating payment intent for $${price} to buy ${amount} Gems...`);
    this.isProcessingPayment.set(true);

    // TODO: Integrate actual @capacitor/google-play-billing or Stripe here
    setTimeout(() => {
        this.gameState.gems.update(g => g + amount);
        this.isProcessingPayment.set(false);
        console.log(`Successfully purchased ${amount} Gems!`);
    }, 1500); // Simulate network delay
  }
}
