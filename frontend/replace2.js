const fs = require('fs');
const file = 'c:\\Users\\carte\\OneDrive\\Desktop\\Code\\Apps\\New-Project-Script\\Phoenix-Fall\\frontend\\src\\app\\components\\shop\\shop.component.ts';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('canAffordWithGemsButNotCoins')) {
    content = content.replace(
        /  public getGemCost\(cost: number\): number \{\n    return Math\.ceil\(cost \/ 1000\);\n  \}/,
        `  public getGemCost(cost: number): number {\n    return Math.ceil(cost / 1000);\n  }\n\n  public canAffordWithGemsButNotCoins(cost: number): boolean {\n    return this.gameState.coins() < cost && this.gameState.gems() >= this.getGemCost(cost);\n  }`
    );
}

// Manually replace @if blocks
// We need to match `@if (gameState.coins() >= <COST>) { <COINBTN> } @else { <GEMBTN> }`
const regex = /@if\s*\(\s*gameState\.coins\(\)\s*>=\s*(.*?)\s*\)\s*\{\s*([\s\S]*?)\s*\}\s*@else\s*\{\s*([\s\S]*?)\s*\}/g;

content = content.replace(regex, (match, cost, coinBtn, gemBtn) => {
    // Check if the gemBtn contains the disabled check for gems
    // If it does, we assume it's one of our deceptive trap buttons
    if (gemBtn.includes('gameState.gems() < getGemCost')) {
        // Strip the disabled state from the gemBtn if it exists since we will wrap it in an if that guarantees affordability
        let newGemBtn = gemBtn.replace(/\s*\[disabled\]="[^"]*"/, '');
        
        // Add the disabled state to the coinBtn if it doesn't have it
        let newCoinBtn = coinBtn;
        if (!newCoinBtn.includes('[disabled]')) {
            newCoinBtn = newCoinBtn.replace(/class="([^"]*)"/, `class="$1" [disabled]="gameState.coins() < ${cost}"`);
        } else {
            newCoinBtn = newCoinBtn.replace(/\[disabled\]="[^"]*"/, `[disabled]="gameState.coins() < ${cost}"`);
        }

        return `@if (canAffordWithGemsButNotCoins(${cost})) {\n${newGemBtn}\n} @else {\n${newCoinBtn}\n}`;
    }
    return match;
});

fs.writeFileSync(file, content);
