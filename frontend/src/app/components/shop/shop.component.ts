import { Component, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { GameStateService, ABILITIES, WorldStats } from '../../services/game-state.service';
import { CommonModule } from '@angular/common';

export interface ActiveDeal {
  name: string;
  type: 'holiday' | 'ghost' | 'clearance' | 'none';
  priceMultiplier: number;
  gemMultiplier: number;
  bannerColor: string;
}


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

      <!-- Dynamic Deals Banners -->
      @if (activeTab() === 'gems') {
         <!-- Active Deal Banner -->
         @if (activeDeal().type !== 'none') {
            <div class="w-full max-w-4xl bg-gradient-to-r {{ activeDeal().bannerColor }} rounded-xl p-4 mb-4 flex justify-between items-center shadow-lg animate-pulse border border-white/50">
               <div>
                  <h3 class="font-black text-white text-2xl uppercase tracking-wider">{{ activeDeal().name }}</h3>
                  <p class="text-white/80 font-bold">Special pricing event is live!</p>
               </div>
            </div>
         } @else {
            <!-- Deal Radar -->
            <div class="w-full max-w-4xl bg-white/5 rounded-xl p-4 mb-4 flex justify-between items-center shadow-lg border border-white/10">
               <div>
                  <h3 class="font-bold text-white text-lg">Deal Radar 📡</h3>
                  <p class="text-white/60 text-sm">Next major sale in {{ dealRadarDays() }} days.</p>
               </div>
               <div class="bg-black/50 px-4 py-2 rounded-lg font-bold text-cyan-300">
                  Forecast: {{ dealRadarHype() }}
               </div>
            </div>
         }

         <!-- Ghost Deal Banner -->
         @if (ghostDealActive()) {
            <div class="w-full max-w-4xl bg-gradient-to-r from-fuchsia-600 to-purple-800 rounded-xl p-4 mb-4 flex justify-between items-center shadow-[0_0_30px_rgba(200,0,255,0.6)] animate-bounce border border-pink-400">
               <div>
                  <h3 class="font-black text-white text-xl uppercase tracking-wider">👻 GHOST DEAL TRIGGERED 👻</h3>
                  <p class="text-white/90 font-bold">3X GEMS ON ALL PACKAGES!</p>
               </div>
               <div class="bg-black/50 px-4 py-2 rounded-lg font-mono text-xl font-bold text-pink-300">
                  {{ formatTime(ghostDealTimer()) }}
               </div>
            </div>
         }

        <!-- Original Flash Sale Banner -->
        <div class="w-full max-w-4xl bg-gradient-to-r from-red-600 to-orange-600 rounded-xl p-4 mb-6 flex justify-between items-center shadow-lg shadow-red-500/50 border border-yellow-400">
          <div class="flex items-center gap-3">
             <span class="text-3xl">🔥</span>
             <div>
                <h3 class="font-black text-white text-xl uppercase tracking-wider">Flash Sale</h3>
                <p class="text-white/80 text-sm font-bold">First Time Purchase 2x Bonus Active!</p>
             </div>
          </div>
          <div class="bg-black/50 px-4 py-2 rounded-lg font-mono text-xl font-bold text-yellow-300">
             {{ formatTime(flashSaleTimer()) }}
          </div>
        </div>
      }

      <!-- Tabs -->
      <div class="w-full max-w-lg flex bg-black/40 border border-white/10 rounded-full p-1 mb-8">
        <button (click)="setTab('passives')" 
                [class.bg-white_10]="activeTab() === 'passives'"
                [class.text-orange-400]="activeTab() === 'passives'"
                class="flex-1 py-3 rounded-full font-bold transition-all"
                [ngClass]="activeTab() === 'passives' ? 'bg-white/10 text-orange-400 shadow-md' : 'text-white/50 hover:text-white'">
          Passives
        </button>
        <button (click)="setTab('abilities')" 
                [class.bg-white_10]="activeTab() === 'abilities'"
                [class.text-cyan-400]="activeTab() === 'abilities'"
                class="flex-1 py-3 rounded-full font-bold transition-all"
                [ngClass]="activeTab() === 'abilities' ? 'bg-white/10 text-cyan-400 shadow-md' : 'text-white/50 hover:text-white'">
          Abilities
        </button>
        <button (click)="setTab('gems')" 
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
            <button (click)="buyHealth()" class="mt-4 w-full py-3 bg-gradient-to-r from-orange-600 to-red-600 rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition disabled:opacity-50 disabled:grayscale" [disabled]="gameState.coins() < getCost('maxHealth', 100, 10, 100)">
              <img src="assets/coin_icon.png" class="w-5 h-5"/> {{ getCost('maxHealth', 100, 10, 100) }}
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
            <button (click)="buySpeed()" class="mt-4 w-full py-3 bg-gradient-to-r from-orange-600 to-red-600 rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition disabled:opacity-50 disabled:grayscale" [disabled]="gameState.coins() < getCost('speed', 150, 0.1, 1)">
              <img src="assets/coin_icon.png" class="w-5 h-5"/> {{ getCost('speed', 150, 0.1, 1) }}
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
            <button (click)="buyMagnet()" class="mt-4 w-full py-3 bg-gradient-to-r from-orange-600 to-red-600 rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition disabled:opacity-50 disabled:grayscale" [disabled]="gameState.coins() < getCost('magnetism', 200, 0.1, 1)">
              <img src="assets/coin_icon.png" class="w-5 h-5"/> {{ getCost('magnetism', 200, 0.1, 1) }}
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
            <button (click)="buyDamage()" class="mt-4 w-full py-3 bg-gradient-to-r from-orange-600 to-red-600 rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition disabled:opacity-50 disabled:grayscale" [disabled]="gameState.coins() < getCost('damage', 250, 1, 10)">
              <img src="assets/coin_icon.png" class="w-5 h-5"/> {{ getCost('damage', 250, 1, 10) }}
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
            <button (click)="buyAttackSpeed()" class="mt-4 w-full py-3 bg-gradient-to-r from-orange-600 to-red-600 rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition disabled:opacity-50 disabled:grayscale" [disabled]="gameState.coins() < getCost('attackSpeed', 300, 0.1, 1)">
              <img src="assets/coin_icon.png" class="w-5 h-5"/> {{ getCost('attackSpeed', 300, 0.1, 1) }}
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
            <button (click)="buyAttackRange()" class="mt-4 w-full py-3 bg-gradient-to-r from-orange-600 to-red-600 rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition disabled:opacity-50 disabled:grayscale" [disabled]="gameState.coins() < getCost('attackRange', 250, 50, 400)">
              <img src="assets/coin_icon.png" class="w-5 h-5"/> {{ getCost('attackRange', 250, 50, 400) }}
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
            <button (click)="buyAuraRadius()" class="mt-4 w-full py-3 bg-gradient-to-r from-orange-600 to-red-600 rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition disabled:opacity-50 disabled:grayscale" [disabled]="gameState.coins() < getCost('auraRadius', 400, 10, 250)">
              <img src="assets/coin_icon.png" class="w-5 h-5"/> {{ getCost('auraRadius', 400, 10, 250) }}
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
            <button (click)="buyHoming()" class="mt-4 w-full py-3 bg-gradient-to-r from-orange-600 to-red-600 rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition disabled:opacity-50 disabled:grayscale" [disabled]="gameState.coins() < getCost('homingLevel', 300, 1, 0)">
              <img src="assets/coin_icon.png" class="w-5 h-5"/> {{ getCost('homingLevel', 300, 1, 0) }}
            </button>
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
                              <button (click)="upgradeAbility(ability.id, getAbilityCost(ability.id, ability.upgradeCost))" class="flex-1 py-2 bg-gradient-to-r from-orange-600 to-red-600 rounded-xl font-bold text-white flex items-center justify-center gap-2 hover:brightness-110 transition disabled:opacity-50" [disabled]="gameState.coins() < getAbilityCost(ability.id, ability.upgradeCost)">
                                 Upgrade <img src="assets/coin_icon.png" class="w-4 h-4"/> {{ getAbilityCost(ability.id, ability.upgradeCost) }}
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
          <div class="bg-white/5 border border-purple-500/20 rounded-3xl p-6 flex flex-col items-center gap-4 hover:bg-white/10 transition shadow-[0_0_20px_rgba(168,85,247,0.1)] hover:shadow-[0_0_30px_rgba(168,85,247,0.2)] relative overflow-hidden">
            @if (!gameState.hasPurchasedGems()) {
                <div class="absolute top-4 -right-8 bg-red-600 text-white text-xs font-bold py-1 px-10 rotate-45 shadow-lg">2X BONUS</div>
            }
            <img src="assets/gem_icon.png" class="w-24 h-24 object-contain drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]" />
            <div class="text-center">
              <h3 class="text-2xl font-bold text-white">Single Gem</h3>
              <p class="text-purple-400 font-bold text-xl mt-1">{{ calculatedGems()[0] }} Gem</p>
            </div>
            <button (click)="buyGems(calculatedGems()[0], calculatedPrices()[0])" class="mt-4 w-full py-3 bg-white/10 border border-purple-500/50 rounded-xl font-bold text-lg text-white hover:bg-purple-600/50 hover:border-purple-500 active:scale-95 transition flex justify-center gap-2">
              @if (crossedOutPrices().length) {
                <span class="line-through text-white/50">&dollar;{{ crossedOutPrices()[0] }}</span>
              }
              &dollar;{{ calculatedPrices()[0] }}
            </button>
          </div>

          <!-- Package 2 (Best Value) -->
          <div class="relative bg-gradient-to-b from-purple-900/40 to-black/40 border border-purple-500/50 rounded-3xl p-6 flex flex-col items-center gap-4 hover:brightness-110 transition shadow-[0_0_30px_rgba(168,85,247,0.3)] transform md:-translate-y-2 mt-4 md:mt-0 overflow-hidden">
            <div class="absolute -top-3 bg-purple-500 text-white px-4 py-1 rounded-full text-sm font-bold tracking-widest uppercase shadow-lg z-10">Most Popular</div>
            @if (!gameState.hasPurchasedGems()) {
                <div class="absolute top-4 -right-8 bg-red-600 text-white text-xs font-bold py-1 px-10 rotate-45 shadow-lg z-10">2X BONUS</div>
            }
            <img src="assets/gem_icon.png" class="w-32 h-32 object-contain drop-shadow-[0_0_25px_rgba(168,85,247,0.8)] mt-2" />
            <div class="text-center">
              <h3 class="text-2xl font-bold text-white">Handful of Gems</h3>
              <p class="text-purple-400 font-bold text-xl mt-1">{{ calculatedGems()[1] }} Gems</p>
            </div>
            <button (click)="buyGems(calculatedGems()[1], calculatedPrices()[1])" class="mt-4 w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl font-bold text-lg text-white hover:brightness-110 active:scale-95 transition shadow-lg shadow-purple-500/30 flex justify-center gap-2">
              @if (crossedOutPrices().length) {
                <span class="line-through text-white/50">&dollar;{{ crossedOutPrices()[1] }}</span>
              }
              &dollar;{{ calculatedPrices()[1] }}
            </button>
          </div>

          <!-- Package 3 -->
          <div class="bg-white/5 border border-purple-500/20 rounded-3xl p-6 flex flex-col items-center gap-4 hover:bg-white/10 transition shadow-[0_0_20px_rgba(168,85,247,0.1)] hover:shadow-[0_0_30px_rgba(168,85,247,0.2)] relative overflow-hidden">
            @if (!gameState.hasPurchasedGems()) {
                <div class="absolute top-4 -right-8 bg-red-600 text-white text-xs font-bold py-1 px-10 rotate-45 shadow-lg z-10">2X BONUS</div>
            }
            <img src="assets/gem_icon.png" class="w-24 h-24 object-contain drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]" />
            <div class="text-center">
              <h3 class="text-2xl font-bold text-white">Chest of Gems</h3>
              <p class="text-purple-400 font-bold text-xl mt-1">{{ calculatedGems()[2] }} Gems</p>
            </div>
            <button (click)="buyGems(calculatedGems()[2], calculatedPrices()[2])" class="mt-4 w-full py-3 bg-white/10 border border-purple-500/50 rounded-xl font-bold text-lg text-white hover:bg-purple-600/50 hover:border-purple-500 active:scale-95 transition flex justify-center gap-2">
              @if (crossedOutPrices().length) {
                <span class="line-through text-white/50">&dollar;{{ crossedOutPrices()[2] }}</span>
              }
              &dollar;{{ calculatedPrices()[2] }}
            </button>
          </div>

          <!-- Currency Exchange -->
          <div class="col-span-full md:col-span-3 bg-white/5 border border-purple-500/30 rounded-3xl p-6 mt-4 flex flex-col items-center gap-4 hover:bg-white/10 transition shadow-[0_0_20px_rgba(168,85,247,0.15)] relative overflow-hidden">
            <div class="absolute inset-0 bg-gradient-to-r from-purple-900/20 to-transparent"></div>
            <div class="flex flex-col md:flex-row items-center justify-between w-full relative z-10 gap-6">
               <div class="flex items-center gap-4">
                  <div class="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center border border-purple-500/50 shrink-0">
                    <img src="assets/gem_icon.png" class="w-10 h-10 drop-shadow-[0_0_10px_rgba(168,85,247,1)]" [class.animate-spin]="isGachaSpinning()"/>
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
                       +850 <img src="assets/coin_icon.png" class="w-5 h-5"/>
                    </p>
                  </div>
                  <button (click)="exchangeGem()" class="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-bold text-xl hover:brightness-110 active:scale-95 transition disabled:opacity-50 disabled:grayscale shrink-0 relative overflow-hidden group" [disabled]="gameState.gems() < 1 || isGachaSpinning()">
                    <span class="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform"></span>
                    Exchange
                  </button>
               </div>
            </div>
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
      <!-- Whale Trap Modal -->
      @if (showWhaleTrap()) {
         <div class="fixed inset-0 bg-black/95 flex flex-col items-center justify-center z-[100] px-4 backdrop-blur-md">
            <div class="w-full max-w-md bg-gradient-to-b from-purple-900 to-black border-2 border-fuchsia-500 rounded-3xl p-8 flex flex-col items-center text-center shadow-[0_0_100px_rgba(200,0,255,0.6)] animate-bounce relative overflow-hidden">
               <div class="absolute top-0 w-full bg-red-600 text-white font-black uppercase tracking-widest py-1 text-sm">Do Not Close This Window</div>
               
               <h2 class="text-4xl font-black text-white mt-6 drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]">WAIT!</h2>
               <h3 class="text-2xl font-bold text-fuchsia-400 mt-2">ONE-TIME SECRET OFFER</h3>
               
               <img src="assets/gem_icon.png" class="w-40 h-40 my-6 drop-shadow-[0_0_30px_rgba(200,0,255,0.8)]" />
               
               <p class="text-white text-lg font-bold">Since you just purchased Gems, you've unlocked this exclusive package!</p>
               <div class="my-6 bg-black/50 border border-fuchsia-500/50 p-4 rounded-xl w-full">
                  <p class="text-4xl font-black text-fuchsia-400">50 GEMS</p>
                  <p class="text-white/50 line-through mt-1">Usually $49.99</p>
               </div>
               
               <button (click)="buyWhaleTrap()" class="w-full py-4 bg-gradient-to-r from-fuchsia-600 to-purple-600 rounded-xl font-black text-2xl text-white hover:brightness-125 active:scale-95 transition shadow-lg shadow-fuchsia-500/50">
                 Claim for $4.99
               </button>
               
               <button (click)="declineWhaleTrap()" class="mt-6 text-white/30 text-sm hover:text-white/50 transition border-b border-transparent hover:border-white/50">
                 No thanks, I hate great deals
               </button>
            </div>
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
export class ShopComponent implements OnInit, OnDestroy {
  activeTab = signal<'passives' | 'abilities' | 'gems'>('passives');
  isProcessingPayment = signal<boolean>(false);
  isGachaSpinning = signal<boolean>(false);
  flashSaleTimer = signal<number>(14 * 60 + 59); 
  currentWorld = computed(() => this.gameState.worlds[this.gameState.selectedWorldIndex()]);
  private timerInterval: any;
  private ghostInterval: any;

  // Whale Trap State
  showWhaleTrap = signal<boolean>(false);

  // Dynamic Pricing State
  basePrices = [1.99, 9.99, 49.99];
  baseGems = [1, 12, 30];
  
  activeDeal = signal<ActiveDeal>({ name: 'None', type: 'none', priceMultiplier: 1, gemMultiplier: 1, bannerColor: '' });
  dealRadarDays = signal<number>(0);
  dealRadarHype = signal<string>('');
  
  ghostDealActive = signal<boolean>(false);
  ghostDealTimer = signal<number>(0);

  calculatedPrices = computed(() => this.basePrices.map(p => +(p * this.activeDeal().priceMultiplier).toFixed(2)));
  
  calculatedGems = computed(() => {
     return this.baseGems.map(g => {
         let mult = this.activeDeal().gemMultiplier;
         if (this.ghostDealActive()) mult *= 3; // Ghost deal is 3x gems
         let amt = Math.floor(g * mult);
         if (!this.gameState.hasPurchasedGems()) amt *= 2;
         return amt;
     });
  });
  
  crossedOutPrices = computed(() => {
     if (this.activeDeal().type === 'holiday') {
         return this.basePrices.map(p => +(p * 1.7).toFixed(2)); // Fake 70% inflation
     }
     return [];
  });

  constructor(public gameState: GameStateService) {}

  setTab(tab: 'passives' | 'abilities' | 'gems') {
      this.activeTab.set(tab);
      localStorage.setItem('phoenix_shop_last_tab', tab);
  }

  ngOnInit() {
      const savedTab = localStorage.getItem('phoenix_shop_last_tab');
      if (savedTab === 'passives' || savedTab === 'abilities' || savedTab === 'gems') {
          this.activeTab.set(savedTab);
      } else {
          this.activeTab.set('gems');
          localStorage.setItem('phoenix_shop_last_tab', 'gems');
      }
      
      this.evaluatePricing();
      
      this.timerInterval = setInterval(() => {
          this.flashSaleTimer.update(t => t > 0 ? t - 1 : 14 * 60 + 59);
          
          if (this.ghostDealActive()) {
              this.ghostDealTimer.update(t => t - 1);
              if (this.ghostDealTimer() <= 0) this.ghostDealActive.set(false);
          }
      }, 1000);

      this.ghostInterval = setInterval(() => {
          if (!this.ghostDealActive() && Math.random() < 0.1) {
              this.ghostDealActive.set(true);
              this.ghostDealTimer.set(10 * 60); 
          }
      }, 1000 * 60); 
  }

  ngOnDestroy() { 
      clearInterval(this.timerInterval); 
      clearInterval(this.ghostInterval);
  }

  private evaluatePricing() {
    const today = new Date();
    const currentYear = today.getFullYear();
    
    const holidays = [
        { name: 'Valentine\'s Day', date: new Date(currentYear, 1, 14), color: 'from-pink-600 to-rose-600' },
        { name: 'Summer Bash', date: new Date(currentYear, 6, 4), color: 'from-blue-400 to-cyan-500' },
        { name: 'Halloween', date: new Date(currentYear, 9, 31), color: 'from-orange-600 to-purple-800' },
        { name: 'Black Friday', date: new Date(currentYear, 10, 28), color: 'from-gray-900 to-black' },
        { name: 'Christmas', date: new Date(currentYear, 11, 25), color: 'from-green-600 to-red-600' },
    ];
    
    let closestHoliday = holidays[0];
    let minDiff = Infinity;
    for (const h of holidays) {
        const hDate = new Date(h.date);
        if (hDate < today && (today.getTime() - hDate.getTime()) > 3 * 24 * 60 * 60 * 1000) {
             hDate.setFullYear(currentYear + 1); // Only push to next year if clearance is over
        }
        const diff = hDate.getTime() - today.getTime();
        if (diff >= 0 && diff < minDiff) {
            minDiff = diff;
            closestHoliday = h;
        }
    }
    
    const daysUntil = Math.ceil(minDiff / (1000 * 60 * 60 * 24));
    this.dealRadarDays.set(daysUntil);
    if (daysUntil > 20) this.dealRadarHype.set('🔴🔴⚪⚪⚪ (Low Hype)');
    else if (daysUntil > 7) this.dealRadarHype.set('🔴🔴🟢⚪⚪ (Good Hype)');
    else this.dealRadarHype.set('🔴🔴🟢🟢🟢 (Amazing Hype)');

    let deal: ActiveDeal = { name: 'None', type: 'none', priceMultiplier: 1, gemMultiplier: 1, bannerColor: '' };
    
    for (const h of holidays) {
        const checkDate = new Date(h.date);
        if (checkDate.getFullYear() > currentYear && today.getMonth() !== 0) {
            checkDate.setFullYear(currentYear);
        }
        
        const diffDays = Math.round((today.getTime() - checkDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDays >= -14 && diffDays <= -1) {
            const inflation = 1 + (15 - Math.abs(diffDays)) * 0.05; 
            deal = { name: `Pre-${h.name} Peak`, type: 'none', priceMultiplier: inflation, gemMultiplier: 1, bannerColor: '' };
        } else if (diffDays === 0) {
            deal = { name: `${h.name} Mega Sale!`, type: 'holiday', priceMultiplier: 1, gemMultiplier: 1.15, bannerColor: h.color };
        } else if (diffDays >= 1 && diffDays <= 3) {
            deal = { name: `${h.name} Inventory Clearance!`, type: 'clearance', priceMultiplier: 1, gemMultiplier: 2.5, bannerColor: 'from-red-600 to-orange-600' };
        }
    }
    
    this.activeDeal.set(deal);
  }

  formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  get abilitiesList() { return Object.values(ABILITIES); }

  closeShop() {
    this.gameState.audio.playSFX('click');
    this.gameState.syncProgressToServer(); // Instantly save any purchased upgrades to backend
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

  getCost(stat: keyof WorldStats, baseCost: number, step: number, offset: number): number {
     const currentVal = this.gameState.currentStats()[stat] as number;
     const level = Math.max(0, (currentVal - offset) / step);
     return Math.floor(baseCost * Math.pow(1.5, level));
  }

  getAbilityCost(id: string, baseCost: number): number {
     const level = this.gameState.currentStats().unlockedAbilities[id]?.level || 1;
     return Math.floor(baseCost * Math.pow(1.5, level - 1));
  }

  buyHealth() { this.gameState.purchaseUpgrade('maxHealth', this.getCost('maxHealth', 100, 10, 100), 10); }
  buySpeed() { this.gameState.purchaseUpgrade('speed', this.getCost('speed', 150, 0.1, 1), 0.1); }
  buyMagnet() { this.gameState.purchaseUpgrade('magnetism', this.getCost('magnetism', 200, 0.1, 1), 0.1); }
  buyDamage() { this.gameState.purchaseUpgrade('damage', this.getCost('damage', 250, 1, 10), 1); }
  buyAttackSpeed() { this.gameState.purchaseUpgrade('attackSpeed', this.getCost('attackSpeed', 300, 0.1, 1), 0.1); }
  buyAttackRange() { this.gameState.purchaseUpgrade('attackRange', this.getCost('attackRange', 250, 50, 400), 50); }
  buyAuraRadius() { this.gameState.purchaseUpgrade('auraRadius', this.getCost('auraRadius', 400, 10, 250), 10); }
  buyHoming() { this.gameState.purchaseUpgrade('homingLevel', this.getCost('homingLevel', 300, 1, 0), 1); }

  exchangeGem() {
    if (this.gameState.gems() >= 1 && !this.isGachaSpinning()) {
      this.isGachaSpinning.set(true);
      this.gameState.gems.update(g => g - 1);
      
      let spins = 0;
      const spinInterval = setInterval(() => {
          spins++;
          if (spins > 10) {
              clearInterval(spinInterval);
              this.gameState.coins.update(c => c + 850);
              this.isGachaSpinning.set(false);
          }
      }, 100);
    }
  }

  buyGems(amount: number, price: number) {
    console.log(`Initiating payment intent for $${price} to buy ${amount} Gems...`);
    this.isProcessingPayment.set(true);

    setTimeout(() => {
        const finalAmount = this.gameState.hasPurchasedGems() ? amount : amount * 2;
        this.gameState.gems.update(g => g + finalAmount);
        this.gameState.hasPurchasedGems.set(true);
        this.isProcessingPayment.set(false);
        console.log(`Successfully purchased ${finalAmount} Gems!`);
        
        // Whale Trap Logic
        if (!this.showWhaleTrap() && Math.random() < this.gameState.upsellChance()) {
            this.showWhaleTrap.set(true);
        } else {
            this.gameState.upsellChance.set(0); // Reset if they already saw it or it didn't trigger
        }
    }, 1500); 
  }

  buyWhaleTrap() {
    console.log(`Initiating payment intent for $4.99 to buy 50 Gems...`);
    this.isProcessingPayment.set(true);
    setTimeout(() => {
        this.gameState.gems.update(g => g + 50);
        this.isProcessingPayment.set(false);
        this.showWhaleTrap.set(false);
        this.gameState.upsellChance.set(0);
    }, 1500);
  }

  declineWhaleTrap() {
    this.showWhaleTrap.set(false);
    this.gameState.upsellChance.set(0);
  }
}
