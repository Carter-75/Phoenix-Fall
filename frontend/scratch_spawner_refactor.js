const fs = require('fs');
const path = 'c:/Users/carte/OneDrive/Desktop/Code/Apps/New-Project-Script/Phoenix-Fall/frontend/src/app/pages/game/game.component.ts';
let code = fs.readFileSync(path, 'utf8');

// 1. Add EntitySpawnerService import
if (!code.includes('EntitySpawnerService')) {
    code = code.replace(
        `import { BattleAiService, BattleContext } from '../../services/battle-ai.service';`,
        `import { BattleAiService, BattleContext } from '../../services/battle-ai.service';\nimport { EntitySpawnerService } from '../../services/entity-spawner.service';`
    );
}

// 2. Add injection
if (!code.includes('public spawner = inject(EntitySpawnerService)')) {
    code = code.replace(
        `  public battleAi = inject(BattleAiService);`,
        `  public battleAi = inject(BattleAiService);\n  public spawner = inject(EntitySpawnerService);`
    );
}

// 3. Add getSpawnerContext method
const ctxMethod = `
  private getSpawnerContext() {
      return {
          engine: this.engine,
          enemies: this.enemies,
          items: this.items,
          gameState: this.gameState,
          audioService: this.audioService,
          screenScale: this.screenScale,
          progressPercent: () => this.progressPercent(),
          gameEnded: () => this.gameEnded(),
          isDead: () => this.isDead(),
          bossSpawned: this.bossSpawned,
          clearEnemies: () => this.clearEnemies(),
          battleDropReady: this.battleDropReady,
          battleDropGrace: this.battleDropGrace,
          battleAi: this.battleAi,
          inBossDefeatSequence: () => this.inBossDefeatSequence()
      };
  }
`;
if (!code.includes('private getSpawnerContext')) {
    code = code.replace(`  private startGameLoop() {`, ctxMethod + `\n  private startGameLoop() {`);
}

// Replace method usages
code = code.replace(/this\.spawnBoss\(\)/g, `this.spawner.spawnBoss(this.getSpawnerContext())`);
code = code.replace(/this\.scheduleNextSpawn\(\)/g, `this.spawner.scheduleNextSpawn(this.getSpawnerContext())`);
code = code.replace(/this\.spawnEnemy\(\)/g, `this.spawner.spawnEnemy(this.getSpawnerContext())`);
code = code.replace(/this\.spawnMinion\(([^,]+),\s*([^)]+)\)/g, `this.spawner.spawnMinion($1, $2, this.getSpawnerContext())`);
code = code.replace(/this\.dropItem\(([^,]+),\s*([^,]+),\s*([^,]+),\s*([^)]+)\)/g, `this.spawner.dropItem($1, $2, $3, $4, this.getSpawnerContext())`);
code = code.replace(/this\.triggerBattleDrop\(([^,]+),\s*([^,]+)(?:,\s*([^)]+))?\)/g, (match, p1, p2, p3) => {
    return `this.spawner.triggerBattleDrop(${p1}, ${p2}, ${p3 || 'false'}, this.getSpawnerContext())`;
});

// For spawnInterval clear
code = code.replace(/clearTimeout\(this\.spawnInterval\)/g, `this.spawner.stopSpawning()`);
code = code.replace(/if \(this\.spawnInterval\) this\.spawner\.stopSpawning\(\);/g, `this.spawner.stopSpawning();`);

// Remove the definitions manually using regex
code = code.replace(/  private createEnemyBody\([^)]*\): Matter\.Body \{[\s\S]*?\n  \}\r?\n\r?\n/m, '');
code = code.replace(/  private spawnBoss\(\) \{[\s\S]*?\n  \}\r?\n\r?\n/m, '');
code = code.replace(/  private scheduleNextSpawn\(\) \{[\s\S]*?\n  \}\r?\n\r?\n/m, '');
code = code.replace(/  private spawnEnemy\(\) \{[\s\S]*?\n  \}\r?\n\r?\n/m, '');
code = code.replace(/  private spawnMinion\([^)]*\) \{[\s\S]*?\n  \}\r?\n\r?\n/m, '');
code = code.replace(/  private dropItem\([^)]*\) \{[\s\S]*?\n  \}\r?\n\r?\n/m, '');
code = code.replace(/  public triggerBattleDrop\([^)]*\) \{[\s\S]*?\n  \}\r?\n\r?\n/m, '');

// Also remove `spawnInterval` property
code = code.replace(/  private spawnInterval: any;\r?\n/g, '');

fs.writeFileSync(path, code);
console.log('Successfully refactored Spawner logic');
