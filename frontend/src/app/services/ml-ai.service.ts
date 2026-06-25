import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import * as brain from 'brain.js';
import * as Matter from 'matter-js';

export interface MLState {
    aiX: number;
    aiY: number;
    playerX: number;
    playerY: number;
    threatX: number;
    threatY: number;
    hpRatio: number;
    playerHpRatio: number;
}

export interface MLAction {
    targetX: number;
    targetY: number;
    useDrill: number;
    useBurst: number;
    useFire: number;
    useAura: number;
    useTurret: number;
}

interface Experience {
    state: MLState;
    action: MLAction;
    reward: number;
}

@Injectable({ providedIn: 'root' })
export class MlAiService {
    private net = new brain.NeuralNetwork({ hiddenLayers: [12, 12] });
    private isTrained = false;
    private memory: Experience[] = [];
    private maxMemory = 100;
    private positionHistory: {x: number, y: number}[] = [];
    private actionHistory: MLAction[] = [];
    private historySize = 60; // 1 second at 60fps
    private http = inject(HttpClient);

    constructor() {
        this.loadGlobalWeights();
    }

    private loadGlobalWeights() {
        this.http.get<{weights: any, version: number}>(`${environment.apiUrl}/api/ai/weights`).subscribe({
            next: (res) => {
                this.net.fromJSON(res.weights);
                this.isTrained = true;
                console.log('Loaded global AI weights v' + res.version);
            },
            error: (err) => {
                console.log('No global weights found, falling back to preTrain');
                if (!this.isTrained) this.preTrain();
            }
        });
    }

    public pushGlobalWeights() {
        if (!this.isTrained) return;
        this.http.post(`${environment.apiUrl}/api/ai/weights`, { weights: this.net.toJSON() }).subscribe({
            next: () => console.log('Successfully pushed new weights globally!'),
            error: (err) => console.error('Failed to push global weights', err)
        });
    }

    public downloadWeights() {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.net.toJSON()));
        const dlAnchorElem = document.createElement('a');
        dlAnchorElem.setAttribute("href", dataStr);
        dlAnchorElem.setAttribute("download", "phoenix_ml_weights.json");
        document.body.appendChild(dlAnchorElem);
        dlAnchorElem.click();
        dlAnchorElem.remove();
    }
    
    private normalizeState(s: MLState) {
        const w = window.innerWidth;
        const h = window.innerHeight;
        return {
            aiX: s.aiX / w,
            aiY: s.aiY / h,
            playerX: s.playerX / w,
            playerY: s.playerY / h,
            threatX: s.threatX / w,
            threatY: s.threatY / h,
            hpRatio: s.hpRatio,
            playerHpRatio: s.playerHpRatio
        };
    }
    
    private normalizeAction(a: MLAction) {
        return {
            targetX: a.targetX / window.innerWidth,
            targetY: a.targetY / window.innerHeight,
            useDrill: a.useDrill,
            useBurst: a.useBurst,
            useFire: a.useFire,
            useAura: a.useAura,
            useTurret: a.useTurret
        };
    }
    
    private denormalizeAction(output: any): MLAction {
        return {
            targetX: output.targetX * window.innerWidth,
            targetY: output.targetY * window.innerHeight,
            useDrill: output.useDrill || 0,
            useBurst: output.useBurst || 0,
            useFire: output.useFire || 0,
            useAura: output.useAura || 0,
            useTurret: output.useTurret || 0
        };
    }

    private preTrain() {
        const data = [];
        const w = window.innerWidth || 1920;
        const h = window.innerHeight || 1080;
        
        // Basic pre-training: If no threat, move towards player.
        for(let i=0; i<20; i++) {
            data.push({
                input: { aiX: 0.1, aiY: 0.1, playerX: 0.9, playerY: 0.9, threatX: 0, threatY: 0, hpRatio: 1, playerHpRatio: 1 },
                output: { targetX: 0.9, targetY: 0.9, useDrill: 0, useBurst: 0, useFire: 0, useAura: 0, useTurret: 0 }
            });
            data.push({
                input: { aiX: 0.9, aiY: 0.9, playerX: 0.1, playerY: 0.1, threatX: 0, threatY: 0, hpRatio: 1, playerHpRatio: 1 },
                output: { targetX: 0.1, targetY: 0.1, useDrill: 1, useBurst: 0, useFire: 0, useAura: 0, useTurret: 0 }
            });
            // Dodge threat and defensive
            data.push({
                input: { aiX: 0.5, aiY: 0.5, playerX: 0.5, playerY: 0.8, threatX: 0.5, threatY: 0.55, hpRatio: 0.2, playerHpRatio: 1 },
                output: { targetX: 0.1, targetY: 0.5, useDrill: 0, useBurst: 0, useFire: 0, useAura: 1, useTurret: 1 } // Flee sideways and use defensive skills
            });
            // Aggressive when player is low
            data.push({
                input: { aiX: 0.5, aiY: 0.5, playerX: 0.5, playerY: 0.8, threatX: 0, threatY: 0, hpRatio: 1, playerHpRatio: 0.2 },
                output: { targetX: 0.5, targetY: 0.8, useDrill: 1, useBurst: 1, useFire: 1, useAura: 0, useTurret: 0 }
            });
        }
        
        this.net.train(data, { iterations: 100, errorThresh: 0.05 });
        this.isTrained = true;
    }

    public predictTarget(state: MLState): MLAction {
        if (!this.isTrained) return { targetX: state.playerX, targetY: state.playerY, useDrill: 0, useBurst: 0, useFire: 0, useAura: 0, useTurret: 0 };
        const input = this.normalizeState(state);
        const output = this.net.run(input) as any;
        const action = this.denormalizeAction(output);
        
        // Track history for penalties
        this.positionHistory.push({ x: state.aiX, y: state.aiY });
        if (this.positionHistory.length > this.historySize) this.positionHistory.shift();
        
        this.actionHistory.push(action);
        if (this.actionHistory.length > this.historySize) this.actionHistory.shift();
        
        return action;
    }
    
    public checkAdvancedPenalties(state: MLState, action: MLAction) {
        if (this.positionHistory.length < this.historySize) return;

        // 1. Detect Camping (variance in position over last 60 frames)
        let sumX = 0, sumY = 0;
        this.positionHistory.forEach(p => { sumX += p.x; sumY += p.y; });
        const avgX = sumX / this.historySize;
        const avgY = sumY / this.historySize;
        
        let varX = 0, varY = 0;
        this.positionHistory.forEach(p => {
            varX += Math.pow(p.x - avgX, 2);
            varY += Math.pow(p.y - avgY, 2);
        });
        
        const variance = (varX + varY) / this.historySize;
        if (variance < 100) { // Extremely still
            this.recordExperience(state, action, -5);
            this.trainOnMemory();
            this.positionHistory = []; // clear to prevent continuous spam
            return;
        }
        
        // 2. Detect tight circles (rapid extreme changes in action target direction)
        let dirChanges = 0;
        for (let i = 1; i < this.actionHistory.length; i++) {
            const prev = this.actionHistory[i - 1];
            const curr = this.actionHistory[i];
            const dist = Math.hypot(curr.targetX - prev.targetX, curr.targetY - prev.targetY);
            if (dist > window.innerWidth / 2) {
                dirChanges++;
            }
        }
        
        // If it wildly changed targets across the screen more than 10 times in 1 second
        if (dirChanges > 10) {
            this.recordExperience(state, action, -5);
            this.trainOnMemory();
            this.actionHistory = []; // clear
        }
    }
    
    public addReward(reward: number) {
        if (this.memory.length > 0) {
            this.memory[this.memory.length - 1].reward += reward;
            if (this.memory[this.memory.length - 1].reward >= 5 || this.memory[this.memory.length - 1].reward <= -5) {
                this.trainOnMemory();
            }
        }
    }
    
    public recordExperience(state: MLState, action: MLAction, reward: number) {
        this.memory.push({ state, action, reward });
        if (this.memory.length > this.maxMemory) {
            this.memory.shift();
        }
    }
    
    public trainOnMemory() {
        if (this.memory.length < 10) return;
        
        // Convert memory to training data
        // For negative rewards, we flip the action vector
        const trainingData = this.memory.map(exp => {
            let output = this.normalizeAction(exp.action);
            if (exp.reward < 0) {
                // Learn to do the OPPOSITE
                output.targetX = 1.0 - output.targetX;
                output.targetY = 1.0 - output.targetY;
                output.useDrill = output.useDrill > 0.5 ? 0 : 1;
                output.useBurst = output.useBurst > 0.5 ? 0 : 1;
                output.useFire = output.useFire > 0.5 ? 0 : 1;
                output.useAura = output.useAura > 0.5 ? 0 : 1;
                output.useTurret = output.useTurret > 0.5 ? 0 : 1;
            }
            return {
                input: this.normalizeState(exp.state),
                output: output
            };
        });
        
        // Fast incremental training
        this.net.train(trainingData, { iterations: 20 });
        this.memory = []; // Clear memory after training
    }
}
