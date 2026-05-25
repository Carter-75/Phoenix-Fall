import { Component, inject } from '@angular/core';
import { GameStateService } from '../../services/game-state.service';
import { AuthService } from '../../services/auth.service';
import { AudioService } from '../../services/audio.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed inset-0 flex flex-col items-center p-8 z-50 overflow-y-auto">
      <button (click)="goBack()" class="absolute top-6 left-6 text-white/50 hover:text-white transition flex items-center gap-2">
        <span class="text-2xl">←</span> Back
      </button>

      <div class="bg-black/60 backdrop-blur-xl border border-white/10 rounded-3xl p-8 w-full max-w-2xl mt-12 shadow-[0_0_50px_rgba(255,100,0,0.1)]">
        
        @if (auth.currentUser()) {
          <div class="flex items-center gap-6 mb-12">
            <div class="w-24 h-24 rounded-full bg-gradient-to-tr from-orange-500 to-purple-600 flex items-center justify-center text-4xl font-black shadow-[0_0_30px_rgba(255,100,0,0.5)]">
              {{ auth.currentUser()!.username.charAt(0).toUpperCase() }}
            </div>
            <div>
              <h2 class="text-4xl font-black text-white">{{ auth.currentUser()!.username }}</h2>
              <div class="text-orange-400 font-bold text-xl mt-1">Level {{ auth.currentUser()!.level }}</div>
              <div class="text-white/50 text-sm mt-1">{{ auth.currentUser()!.xp }} / {{ gameState.getXpRequiredForLevel(auth.currentUser()!.level) }} XP</div>
              <div class="w-64 h-3 bg-white/10 rounded-full mt-2 overflow-hidden border border-white/10">
                <div class="h-full bg-gradient-to-r from-orange-500 to-red-500" [style.width.%]="(auth.currentUser()!.xp / gameState.getXpRequiredForLevel(auth.currentUser()!.level)) * 100"></div>
              </div>
            </div>
            
            <button (click)="logout()" class="ml-auto px-4 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/40 rounded-lg transition font-bold border border-red-500/20">
              Logout
            </button>
          </div>
          
          <h3 class="text-2xl font-bold text-white mb-6">Trophies</h3>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
             @if (gameState.trophies().length === 0) {
                 <div class="col-span-full text-white/40 text-center py-8">No trophies yet. Keep playing!</div>
             }
             @for (trophy of gameState.trophies(); track trophy) {
                 <div class="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col items-center justify-center text-center">
                    <span class="text-4xl mb-2">🏆</span>
                    <span class="text-white font-bold">{{ trophy }}</span>
                 </div>
             }
          </div>
          
        } @else {
          <div class="text-center py-12 border-b border-white/10 mb-8">
            <h2 class="text-2xl text-white font-bold mb-4">You are not logged in</h2>
            <button (click)="goToLogin()" class="px-8 py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold rounded-xl hover:brightness-110 transition">
              Login or Register
            </button>
          </div>
        }

        <!-- Settings Section (Always Visible) -->
        <div class="mt-8">
          <h3 class="text-2xl font-bold text-white mb-6 flex items-center gap-2"><span class="text-3xl">⚙️</span> Settings</h3>
          <div class="flex flex-col gap-4">
              <div class="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
                <div class="flex flex-col">
                   <span class="text-white font-bold text-lg">Game Audio</span>
                   <span class="text-white/50 text-sm">Toggle all sound effects and music</span>
                </div>
                <button (click)="toggleAudio()" class="w-16 h-8 rounded-full transition-colors relative"
                        [ngClass]="audio.isMuted() ? 'bg-gray-600' : 'bg-orange-500'">
                   <div class="absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-md"
                        [ngClass]="audio.isMuted() ? 'left-1' : 'left-9'"></div>
                </button>
              </div>
              
              <div class="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
                <div class="flex flex-col">
                   <span class="text-white font-bold text-lg">Legal & Policies</span>
                   <span class="text-white/50 text-sm">Review our TOS, Privacy, and Refund policies</span>
                </div>
                <button (click)="openPolicies()" class="px-6 py-2 bg-cyan-500/20 text-cyan-400 border border-cyan-500/50 hover:bg-cyan-500/40 rounded-lg transition font-bold">
                   View
                </button>
              </div>
          </div>
        </div>

      </div>
    </div>
  `
})
export class ProfileComponent {
  gameState = inject(GameStateService);
  auth = inject(AuthService);
  audio = inject(AudioService);

  goBack() {
    this.audio.playSFX('hit');
    this.gameState.activeScreen.set('menu');
  }

  goToLogin() {
    this.audio.playSFX('hit');
    this.gameState.activeScreen.set('login');
  }
  
  logout() {
      this.audio.playSFX('hit');
      this.auth.logout();
  }

  toggleAudio() {
      this.audio.toggleMute();
      this.audio.playSFX('click');
  }

  openPolicies() {
      this.audio.playSFX('click');
      window.open('/policies/tos', '_blank');
  }
}
