const fs = require('fs');
const path = 'c:/Users/carte/OneDrive/Desktop/Code/Apps/New-Project-Script/Phoenix-Fall/frontend/src/app/pages/game/game.component.ts';
let code = fs.readFileSync(path, 'utf8');

// 1. Add BattleAiService import
code = code.replace(
    `import { MlAiService } from '../../services/ml-ai.service';`,
    `import { MlAiService } from '../../services/ml-ai.service';\nimport { BattleAiService, BattleContext } from '../../services/battle-ai.service';`
);

// 2. Add BattleAiService injection
code = code.replace(
    `  public mlAi = inject(MlAiService);`,
    `  public mlAi = inject(MlAiService);\n  public battleAi = inject(BattleAiService);`
);

// 3. Remove AI state properties
const propsToRemove = [
    `  public aiCoins: number = 0;\r\n`,
    `  public aiCoinGainRate: number = 2;\r\n`,
    `  public aiStats!: WorldStats;\r\n`,
    `  public aiUpgradesWeights: Record<string, number> = {};\r\n`,
    `  public aiAbilities: string[] = [];\r\n`,
    `  public aiLastTapTime: number = 0;\r\n`,
    `  public aiLastHoldTime: number = 0;\r\n`,
    `  public aiUpgradeTokensBox: number = 0;\r\n`,
    `  public aiAbilityTokensBox: number = 0;\r\n\r\n`,
    `  public ai2Stats!: WorldStats;\r\n`,
    `  public ai2Abilities: string[] = [];\r\n`,
    `  public ai2LastTapTime: number = 0;\r\n`,
    `  public ai2TapCooldown: number = 0;\r\n`,
    `  public ai2LastHoldTime: number = 0;\r\n`,
    `  public ai2HoldCooldown: number = 0;\r\n`,
    `  public ai2UpgradesWeights: Record<string, number> = {};\r\n`,
    `  public ai2Coins: number = 0;\r\n`,
    `  public ai2UpgradeTokensBox: number = 0;\r\n`,
    `  public ai2AbilityTokensBox: number = 0;\r\n\r\n`
];

for(const prop of propsToRemove) {
    // Try CRLF first
    let replaced = code.replace(prop, '');
    if (replaced === code) {
        // Try LF
        replaced = code.replace(prop.replace(/\r\n/g, '\n'), '');
    }
    code = replaced;
}

// 4. Update initBattleMode
code = code.replace(
    `this.aiUpgradeTokensBox = 0;\n      this.aiAbilityTokensBox = 0;\n      this.aiUpgradesWeights = {};\n      \n      this.ai2UpgradeTokensBox = 0;\n      this.ai2AbilityTokensBox = 0;\n      this.ai2UpgradesWeights = {};`,
    `this.battleAi.reset();`
);
code = code.replace(
    `this.aiUpgradeTokensBox = 0;\r\n      this.aiAbilityTokensBox = 0;\r\n      this.aiUpgradesWeights = {};\r\n      \r\n      this.ai2UpgradeTokensBox = 0;\r\n      this.ai2AbilityTokensBox = 0;\r\n      this.ai2UpgradesWeights = {};`,
    `this.battleAi.reset();`
);

code = code.replace(
    `this.aiCoins = 0;\n      this.ai2Coins = 0;\n      this.aiCoinGainRate = 2;`,
    ``
);
code = code.replace(
    `this.aiCoins = 0;\r\n      this.ai2Coins = 0;\r\n      this.aiCoinGainRate = 2;`,
    ``
);

code = code.replace(
    `const maxHp = this.aiStats.maxHealth;`,
    `const maxHp = this.battleAi.ai1.stats.maxHealth;`
);

// 5. Update setupAiPhoenix (assigning to aiStats)
code = code.replace(/this\.aiStats/g, `this.battleAi.ai1.stats`);
code = code.replace(/this\.ai2Stats/g, `this.battleAi.ai2.stats`);
code = code.replace(/this\.aiAbilities/g, `this.battleAi.ai1.abilities`);
code = code.replace(/this\.ai2Abilities/g, `this.battleAi.ai2.abilities`);

// 6. Update Game Loop ticks
code = code.replace(
    `// AI Economy TICK\n          this.aiCoins += this.aiCoinGainRate;\n          this.tryPurchaseAiUpgrade('ai1');\n          \n          if (this.gameState.currentGameMode() === 'ai_vs_ai') {\n              this.ai2Coins += this.aiCoinGainRate;\n              this.tryPurchaseAiUpgrade('ai2');\n          }`,
    `// AI Economy TICK\n          this.battleAi.tick({\n              gameState: this.gameState,\n              bossMaxHealth: this.bossMaxHealth,\n              bossHealth: this.bossHealth,\n              maxHealth: this.maxHealth,\n              currentHealth: this.currentHealth,\n              enemies: this.enemies\n          });`
);
code = code.replace(
    `// AI Economy TICK\r\n          this.aiCoins += this.aiCoinGainRate;\r\n          this.tryPurchaseAiUpgrade('ai1');\r\n          \r\n          if (this.gameState.currentGameMode() === 'ai_vs_ai') {\r\n              this.ai2Coins += this.aiCoinGainRate;\r\n              this.tryPurchaseAiUpgrade('ai2');\r\n          }`,
    `// AI Economy TICK\r\n          this.battleAi.tick({\r\n              gameState: this.gameState,\r\n              bossMaxHealth: this.bossMaxHealth,\r\n              bossHealth: this.bossHealth,\r\n              maxHealth: this.maxHealth,\r\n              currentHealth: this.currentHealth,\r\n              enemies: this.enemies\r\n          });`
);

// 7. Update usage of aiLastTapTime
code = code.replace(/this\.aiLastTapTime/g, `this.battleAi.ai1.lastTapTime`);
code = code.replace(/this\.aiLastHoldTime/g, `this.battleAi.ai1.lastHoldTime`);
code = code.replace(/this\.ai2LastTapTime/g, `this.battleAi.ai2.lastTapTime`);
code = code.replace(/this\.ai2LastHoldTime/g, `this.battleAi.ai2.lastHoldTime`);
code = code.replace(/this\.ai2TapCooldown/g, `this.battleAi.ai2.tapCooldown`);
code = code.replace(/this\.ai2HoldCooldown/g, `this.battleAi.ai2.holdCooldown`);
code = code.replace(/this\.aiCoins/g, `this.battleAi.ai1.coins`);
code = code.replace(/this\.ai2Coins/g, `this.battleAi.ai2.coins`);
code = code.replace(/this\.aiUpgradeTokensBox/g, `this.battleAi.ai1.upgradeTokensBox`);
code = code.replace(/this\.aiAbilityTokensBox/g, `this.battleAi.ai1.abilityTokensBox`);
code = code.replace(/this\.ai2UpgradeTokensBox/g, `this.battleAi.ai2.upgradeTokensBox`);
code = code.replace(/this\.ai2AbilityTokensBox/g, `this.battleAi.ai2.abilityTokensBox`);
code = code.replace(/this\.aiUpgradesWeights/g, `this.battleAi.ai1.upgradesWeights`);
code = code.replace(/this\.ai2UpgradesWeights/g, `this.battleAi.ai2.upgradesWeights`);


// 8. Delete spendTokens, applyAiUpgrade, tryPurchaseAiUpgrade
let startIdx = code.indexOf('  private spendTokens(upgradeTokens');
let endIdx = code.indexOf('  private createEnemyBody');
if(startIdx !== -1 && endIdx !== -1) {
    code = code.substring(0, startIdx) + code.substring(endIdx);
}

fs.writeFileSync(path, code);
console.log('Successfully refactored game.component.ts');
