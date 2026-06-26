import { Injectable, inject } from '@angular/core';
import { GameStateService } from './game-state.service';
import { WorldStats } from '../models/game.models';
import { ABILITIES } from '../constants/game.constants';

export interface AiState {
    coins: number;
    stats: WorldStats;
    upgradesWeights: Record<string, number>;
    abilities: string[];
    lastTapTime: number;
    lastHoldTime: number;
    tapCooldown: number;
    holdCooldown: number;
    upgradeTokensBox: number;
    abilityTokensBox: number;
}

export interface BattleContext {
    gameState: GameStateService;
    bossMaxHealth: any;
    bossHealth: any;
    maxHealth: any;
    currentHealth: any;
    enemies: any[];
}

@Injectable({
  providedIn: 'root'
})
export class BattleAiService {
    
    public ai1!: AiState;
    public ai2!: AiState;
    public coinGainRate = 2;

    constructor(private gameState: GameStateService) {
        this.reset();
    }

    public reset() {
        this.ai1 = this.createDefaultAiState();
        this.ai2 = this.createDefaultAiState();
    }

    private createDefaultAiState(): AiState {
        return {
            coins: 0,
            stats: {} as WorldStats,
            upgradesWeights: {},
            abilities: [],
            lastTapTime: 0,
            lastHoldTime: 0,
            tapCooldown: 0,
            holdCooldown: 0,
            upgradeTokensBox: 0,
            abilityTokensBox: 0
        };
    }

    public tick(context: BattleContext) {
        this.ai1.coins += this.coinGainRate;
        this.tryPurchaseAiUpgrade('ai1', context);

        if (this.gameState.currentGameMode() === 'ai_vs_ai') {
            this.ai2.coins += this.coinGainRate;
            this.tryPurchaseAiUpgrade('ai2', context);
        }
    }

    public spendTokens(upgradeTokens: number, abilityTokens: number, target: 'ai1' | 'ai2', context: BattleContext) {
        const statOptions = ['maxHealth', 'speed', 'magnetism', 'damage', 'attackSpeed', 'attackRange', 'auraRadius', 'homingLevel'];
        const state = target === 'ai1' ? this.ai1 : this.ai2;
        
        for(let i=0; i<upgradeTokens; i++) {
            let totalWeight = 0;
            statOptions.forEach(opt => {
                if (state.upgradesWeights[opt] === undefined) state.upgradesWeights[opt] = 100;
                totalWeight += state.upgradesWeights[opt];
            });
            
            let rand = Math.random() * totalWeight;
            let selectedOpt = statOptions[0];
            for (let opt of statOptions) {
                rand -= state.upgradesWeights[opt];
                if (rand <= 0) {
                    selectedOpt = opt;
                    break;
                }
            }
            this.applyAiUpgrade(selectedOpt, target, context);
        }
        
        for(let i=0; i<abilityTokens; i++) {
            let totalWeight = 0;
            state.abilities.forEach(ab => {
                const opt = `ability_${ab}`;
                if (state.upgradesWeights[opt] === undefined) state.upgradesWeights[opt] = 100;
                totalWeight += state.upgradesWeights[opt];
            });
            
            let rand = Math.random() * totalWeight;
            let selectedOpt = state.abilities[0];
            for (let ab of state.abilities) {
                const opt = `ability_${ab}`;
                rand -= state.upgradesWeights[opt];
                if (rand <= 0) {
                    selectedOpt = ab;
                    break;
                }
            }
            this.applyAiUpgrade(`ability_${selectedOpt}`, target, context);
        }
    }

    public tryPurchaseAiUpgrade(target: 'ai1' | 'ai2', context: BattleContext) {
        const upgradeOptions = [
           { id: 'maxHealth', cost: 100 }, { id: 'speed', cost: 150 }, { id: 'magnetism', cost: 200 },
           { id: 'damage', cost: 250 }, { id: 'attackSpeed', cost: 300 }, { id: 'attackRange', cost: 250 },
           { id: 'auraRadius', cost: 400 }, { id: 'homingLevel', cost: 300 },
        ];
        
        const state = target === 'ai1' ? this.ai1 : this.ai2;
        
        const getAiCost = (stat: string, baseCost: number, step: number, offset: number) => {
            let currentVal = (state.stats as any)[stat] as number;
            if (stat === 'maxHealth') {
               currentVal = currentVal / 10;
            }
            const level = Math.max(0, (currentVal - offset) / step);
            return Math.floor(baseCost * Math.pow(1.5, level));
        };

        const aiCosts: Record<string, number> = {
            'maxHealth': getAiCost('maxHealth', 100, 10, 100),
            'speed': getAiCost('speed', 150, 0.1, 1),
            'magnetism': getAiCost('magnetism', 200, 0.1, 1),
            'damage': getAiCost('damage', 250, 1, 10),
            'attackSpeed': getAiCost('attackSpeed', 300, 0.1, 1),
            'attackRange': getAiCost('attackRange', 250, 50, 400),
            'auraRadius': getAiCost('auraRadius', 400, 10, 250),
            'homingLevel': getAiCost('homingLevel', 300, 1, 0),
        };

        state.abilities.forEach(ab => {
            const level = state.stats.unlockedAbilities[ab]?.level || 1;
            const baseAbilityCost = ABILITIES[ab].upgradeCost;
            aiCosts[`ability_${ab}`] = Math.floor(baseAbilityCost * Math.pow(1.5, level - 1));
            upgradeOptions.push({ id: `ability_${ab}`, cost: baseAbilityCost });
        });

        const maxCost = Math.max(...Object.values(aiCosts));
        const fullPickOverride = state.coins >= maxCost * 1.5;

        let boughtSomething = true;
        let attempts = 0;
        
        while (boughtSomething && attempts < 3) {
            boughtSomething = false;
            attempts++;
            
            let totalWeight = 0;
            const validOptions = upgradeOptions.filter(opt => {
                if (state.upgradesWeights[opt.id] === undefined) state.upgradesWeights[opt.id] = 100;
                return state.upgradesWeights[opt.id] > 0;
            });
            
            if (validOptions.length === 0) break;
            
            validOptions.forEach(opt => totalWeight += fullPickOverride ? 100 : state.upgradesWeights[opt.id]);
            let rand = Math.random() * totalWeight;
            let selectedOpt = validOptions[0].id;
            
            for (let opt of validOptions) {
                rand -= (fullPickOverride ? 100 : state.upgradesWeights[opt.id]);
                if (rand <= 0) {
                    selectedOpt = opt.id;
                    break;
                }
            }
            
            const actualCost = aiCosts[selectedOpt];
            if (state.coins >= actualCost) {
                state.coins -= actualCost;
                boughtSomething = true;
                
                if (selectedOpt.startsWith('ability_')) {
                    state.abilityTokensBox++;
                } else {
                    state.upgradeTokensBox++;
                }
                this.applyAiUpgrade(selectedOpt, target, context);
            }
        }
    }

    private applyAiUpgrade(selectedOpt: string, target: 'ai1' | 'ai2', context: BattleContext) {
        const state = target === 'ai1' ? this.ai1 : this.ai2;

        if (selectedOpt.startsWith('ability_')) {
            const abId = selectedOpt.replace('ability_', '');
            if (!state.stats.unlockedAbilities[abId]) {
                state.stats.unlockedAbilities[abId] = { level: 1, modifiers: {} };
            }
            state.stats.unlockedAbilities[abId].level++;
            state.stats.unlockedAbilities[abId].modifiers = context.gameState.generateAbilityUpgrade(abId, state.stats.unlockedAbilities[abId].level, state.stats.unlockedAbilities[abId].modifiers);
        } else {
            let step = 0;
            if (selectedOpt === 'maxHealth') {
                step = 10;
                if (target === 'ai1') {
                    context.bossMaxHealth.set(state.stats.maxHealth + step);
                    context.bossHealth.update((h: number) => h + step);
                    
                    const aiBody = context.enemies.find((e: any) => e.label === 'enemy' && e.plugin['data']?.type === 'enemy_phoenix');
                    if (aiBody) {
                        aiBody.plugin['data'].maxHealth += step;
                        aiBody.plugin['data'].health += step;
                    }
                } else {
                    context.maxHealth.update((h: number) => h + step);
                    context.currentHealth.update((h: number) => h + step);
                }
            }
            if (selectedOpt === 'speed') step = 0.1;
            if (selectedOpt === 'magnetism') step = 0.1;
            if (selectedOpt === 'damage') step = 1;
            if (selectedOpt === 'attackSpeed') step = 0.1;
            if (selectedOpt === 'attackRange') step = 50;
            if (selectedOpt === 'auraRadius') step = 10;
            if (selectedOpt === 'homingLevel') step = 1;
            
            (state.stats as any)[selectedOpt] += step;
            
            if (selectedOpt === 'speed' && target === 'ai1') {
                context.gameState.aiPhoenixSpeed.set(state.stats.speed);
            }
            if (selectedOpt === 'speed' && target === 'ai2') {
                context.gameState.ai2PhoenixSpeed.set(state.stats.speed);
            }
        }
        
        state.upgradesWeights[selectedOpt] = Math.max(10, (state.upgradesWeights[selectedOpt] || 100) - 20);
    }
}
