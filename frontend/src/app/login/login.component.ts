import { Component, inject, OnInit } from '@angular/core';
import { GameStateService } from '../services/game-state.service';
import { AuthService } from '../services/auth.service';
import { AudioService } from '../services/audio.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="fixed inset-0 flex flex-col items-center justify-center p-4 z-50">
      <button (click)="goBack()" class="absolute top-6 left-6 text-white/50 hover:text-white transition flex items-center gap-2">
        <span class="text-2xl">←</span> Back
      </button>

      <div class="bg-black/60 backdrop-blur-xl border border-white/10 rounded-3xl p-8 w-full max-w-md shadow-[0_0_50px_rgba(255,100,0,0.1)]">
        <h2 class="text-3xl font-black text-center mb-8 text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500">
           {{ mode === 'email' ? 'ACCOUNT ACCESS' : 'CHOOSE USERNAME' }}
        </h2>
        
        @if (error) {
          <div class="bg-red-500/20 text-red-400 p-3 rounded-lg text-sm mb-4 border border-red-500/20">
            {{ error }}
          </div>
        }

        <div class="space-y-4">
          @if (mode === 'email') {
              <button (click)="loginWithGoogle()" 
                      class="w-full p-4 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center hover:bg-white/10 transition-colors text-white font-semibold gap-3">
                <svg class="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>
              
              <div class="relative flex items-center justify-center py-4">
                <div class="border-t border-white/10 w-full"></div>
                <span class="bg-transparent px-4 text-white/40 text-sm absolute backdrop-blur-md">or</span>
              </div>
          }

          @if (mode === 'email') {
            <input [(ngModel)]="email" type="email" placeholder="Email Address" class="w-full p-4 bg-black/40 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-orange-500/50 transition">
            <input [(ngModel)]="password" type="password" placeholder="Password" class="w-full p-4 bg-black/40 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-orange-500/50 transition">
          }
          
          @if (mode === 'set-username') {
            <p class="text-white/60 text-center mb-4">You successfully authenticated! Now pick a unique username for the leaderboard.</p>
            <input [(ngModel)]="username" type="text" placeholder="Username" class="w-full p-4 bg-black/40 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-orange-500/50 transition">
            
            <div class="mt-4 flex items-start gap-3 bg-white/5 p-4 rounded-xl border border-white/10">
                <input type="checkbox" [(ngModel)]="acceptedTerms" id="terms" class="mt-1 w-4 h-4 accent-orange-500">
                <label for="terms" class="text-white/70 text-sm leading-tight">
                    I agree to the <button (click)="showLegal('tos')" class="text-orange-400 hover:underline">Terms of Service</button>, 
                    <button (click)="showLegal('privacy')" class="text-orange-400 hover:underline">Privacy Policy</button>, and 
                    acknowledge the <button (click)="showLegal('refunds')" class="text-orange-400 hover:underline">Refund Policy</button>.
                </label>
            </div>
          }
          
          <button (click)="submit()" 
                  class="w-full mt-4 p-4 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl font-bold hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-orange-500/20 disabled:opacity-50 disabled:grayscale"
                  [disabled]="mode === 'set-username' && !acceptedTerms">
            {{ mode === 'email' ? 'Continue' : 'Complete Signup' }}
          </button>
          

        </div>
      </div>

      <!-- Legal Modal -->
      @if (activeLegalDoc) {
          <div class="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-[100] px-4 backdrop-blur-md">
             <div class="w-full max-w-2xl bg-zinc-900 border border-white/20 rounded-3xl p-8 flex flex-col max-h-[80vh] shadow-2xl">
                 <div class="flex justify-between items-center mb-6">
                    <h2 class="text-2xl font-bold text-white">{{ getLegalTitle() }}</h2>
                    <button (click)="activeLegalDoc = null" class="text-white/50 hover:text-white text-2xl">&times;</button>
                 </div>
                 <div class="overflow-y-auto text-white/70 text-sm space-y-4 pr-4 custom-scrollbar">
                    {{ getLegalContent() }}
                 </div>
                 <button (click)="activeLegalDoc = null" class="mt-6 w-full py-4 bg-white/10 hover:bg-white/20 rounded-xl font-bold text-white transition">Close</button>
             </div>
          </div>
      }
    </div>
  `
})
export class LoginComponent implements OnInit {
  private gameState = inject(GameStateService);
  private authService = inject(AuthService);
  private audioService = inject(AudioService);
  
  mode: 'email' | 'set-username' = 'email';
  
  email = '';
  password = '';
  username = '';
  error = '';
  acceptedTerms = false;
  activeLegalDoc: 'tos' | 'privacy' | 'refunds' | null = null;

  ngOnInit() {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('mode') === 'set-username' || this.authService.currentUser()?.isTemp) {
          this.mode = 'set-username';
      } else if (urlParams.get('error')) {
          this.error = 'Google Authentication Failed.';
      }
  }

  showLegal(doc: 'tos' | 'privacy' | 'refunds') {
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

  goBack() {
    this.audioService.playSFX('hit'); 
    window.history.replaceState({}, document.title, "/");
    this.gameState.activeScreen.set('menu');
  }

  submit() {
    this.audioService.playSFX('buy');
    this.error = '';
    
    if (this.mode === 'email') {
        if (!this.email || !this.password) {
            this.error = "Please fill in all fields";
            return;
        }
        
        this.authService.login({ email: this.email, password: this.password }).subscribe({
            next: (user: any) => {
                if (user.isTemp) {
                    this.mode = 'set-username';
                } else {
                    this.gameState.syncWithUser(user);
                    this.goBack();
                }
            },
            error: (err) => {
                if (err.error?.message === 'USER_NOT_FOUND') {
                    // Auto-register
                    this.authService.register({ email: this.email, password: this.password }).subscribe({
                        next: async (newUser: any) => {
                            if (newUser.isTemp) {
                                this.mode = 'set-username';
                            } else {
                                await this.gameState.migrateGuestData();
                                this.gameState.syncWithUser(newUser);
                                this.goBack();
                            }
                        },
                        error: (registerErr) => {
                            this.error = registerErr.error?.message || 'Registration failed';
                        }
                    });
                } else {
                    this.error = err.error?.message || 'Login failed';
                }
            }
        });
    } else if (this.mode === 'set-username') {
        this.authService.completeSignup(this.username).subscribe({
            next: async (user) => {
                await this.gameState.migrateGuestData();
                this.gameState.syncWithUser(user);
                this.goBack();
            },
            error: (err) => this.error = err.error?.message || 'Failed to set username'
        });
    }
  }

  loginWithGoogle() {
    this.audioService.playSFX('buy');
    this.authService.loginWithGoogle();
  }
}
