import re

with open('src/app/components/shop/shop.component.ts', 'r', encoding='utf-8') as f:
    content = f.read()

upgrades = [
    ('maxHealth', 'buyHealth', '100, 10, 100'),
    ('speed', 'buySpeed', '150, 0.1, 1'),
    ('magnetism', 'buyMagnet', '200, 0.1, 1'),
    ('damage', 'buyDamage', '250, 1, 10'),
    ('attackSpeed', 'buyAttackSpeed', '300, 0.1, 1'),
    ('attackRange', 'buyAttackRange', '250, 50, 400'),
    ('auraRadius', 'buyAuraRadius', '400, 10, 250'),
    ('homingLevel', 'buyHoming', '300, 1, 0')
]

for key, fn, args in upgrades:
    # Match the block
    pattern = r"@if \(canAffordWithGemsButNotCoins\(getCost\('" + key + r"', " + args.replace('.', r'\.') + r"\)\)\) \{[\s\S]*?\} @else \{[\s\S]*?\}\s*<\/div>"
    
    new_html = f"""@if (canAffordWithGemsButNotCoins(getCost('{key}', {args}))) {{
                 <div class="flex gap-2 w-full">
                   <button (click)="{fn}(true)" class="flex-1 py-3 bg-gradient-to-r from-purple-600 to-fuchsia-600 rounded-xl flex items-center justify-center hover:brightness-110 active:scale-95 transition shadow-[0_0_15px_rgba(200,0,255,0.3)]">
                     <img src="assets/gem_icon.png" class="w-7 h-7"/>
                   </button>
                   <button (click)="buyWithAd('{key}')" class="flex-1 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-xl flex items-center justify-center hover:brightness-110 active:scale-95 transition shadow-[0_0_15px_rgba(0,200,255,0.3)]">
                     <span class="text-2xl">📺</span>
                   </button>
                 </div>
              }} @else if (gameState.coins() < getCost('{key}', {args})) {{
                 <button (click)="buyWithAd('{key}')" class="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition shadow-[0_0_15px_rgba(0,200,255,0.3)]">
                   <span class="text-xl">📺</span>
                 </button>
              }} @else {{
                 <button (click)="{fn}()" class="w-full py-3 bg-gradient-to-r from-orange-600 to-red-600 rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition" [disabled]="gameState.coins() < getCost('{key}', {args})">
                   <img src="assets/coin_icon.png" class="w-5 h-5"/> {{{{ getCost('{key}', {args}) }}}}
                 </button>
              }}
            </div>"""
    
    content = re.sub(pattern, new_html, content)

    # Now update the typescript function to accept isFree
    fn_def_pattern = fn + r"\(useGems: boolean = false\)\s*\{([\s\S]*?)if \(useGems\) \{\s*const gemCost = this\.getGemCost\(cost\);\s*if \(this\.gameState\.gems\(\) >= gemCost\) \{\s*this\.gameState\.gems\.update\(c => c - gemCost\);\s*(this\.gameState\.worldUpgrades\.update\([\s\S]*?\);)\s*this\.gameState\.audio\.playSFX\('buy'\);\s*\}\s*\}"
    
    def replacer(match):
        prelude = match.group(1)
        upgrade_code = match.group(2)
        
        replacement = f"""{fn}(useGems: boolean = false, isFree: boolean = false) {{
{prelude}    if (isFree) {{
      {upgrade_code}
      this.gameState.audio.playSFX('buy');
    }} else if (useGems) {{
      const gemCost = this.getGemCost(cost);
      if (this.gameState.gems() >= gemCost) {{
        this.gameState.gems.update(c => c - gemCost);
        {upgrade_code}
        this.gameState.audio.playSFX('buy');
      }}
    }}"""
        return replacement
        
    content = re.sub(fn_def_pattern, replacer, content)

if 'buyWithAd(type: string)' not in content:
    ad_method = """
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
            case 'homingLevel': this.buyHoming(false, true); break;
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
"""
    content = content.replace('closeShop() {', ad_method + '\n  closeShop() {')

with open('src/app/components/shop/shop.component.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
