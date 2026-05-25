const fs = require('fs');
const file = 'c:\\Users\\carte\\OneDrive\\Desktop\\Code\\Apps\\New-Project-Script\\Phoenix-Fall\\frontend\\src\\app\\components\\shop\\shop.component.ts';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('canAffordWithGemsButNotCoins')) {
    content = content.replace(
        /  public getGemCost\(cost: number\): number \{\n    return Math\.ceil\(cost \/ 1000\);\n  \}/,
        `  public getGemCost(cost: number): number {\n    return Math.ceil(cost / 1000);\n  }\n\n  public canAffordWithGemsButNotCoins(cost: number): boolean {\n    return this.gameState.coins() < cost && this.gameState.gems() >= this.getGemCost(cost);\n  }`
    );
}

let output = "";
let i = 0;
while (i < content.length) {
    let ifIdx = content.indexOf('@if (gameState.coins() >= ', i);
    if (ifIdx === -1) {
        output += content.substring(i);
        break;
    }
    output += content.substring(i, ifIdx);
    
    let braceIdx = content.indexOf(') {', ifIdx);
    let costExpr = content.substring(ifIdx + '@if (gameState.coins() >= '.length, braceIdx).trim();
    
    let elseIdx = content.indexOf('} @else {', braceIdx);
    let coinBtnContent = content.substring(braceIdx + ') {'.length, elseIdx);
    
    // Find the next } that matches the @else block indentation, or just look for the end of the button
    let endElseIdx = content.indexOf('              }', elseIdx); 
    let gemBtnContent = content.substring(elseIdx + '} @else {'.length, endElseIdx);
    
    if (gemBtnContent.includes('gem_icon.png') && !gemBtnContent.includes('@if')) { // Ensure we aren't eating too much
        let newGemBtn = gemBtnContent.replace(/\s*\[disabled\]="[^"]*"/, '');
        
        let newCoinBtn = coinBtnContent;
        if (!newCoinBtn.includes('[disabled]')) {
            newCoinBtn = newCoinBtn.replace(/class="([^"]*)"/, `class="$1" [disabled]="gameState.coins() < ${costExpr}"`);
        }
        
        output += `@if (canAffordWithGemsButNotCoins(${costExpr})) {${newGemBtn}} @else {${newCoinBtn}`;
        i = endElseIdx;
    } else {
        output += content.substring(ifIdx, elseIdx + '} @else {'.length);
        i = elseIdx + '} @else {'.length;
    }
}

fs.writeFileSync(file, output);
