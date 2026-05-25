import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-policies',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="min-h-screen bg-black text-white p-8 flex flex-col items-center custom-scrollbar overflow-y-auto">
       <div class="w-full max-w-3xl flex flex-col mt-12 bg-white/5 border border-white/10 rounded-3xl p-8 md:p-12 shadow-2xl">
           <button (click)="goBack()" class="self-start text-white/50 hover:text-white transition flex items-center gap-2 mb-8">
              <span class="text-2xl">←</span> Return to Game
           </button>
           
           <h1 class="text-4xl md:text-5xl font-black mb-8 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">
               {{ getTitle() }}
           </h1>
           
           <div class="text-white/80 leading-relaxed space-y-6 text-lg">
               {{ getContent() }}
           </div>
           
           <div class="mt-12 pt-8 border-t border-white/10 flex justify-center gap-6">
               <button (click)="navigate('tos')" class="text-sm font-bold hover:underline transition" [class.text-cyan-400]="type === 'tos'">Terms of Service</button>
               <button (click)="navigate('privacy')" class="text-sm font-bold hover:underline transition" [class.text-cyan-400]="type === 'privacy'">Privacy Policy</button>
               <button (click)="navigate('refunds')" class="text-sm font-bold hover:underline transition" [class.text-cyan-400]="type === 'refunds'">Refund Policy</button>
           </div>
       </div>
    </div>
  `
})
export class PoliciesComponent implements OnInit {
  route = inject(ActivatedRoute);
  router = inject(Router);
  
  type: string = 'tos';

  ngOnInit() {
      this.route.paramMap.subscribe(params => {
          this.type = params.get('type') || 'tos';
      });
  }

  navigate(newType: string) {
      this.router.navigate(['/policies', newType]);
  }

  goBack() {
      this.router.navigate(['/']);
  }

  getTitle(): string {
      if (this.type === 'tos') return 'Terms of Service';
      if (this.type === 'privacy') return 'Privacy Policy';
      if (this.type === 'refunds') return 'Refund Policy';
      return 'Legal Policy';
  }

  getContent(): string {
      if (this.type === 'tos') {
          return "By accessing or using Phoenix Fall, you agree to be bound by these Terms of Service. You may not cheat, hack, or exploit bugs. We reserve the right to ban accounts without notice for any violation. All virtual items remain the property of the developer. We are not responsible for any emotional distress caused by our highly addictive gameplay loop.";
      }
      if (this.type === 'privacy') {
          return "We collect your email, username, and gameplay analytics. We use this data to optimize monetization, track your engagement, and serve targeted offers. By agreeing, you consent to our use of third-party analytics trackers to monitor your session times and in-game currency balances. If you are under 13, you must have parental consent to play.";
      }
      if (this.type === 'refunds') {
          return "ALL SALES ARE FINAL. Virtual currency (Gems) and in-game upgrades hold no real-world value and cannot be exchanged for fiat currency. We do not offer refunds for accidental purchases, account bans, or buyer's remorse, except where expressly mandated by statutory consumer rights in your jurisdiction. Please contact Google Play or Apple App Store for billing inquiries.";
      }
      return "Policy not found.";
  }
}
