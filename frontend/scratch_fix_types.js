const fs = require('fs');
const path = 'src/app/pages/game/game.component.ts';
let code = fs.readFileSync(path, 'utf8');

// 1. Fix aiCoinGainRate
code = code.replace(/this\.battleAi\.aiCoinGainRate/g, 'this.battleAi.coinGainRate');

// 2. Add getBattleContext
const getBattleContextMethod = `
  private getBattleContext(): BattleContext {
    return {
      gameState: this.gameState,
      bossMaxHealth: this.bossMaxHealth,
      bossHealth: this.bossHealth,
      maxHealth: this.maxHealth,
      currentHealth: this.currentHealth,
      enemies: this.spawnedEnemies
    };
  }

  private getSpawnerContext() {
`;
code = code.replace(/  private getSpawnerContext\(\) \{/, getBattleContextMethod);

code = code.replace(/this\.getSpawnerContext\(\)\);/g, 'this.getBattleContext());');

fs.writeFileSync(path, code);
