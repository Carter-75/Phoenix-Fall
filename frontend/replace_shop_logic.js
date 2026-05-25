const fs = require('fs');
const file = 'c:\\Users\\carte\\OneDrive\\Desktop\\Code\\Apps\\New-Project-Script\\Phoenix-Fall\\frontend\\src\\app\\components\\shop\\shop.component.ts';
let content = fs.readFileSync(file, 'utf8');

// First add the helper method
if (!content.includes('canAffordWithGemsButNotCoins')) {
    content = content.replace(
        /  public getGemCost\(cost: number\): number \{\n    return Math\.ceil\(cost \/ 1000\);\n  \}/,
        `  public getGemCost(cost: number): number {\n    return Math.ceil(cost / 1000);\n  }\n\n  public canAffordWithGemsButNotCoins(cost: number): boolean {\n    return this.gameState.coins() < cost && this.gameState.gems() >= this.getGemCost(cost);\n  }`
    );
}

// Passives
// @if (gameState.coins() >= COST) { COIN_BTN } @else { GEM_BTN }
// becomes:
// @if (canAffordWithGemsButNotCoins(COST)) { GEM_BTN } @else { COIN_BTN_WITH_DISABLED }

content = content.replace(
    /@if \(gameState\.coins\(\) >= (.*?)\) \{\s*<button \((click=".*?")\) class="(.*?)"(.*?)(>\s*<img src="assets\/coin_icon\.png".*?<\/button>)\s*\} @else \{\s*<button \((click=".*?\(true\)")\) class="(.*?)" \[disabled\]=".*?"(>\s*<img src="assets\/gem_icon\.png".*?<\/button>)\s*\}/g,
    (match, costStr, clickCoin, classCoin, extraCoinAttrs, innerCoin, clickGem, classGem, innerGem) => {
        // Build the disabled attribute for the coin button
        let coinBtn = `<button (${clickCoin}) class="${classCoin}" [disabled]="gameState.coins() < ${costStr}"${extraCoinAttrs}${innerCoin}`;
        let gemBtn = `<button (${clickGem}) class="${classGem}"${innerGem}`;
        
        return `@if (canAffordWithGemsButNotCoins(${costStr})) {\n                 ${gemBtn}\n              } @else {\n                 ${coinBtn}\n              }`;
    }
);

fs.writeFileSync(file, content);
