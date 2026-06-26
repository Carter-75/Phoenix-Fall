const fs = require('fs');
const path = 'c:/Users/carte/OneDrive/Desktop/Code/Apps/New-Project-Script/Phoenix-Fall/frontend/src/app/components/game/game.component.ts';
let code = fs.readFileSync(path, 'utf8');

const getContextStr = `{\n              gameState: this.gameState,\n              bossMaxHealth: this.bossMaxHealth,\n              bossHealth: this.bossHealth,\n              maxHealth: this.maxHealth,\n              currentHealth: this.currentHealth,\n              enemies: this.enemies\n          }`;

// Fix spendTokens
code = code.replace(/this\.spendTokens\(([^,]+),\s*([^,]+),\s*([^)]+)\)/g, `this.battleAi.spendTokens($1, $2, $3, ${getContextStr})`);

// Fix aiCoinGainRate
code = code.replace(/this\.aiCoinGainRate/g, 'this.battleAi.coinGainRate');

fs.writeFileSync(path, code);
console.log('Successfully fixed GameComponent');
