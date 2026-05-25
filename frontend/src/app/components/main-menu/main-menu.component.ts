import { Component, inject, computed } from '@angular/core';
import { GameStateService } from '../../services/game-state.service';
import { AuthService } from '../../services/auth.service';
import { AudioService } from '../../services/audio.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-main-menu',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex flex-col items-center justify-center w-full h-screen text-white pointer-events-none">
      
      <!-- Top Left Header (Currencies) -->
      <div class="absolute top-0 left-0 w-full p-6 flex justify-between items-start pointer-events-auto">
        <div class="flex items-center gap-4">
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
        <div class="flex items-center gap-4">
          <button (click)="openLeaderboard()" class="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full font-semibold transition backdrop-blur-md">
            Leaderboard
          </button>
          
          <button (click)="openProfile()" class="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full font-semibold transition backdrop-blur-md">
            {{ auth.currentUser() ? auth.currentUser()!.username : 'Sign In' }}
          </button>
          
          <button (click)="openShop()" class="transition hover:scale-110 active:scale-95">
            <img src="assets/shop_icon.png" alt="Shop" class="w-16 h-16 drop-shadow-xl" />
          </button>
        </div>
      </div>

      <!-- Center Content -->
      <div class="flex flex-col items-center gap-4 pointer-events-auto transform -translate-y-8">
        <h1 class="text-7xl md:text-9xl font-black tracking-tighter bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(255,100,0,0.5)] transition-all duration-500 bg-gradient-to-b"
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
              <span class="absolute -top-3 right-0 text-lg" title="Locked">🔒</span>
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
            {{ isWorldUnlocked() ? 'Click to Ascend' : 'Locked' }}
          </p>
        </button>
      </div>
      
       <!-- Audio Toggle -->
      <button (click)="toggleAudio()" class="absolute bottom-6 right-6 w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/50 hover:text-white transition pointer-events-auto">
         {{ audio.isMuted() ? '🔇' : '🔊' }}
      </button>

      <!-- Legacy User Policy Modal -->
      @if (auth.currentUser() && !auth.currentUser()?.acceptedLegalPolicies) {
         <div class="fixed inset-0 bg-black/95 flex flex-col items-center justify-center z-[200] px-4 backdrop-blur-md pointer-events-auto">
            <div class="w-full max-w-lg bg-red-900/20 border border-red-500/50 rounded-3xl p-8 flex flex-col items-center text-center shadow-[0_0_50px_rgba(255,0,0,0.2)]">
               <h2 class="text-3xl font-black text-white mb-4">Action Required</h2>
               <p class="text-white/80 mb-6">
                  We've updated our Terms of Service, Privacy Policy, and Refund Policy. 
                  You must accept these new policies to continue playing Phoenix Fall.
               </p>
               <div class="flex flex-col w-full gap-4">
                  <button (click)="acceptLegacyPolicies()" class="w-full py-4 bg-gradient-to-r from-orange-500 to-red-600 rounded-xl font-bold text-xl hover:brightness-110 active:scale-95 transition">
                     I Accept
                  </button>
                  <button (click)="deleteLegacyAccount()" class="w-full py-4 bg-black/50 border border-white/10 text-white/50 hover:bg-red-900/50 hover:text-white hover:border-red-500/50 rounded-xl font-bold transition">
                     Refuse & Delete Account
                  </button>
               </div>
            </div>
         </div>
      }
    </div>
  `
})
export class MainMenuComponent {
  gameState = inject(GameStateService);
  auth = inject(AuthService);
  audio = inject(AudioService);

  currentWorld = computed(() => this.gameState.worlds[this.gameState.selectedWorldIndex()]);
  isWorldUnlocked = computed(() => this.gameState.unlockedWorlds().includes(this.gameState.selectedWorldIndex()));

  nextWorld() {
    this.audio.playSFX('click');
    let idx = this.gameState.selectedWorldIndex() + 1;
    if (idx >= this.gameState.worlds.length) idx = 0;
    this.gameState.selectedWorldIndex.set(idx);
  }

  prevWorld() {
    this.audio.playSFX('click');
    let idx = this.gameState.selectedWorldIndex() - 1;
    if (idx < 0) idx = this.gameState.worlds.length - 1;
    this.gameState.selectedWorldIndex.set(idx);
  }

  openShop() {
    this.audio.playSFX('click');
    this.gameState.activeScreen.set('shop');
  }
  
  openProfile() {
    this.audio.playSFX('click');
    this.gameState.activeScreen.set('profile');
  }

  openLeaderboard() {
    this.audio.playSFX('click');
    this.gameState.activeScreen.set('leaderboard');
  }

  toggleAudio() {
    this.audio.toggleMute();
  }

  startGame() {
    if (this.isWorldUnlocked()) {
      this.audio.playSFX('shoot');
      this.gameState.startGame();
    } else {
      this.audio.playSFX('hit');
    }
  }

  acceptLegacyPolicies() {
    this.audio.playSFX('buy');
    this.auth.acceptPolicies().subscribe();
  }

  deleteLegacyAccount() {
    if (confirm('Are you absolutely sure you want to delete your account and all progress? This cannot be undone.')) {
        this.auth.deleteAccount().subscribe(() => {
            window.location.reload();
        });
    }
  }
}
