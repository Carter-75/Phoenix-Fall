const fs = require('fs');
let file = fs.readFileSync('src/app/components/shop/shop.component.ts', 'utf-8');

// 1. Update the HTML for each upgrade
const upgrades = [
  { key: 'maxHealth', fn: 'buyHealth', args: '100, 10, 100' },
  { key: 'speed', fn: 'buySpeed', args: '150, 0.1, 1' },
  { key: 'magnetism', fn: 'buyMagnet', args: '200, 0.1, 1' },
  { key: 'damage', fn: 'buyDamage', args: '250, 1, 10' },
  { key: 'attackSpeed', fn: 'buyAttackSpeed', args: '300, 0.1, 1' },
  { key: 'attackRange', fn: 'buyAttackRange', args: '350, 50, 100' },
  { key: 'auraRadius', fn: 'buyAuraRadius', args: '400, 50, 100' },
  { key: 'homingBullets', fn: 'buyHomingBullets', args: '500, 1, 1' }
];

upgrades.forEach(u => {
  const oldHtmlPattern = new RegExp(
    '@if \\(canAffordWithGemsButNotCoins\\(getCost\\(\\'' + u.key + '\\', ' + u.args.replace(/\\./g, '\\\\.') + '\\)\\)\\) \\{[\\s\\S]*?\\} @else \\{[\\s\\S]*?\\}'
  );
  
  const newHtml = `@if (canAffordWithGemsButNotCoins(getCost('${u.key}', ${u.args}))) {
                 <div class="flex gap-2 w-full">
                   <button (click)="${u.fn}(true)" class="flex-1 py-3 bg-gradient-to-r from-purple-600 to-fuchsia-600 rounded-xl flex items-center justify-center hover:brightness-110 active:scale-95 transition shadow-[0_0_15px_rgba(200,0,255,0.3)]">
                     <img src="assets/gem_icon.png" class="w-7 h-7"/>
                   </button>
                   <button (click)="buyWithAd('${u.key}')" class="flex-1 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-xl flex items-center justify-center hover:brightness-110 active:scale-95 transition shadow-[0_0_15px_rgba(0,200,255,0.3)]">
                     <span class="text-2xl">📺</span>
                   </button>
                 </div>
              } @else if (gameState.coins() < getCost('${u.key}', ${u.args})) {
                 <button (click)="buyWithAd('${u.key}')" class="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition shadow-[0_0_15px_rgba(0,200,255,0.3)]">
                   <span class="text-xl">📺</span> Watch Ad
                 </button>
              } @else {
                 <button (click)="${u.fn}()" class="w-full py-3 bg-gradient-to-r from-orange-600 to-red-600 rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition" [disabled]="gameState.coins() < getCost('${u.key}', ${u.args})">
                   <img src="assets/coin_icon.png" class="w-5 h-5"/> {{ getCost('${u.key}', ${u.args}) }}
                 </button>
              }`;

  file = file.replace(oldHtmlPattern, newHtml);
});

// We need to add the buyWithAd method to the class
if (!file.includes('buyWithAd(type: string)')) {
    const buyWithAdMethod = `
  buyWithAd(type: string) {
    const win = window as any;
    const executeUpgrade = () => {
        switch(type) {
            case 'maxHealth': this.buyHealth(false, true); break;
            case 'speed': this.buySpeed(false, true); break;
            case 'magnetism': this.buyMagnet(false, true); break;
            case 'damage': this.buyDamage(false, true); break;
            case 'attackSpeed': this.buyAttackSpeed(false, true); break;
            case 'attackRange': this.buyAttackRange(false, true); break;
            case 'auraRadius': this.buyAuraRadius(false, true); break;
            case 'homingBullets': this.buyHomingBullets(false, true); break;
        }
    };

    if (typeof win.adBreak === 'function') {
        win.adBreak({
            type: 'reward',
            name: 'upgrade_ad',
            beforeReward: (showAdFn: any) => { showAdFn(); },
            adViewed: () => { executeUpgrade(); },
            adDismissed: () => { },
            beforeAd: () => {
                this.gameState.audio.masterVolume.set(0);
                this.gameState.audio.saveSettings();
            },
            afterAd: () => {
                const savedMaster = localStorage.getItem('phoenix_vol_master');
                this.gameState.audio.masterVolume.set(savedMaster !== null ? parseFloat(savedMaster) : 1.0);
                this.gameState.audio.saveSettings();
            }
        });
    } else {
        console.warn("Google AdSense adBreak API not found. Mocking ad watch...");
        this.gameState.audio.masterVolume.set(0);
        this.gameState.audio.saveSettings();
        
        setTimeout(() => {
            const savedMaster = localStorage.getItem('phoenix_vol_master');
            this.gameState.audio.masterVolume.set(savedMaster !== null ? parseFloat(savedMaster) : 1.0);
            this.gameState.audio.saveSettings();
            
            executeUpgrade();
        }, 2000);
    }
  }
`;
    file = file.replace('closeShop() {', buyWithAdMethod + '\n  closeShop() {');
}

fs.writeFileSync('src/app/components/shop/shop.component.ts', file);
console.log('Done refactoring HTML template and adding buyWithAd');
