import { Component, inject, computed } from '@angular/core';
import { GameStateService } from '../../services/game-state.service';
import { AuthService } from '../../services/auth.service';
import { AudioService } from '../../services/audio.service';
import { CommonModule } from '@angular/common';
import { SettingsComponent } from '../settings/settings.component';

@Component({
  selector: 'app-main-menu',
  standalone: true,
  imports: [CommonModule, SettingsComponent],
  template: `
    <div class="flex flex-col items-center justify-center w-full h-screen text-white pointer-events-none">
      
      <!-- Top Left Header (Currencies) -->
      <div class="absolute top-0 left-0 w-full p-4 md:p-6 flex flex-col md:flex-row justify-between items-start gap-4 pointer-events-auto">
        <div class="flex items-center gap-2 md:gap-4 w-full md:w-auto justify-center md:justify-start">
          <!-- Coins -->
          <div class="flex items-center gap-2 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
            <img src="assets/coin_icon.png" alt="Coins" class="w-6 h-6 object-contain" />
            <span class="text-xl font-bold text-orange-400">{{ gameState.coins() }}</span>
          </div>
          <!-- Gems -->
          <div class="flex items-center gap-2 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
            <img src="assets/gem_icon.png" alt="Gems" class="w-6 h-6 object-contain" />
            <span class="text-xl font-bold text-purple-400">{{ gameState.gems() }}</span>
          </div>
        </div>
        
        <!-- Top Right Header (Navigation) -->
        <div class="flex flex-wrap items-center justify-center md:justify-end gap-2 md:gap-4 w-full md:w-auto">
          <button (click)="openCodex()" class="px-3 py-1.5 md:px-4 md:py-2 text-sm md:text-base bg-white/5 hover:bg-white/10 border border-white/10 rounded-full font-semibold transition backdrop-blur-md text-amber-400">
            Codex
          </button>
          
          <button (click)="openLeaderboard()" class="px-3 py-1.5 md:px-4 md:py-2 text-sm md:text-base bg-white/5 hover:bg-white/10 border border-white/10 rounded-full font-semibold transition backdrop-blur-md">
            Leaderboard
          </button>
          
          <button (click)="openProfile()" class="px-3 py-1.5 md:px-4 md:py-2 text-sm md:text-base bg-white/5 hover:bg-white/10 border border-white/10 rounded-full font-semibold transition backdrop-blur-md">
            {{ auth.currentUser() ? auth.currentUser()!.username : 'Sign In' }}
          </button>
          
          <button (click)="openShop()" class="transition hover:scale-110 active:scale-95">
            <img src="assets/shop_icon.png" alt="Shop" class="w-12 h-12 md:w-16 md:h-16 drop-shadow-xl" />
          </button>
        </div>
      </div>

      <!-- Center Content -->
      <div class="flex flex-col items-center gap-4 pointer-events-auto transform mt-24 md:-translate-y-8 md:mt-0">
        <h1 class="text-6xl md:text-9xl font-black tracking-tighter bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(255,100,0,0.5)] transition-all duration-500 bg-gradient-to-b text-center"
            [ngClass]="currentWorld().textColorClass">
          PHOENIX<br/>FALL
        </h1>
        
        <!-- World Selector -->
        <div class="flex items-center gap-6 mt-4 bg-black/40 backdrop-blur-md px-6 py-3 rounded-full border border-white/10">
          <button (click)="prevWorld()" class="text-white/50 hover:text-white transition text-2xl hover:-translate-x-1">&larr;</button>
          <div class="w-48 text-center flex flex-col items-center justify-center">
            <span class="text-sm text-white/50 uppercase tracking-widest font-bold">Realm {{ currentWorld().id + 1 }}</span>
            <span class="text-xl font-black tracking-wider transition-colors duration-300 text-transparent bg-clip-text bg-gradient-to-r"
                  [ngClass]="currentWorld().textColorClass">
              {{ currentWorld().name }}
            </span>
            @if (!isWorldUnlocked()) {
              <span class="absolute -top-3 -right-6 text-xs text-orange-400 font-bold uppercase tracking-widest animate-pulse border border-orange-500/30 bg-black/50 px-2 py-1 rounded-md">Soon</span>
            }
          </div>
          <button (click)="nextWorld()" class="text-white/50 hover:text-white transition text-2xl hover:translate-x-1">&rarr;</button>
        </div>
        
        <!-- Play Button -->
        <button (click)="startGame()" 
                class="relative group mt-8 transition-transform hover:scale-105 active:scale-95"
                [class.opacity-50]="!isWorldUnlocked()"
                [class.grayscale]="!isWorldUnlocked()">
          <div class="absolute inset-0 bg-white/20 rounded-full blur-2xl opacity-50 group-hover:opacity-80 transition-opacity"></div>
          <img src="assets/play_button.png" alt="Play" class="relative w-32 h-32 md:w-40 md:h-40 drop-shadow-2xl" />
          <p class="absolute -bottom-8 left-1/2 -translate-x-1/2 text-white/80 font-bold tracking-widest uppercase text-sm w-max">
            {{ isWorldUnlocked() ? 'Click to Ascend' : 'Coming Soon' }}
          </p>
        </button>
      </div>
      
      <!-- Settings Button -->
      <button (click)="showSettings = true" class="absolute bottom-6 right-6 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/50 hover:text-white font-bold transition pointer-events-auto">
         SETTINGS ⚙️
      </button>
      
      @if(showSettings) {
         <app-settings (close)="showSettings = false"></app-settings>
      }
    </div>
  `
})
export class MainMenuComponent {
  gameState = inject(GameStateService);
  auth = inject(AuthService);
  audio = inject(AudioService);

  currentWorld = computed(() => this.gameState.worlds[this.gameState.selectedWorldIndex()]);
  isWorldUnlocked = computed(() => this.gameState.selectedWorldIndex() === 0);
  
  showSettings = false;

  nextWorld() {
    let idx = this.gameState.selectedWorldIndex() + 1;
    if (idx >= this.gameState.worlds.length) idx = 0;
    this.gameState.selectedWorldIndex.set(idx);
  }

  prevWorld() {
    let idx = this.gameState.selectedWorldIndex() - 1;
    if (idx < 0) idx = this.gameState.worlds.length - 1;
    this.gameState.selectedWorldIndex.set(idx);
  }

  openShop() {
    this.gameState.activeScreen.set('shop');
  }
  
  openProfile() {
    if (!this.auth.currentUser() || this.auth.currentUser()?.isTemp) {
      this.gameState.activeScreen.set('login');
    } else {
      this.gameState.activeScreen.set('profile');
    }
  }

  openCodex() {
    this.gameState.activeScreen.set('codex');
  }

  openLeaderboard() {
    this.gameState.activeScreen.set('leaderboard');
  }



  startGame() {
    if (this.isWorldUnlocked()) {
      this.gameState.startGame();
    } else {
    }
  }
}
