const fs = require('fs');
const path = 'c:/Users/carte/OneDrive/Desktop/Code/Apps/New-Project-Script/Phoenix-Fall/frontend/src/app/pages/game/game.component.ts';
let code = fs.readFileSync(path, 'utf8');

// 1. AI 2 Rebirth Health Bug
// Replace: this.currentHealth.set(this.maxHealth());
// With: this.currentHealth.set(this.battleAi.ai2.stats.maxHealth);
// Note: It's inside `if (this.battleAi.ai2.abilities.includes('rebirth'))`
code = code.replace(/this\.currentHealth\.set\(this\.maxHealth\(\)\);/g, "this.currentHealth.set(this.battleAi.ai2.stats.maxHealth);");

// 2. AI 1 Rebirth Animation Glitch
// Inside animateEntrance, we need to make sure we don't clear the position if the entrance was interrupted
// Let's add a check for isDead() and gameEnded(). Actually, they already return if dead.
// Wait, `else this.gameState.aiPhoenixOverridePosition.set(null);`
// If we die during rebirth, the animation loops but stops returning.
// What if we just clear it inside `ngOnDestroy` and `resetCooldowns()`?
// It's already cleared in `resetCooldowns`: `this.gameState.aiPhoenixOverridePosition.set(null);`
// So it shouldn't get stuck. But let's verify.
// In `animateEntrance`, if `this.isDead() || this.gameEnded()` returns early, it NEVER sets it to null. 
// BUT `resetCooldowns()` clears it! And `resetCooldowns` runs on initBattleMode.
// Wait, if it returns early, does it leave the override active during the NEXT game? Yes, if resetCooldowns isn't called until later.
// Let's ensure `resetCooldowns` definitely clears it. Wait, it already has: `this.gameState.aiPhoenixOverridePosition.set(null);`
// Is there a bug? Let's just fix the teleport: the animation was visually buggy.
// Let's add a flag `(this as any).aiEntranceAnimId` to cancel the previous animation.
code = code.replace(/requestAnimationFrame\(animateEntrance\);/g, "(this as any).aiEntranceAnimId = requestAnimationFrame(animateEntrance);");
code = code.replace(/if \(progress < 1\) requestAnimationFrame\(animateEntrance\);/g, "if (progress < 1) (this as any).aiEntranceAnimId = requestAnimationFrame(animateEntrance);");
code = code.replace(/this\.gameState\.aiPhoenixOverridePosition\.set\(null\);/g, "this.gameState.aiPhoenixOverridePosition.set(null); cancelAnimationFrame((this as any).aiEntranceAnimId);");

// 3. Fix leaked intervals
// `(this as any).aiAbilityInterval` was being cleared, but where was it set?
// Let's remove `(this as any).aiAbilityInterval` entirely and just use normal cooldown checks in the AI ML loop.
// Actually, `handleAiAbilities` is removed? No, the AI uses `mlAction.useTap > 0.5`.
// Wait, `mlAction` comes from the neural net:
// `const mlAction = this.mlAi.act(...)`
// `if (mlAction.useTap > 0.5 && tapAb) { const cd = this.triggerAbility(tapAb,...); eAny.tapCooldown = cd; }`
// The spam happens because `eAny.tapCooldown = cd` sets it on `eAny`, but the cooldown check is:
// `if ((!eAny.holdAbilityEndTime || now >= eAny.holdAbilityEndTime) && now - this.battleAi.ai1.lastTapTime > (1500 / (this.battleAi.ai1.stats?.attackSpeed || 1)))`
// This check only limits the AI's *auto-attacks* (projectiles)! It does NOT check `eAny.tapCooldown` before triggering abilities!
// Let's add the cooldown check!
let abilityLogic = `
                  if (mlAction.useTap > 0.5 && tapAb && (!eAny.lastTapAbilityTime || now >= eAny.lastTapAbilityTime + (eAny.tapCooldown || 0))) {
                          const cd = this.triggerAbility(tapAb, enemy, mlAction.targetX, mlAction.targetY, this.battleAi.ai1.stats, 'enemy');
                          eAny.lastTapAbilityTime = now;
                          eAny.tapCooldown = cd;
                  }
                  
                  if (mlAction.useHold > 0.5 && holdAb && (!eAny.lastHoldAbilityTime || now >= eAny.lastHoldAbilityTime + (eAny.holdCooldown || 0))) {
                          const cd = this.triggerAbility(holdAb, enemy, mlAction.targetX, mlAction.targetY, this.battleAi.ai1.stats, 'enemy');
                          eAny.lastHoldAbilityTime = now;
                          eAny.holdCooldown = cd;
                  }
`;
code = code.replace(/if \(mlAction\.useTap > 0\.5 && tapAb\) \{[\s\S]*?eAny\.holdCooldown = cd;\r?\n\s*\}/m, abilityLogic);

// AI2 (Player Bot) Ability spam fix
// In AI vs AI, AI2 acts for the player.
let ai2AbilityLogic = `
                  if (mlAction2.useTap > 0.5 && tapAb2 && (!this.battleAi.ai2.lastTapTime || now >= this.battleAi.ai2.lastTapTime + (this.battleAi.ai2.tapCooldown || 0))) {
                      const cd = this.triggerAbility(tapAb2, this.playerBody, mlAction2.targetX, mlAction2.targetY, this.battleAi.ai2.stats, 'player');
                      this.battleAi.ai2.lastTapTime = now;
                      this.battleAi.ai2.tapCooldown = cd;
                  }
                  
                  if (mlAction2.useHold > 0.5 && holdAb2 && (!this.battleAi.ai2.lastHoldTime || now >= this.battleAi.ai2.lastHoldTime + (this.battleAi.ai2.holdCooldown || 0))) {
                      const cd = this.triggerAbility(holdAb2, this.playerBody, mlAction2.targetX, mlAction2.targetY, this.battleAi.ai2.stats, 'player');
                      this.battleAi.ai2.lastHoldTime = now;
                      this.battleAi.ai2.holdCooldown = cd;
                  }
`;
code = code.replace(/if \(mlAction2\.useTap > 0\.5 && tapAb2\) \{[\s\S]*?this\.battleAi\.ai2\.holdCooldown = cd;\r?\n\s*\}/m, ai2AbilityLogic);


fs.writeFileSync(path, code);
console.log('Fixed Battle mode AI bugs');
