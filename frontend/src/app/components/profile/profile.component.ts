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
          
          <h3 class="text-2xl font-bold text-white mb-4">Trophies</h3>
          <div class="flex flex-wrap gap-3">
             @if (gameState.trophies().length === 0) {
                 <div class="w-full text-white/40 text-center py-4">No trophies yet. Keep playing!</div>
             }
             @for (trophy of gameState.trophies(); track trophy) {
                 <div class="bg-white/5 border border-yellow-500/30 rounded-lg py-2 px-4 flex items-center gap-2 shadow-[0_0_10px_rgba(234,179,8,0.05)] hover:bg-white/10 transition">
                    <span class="text-xl drop-shadow-md">🏆</span>
                    <span class="text-yellow-100 font-bold text-sm">{{ trophy }}</span>
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

        <!-- Cosmetics Settings Section -->
        @if (gameState.hasPurchasedGems() || gameState.hasCosmicTrail() || gameState.hasGoldenAura() || gameState.hasCelestialShield()) {
          <div class="mt-8 mb-8 border-t border-white/10 pt-8">
            <h3 class="text-2xl font-bold text-white mb-6 flex items-center gap-2"><span class="text-3xl">✨</span> Cosmetics</h3>
            <div class="flex flex-col gap-4">
                
                @if (gameState.hasCosmicTrail()) {
                <div class="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
                  <div class="flex flex-col">
                     <span class="text-pink-400 font-bold text-lg">Cosmic Trail</span>
                     <span class="text-white/50 text-sm">Toggle the cosmic energy trail effect</span>
                  </div>
                  <button (click)="toggleCosmetic('trail')" class="w-16 h-8 rounded-full transition-colors relative"
                          [ngClass]="!gameState.toggleCosmicTrail() ? 'bg-gray-600' : 'bg-pink-500'">
                     <div class="absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-md"
                          [ngClass]="!gameState.toggleCosmicTrail() ? 'left-1' : 'left-9'"></div>
                  </button>
                </div>
                }

                @if (gameState.hasGoldenAura()) {
                <div class="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
                  <div class="flex flex-col">
                     <span class="text-yellow-400 font-bold text-lg">Golden Aura</span>
                     <span class="text-white/50 text-sm">Toggle the swirling golden particle vortex</span>
                  </div>
                  <button (click)="toggleCosmetic('aura')" class="w-16 h-8 rounded-full transition-colors relative"
                          [ngClass]="!gameState.toggleGoldenAura() ? 'bg-gray-600' : 'bg-yellow-500'">
                     <div class="absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-md"
                          [ngClass]="!gameState.toggleGoldenAura() ? 'left-1' : 'left-9'"></div>
                  </button>
                </div>
                }

                @if (gameState.hasCelestialShield()) {
                <div class="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
                  <div class="flex flex-col">
                     <span class="text-cyan-400 font-bold text-lg">Celestial Shield</span>
                     <span class="text-white/50 text-sm">Toggle the orbital energy shield visual</span>
                  </div>
                  <button (click)="toggleCosmetic('shield')" class="w-16 h-8 rounded-full transition-colors relative"
                          [ngClass]="!gameState.toggleCelestialShield() ? 'bg-gray-600' : 'bg-cyan-500'">
                     <div class="absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-md"
                          [ngClass]="!gameState.toggleCelestialShield() ? 'left-1' : 'left-9'"></div>
                  </button>
                </div>
                }
            </div>
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
                <button (click)="showLegal('tos')" class="px-6 py-2 bg-cyan-500/20 text-cyan-400 border border-cyan-500/50 hover:bg-cyan-500/40 rounded-lg transition font-bold">
                   View
                </button>
              </div>
          </div>
        </div>

      </div>

      <!-- Legal Modal -->
      @if (activeLegalDoc) {
          <div class="fixed inset-0 bg-black/95 flex flex-col items-center justify-center z-[300] px-4 backdrop-blur-md pointer-events-auto">
             <div class="w-full max-w-2xl bg-zinc-900 border border-cyan-500/50 rounded-3xl p-8 flex flex-col max-h-[80vh] shadow-[0_0_30px_rgba(0,255,255,0.2)]">
                 <div class="flex justify-between items-center mb-6">
                    <h2 class="text-2xl font-bold text-white">{{ getLegalTitle() }}</h2>
                    <button (click)="activeLegalDoc = null" class="text-white/50 hover:text-white text-3xl font-black">&times;</button>
                 </div>
                 
                 <div class="flex gap-4 mb-6 border-b border-white/10 pb-4">
                    <button (click)="showLegal('tos')" class="text-sm font-bold transition hover:text-cyan-300" [class.text-cyan-400]="activeLegalDoc === 'tos'" [class.text-white]="activeLegalDoc !== 'tos'">Terms of Service</button>
                    <button (click)="showLegal('privacy')" class="text-sm font-bold transition hover:text-cyan-300" [class.text-cyan-400]="activeLegalDoc === 'privacy'" [class.text-white]="activeLegalDoc !== 'privacy'">Privacy Policy</button>
                    <button (click)="showLegal('refunds')" class="text-sm font-bold transition hover:text-cyan-300" [class.text-cyan-400]="activeLegalDoc === 'refunds'" [class.text-white]="activeLegalDoc !== 'refunds'">Refund Policy</button>
                 </div>

                 <div class="overflow-y-auto text-white/80 text-sm md:text-base space-y-4 pr-4 custom-scrollbar leading-relaxed">
                    {{ getLegalContent() }}
                 </div>
                 <button (click)="activeLegalDoc = null" class="mt-8 w-full py-4 bg-cyan-600/20 border border-cyan-500 hover:bg-cyan-600/40 rounded-xl font-bold text-cyan-300 transition text-xl">Close</button>
             </div>
          </div>
      }
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

  toggleCosmetic(type: string) {
    this.audio.playSFX('click');
    if (type === 'trail') {
        this.gameState.toggleCosmicTrail.set(!this.gameState.toggleCosmicTrail());
    } else if (type === 'aura') {
        this.gameState.toggleGoldenAura.set(!this.gameState.toggleGoldenAura());
    } else if (type === 'shield') {
        this.gameState.toggleCelestialShield.set(!this.gameState.toggleCelestialShield());
    }
    
    // Sync immediately if logged in
    if (this.auth.currentUser() && !this.auth.currentUser()?.isTemp) {
        this.auth.sync({
            toggleCosmicTrail: this.gameState.toggleCosmicTrail(),
            toggleGoldenAura: this.gameState.toggleGoldenAura(),
            toggleCelestialShield: this.gameState.toggleCelestialShield()
        } as any).subscribe();
    }
  }

  activeLegalDoc: 'tos' | 'privacy' | 'refunds' | null = null;

  showLegal(doc: 'tos' | 'privacy' | 'refunds') {
      this.audio.playSFX('click');
      this.activeLegalDoc = doc;
  }

  getLegalTitle(): string {
      if (this.activeLegalDoc === 'tos') return 'Terms of Service';
      if (this.activeLegalDoc === 'privacy') return 'Privacy Policy';
      return 'Refund Policy';
  }

  getLegalContent(): string {
      if (this.activeLegalDoc === 'tos') {
          return "By accessing or using Phoenix Fall, you agree to be bound by these Terms of Service. You may not cheat, hack, or exploit bugs. We reserve the right to ban accounts without notice for any violation. All virtual items remain the property of the developer. We are not responsible for any emotional distress caused by our highly addictive gameplay loop.";
      }
      if (this.activeLegalDoc === 'privacy') {
          return "We collect your email, username, and gameplay analytics. We use this data to optimize monetization, track your engagement, and serve targeted offers. By agreeing, you consent to our use of third-party analytics trackers to monitor your session times and in-game currency balances. If you are under 13, you must have parental consent to play.";
      }
      return "ALL SALES ARE FINAL. Virtual currency (Gems) and in-game upgrades hold no real-world value and cannot be exchanged for fiat currency. We do not offer refunds for accidental purchases, account bans, or buyer's remorse, except where expressly mandated by statutory consumer rights in your jurisdiction. Please contact Google Play or Apple App Store for billing inquiries.";
  }
}
