import { Injectable, signal } from '@angular/core';
import * as brain from 'brain.js';
import * as Matter from 'matter-js';

export interface MLState {
    aiX: number;
    aiY: number;
    playerX: number;
    playerY: number;
    threatX: number;
    threatY: number;
}

export interface MLAction {
    targetX: number;
    targetY: number;
}

interface Experience {
    state: MLState;
    action: MLAction;
    reward: number;
}

@Injectable({ providedIn: 'root' })
export class MlAiService {
    private net = new brain.NeuralNetwork({ hiddenLayers: [6, 6] });
    private isTrained = false;
    private memory: Experience[] = [];
    private maxMemory = 100;
    
    // Some pre-training so it isn't completely stupid at start
    constructor() {
        this.preTrain();
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
            threatY: s.threatY / h
        };
    }
    
    private normalizeAction(a: MLAction) {
        return {
            targetX: a.targetX / window.innerWidth,
            targetY: a.targetY / window.innerHeight
        };
    }
    
    private denormalizeAction(output: any): MLAction {
        return {
            targetX: output.targetX * window.innerWidth,
            targetY: output.targetY * window.innerHeight
        };
    }

    private preTrain() {
        const data = [];
        const w = window.innerWidth || 1920;
        const h = window.innerHeight || 1080;
        
        // Basic pre-training: If no threat, move towards player.
        for(let i=0; i<20; i++) {
            data.push({
                input: { aiX: 0.1, aiY: 0.1, playerX: 0.9, playerY: 0.9, threatX: 0, threatY: 0 },
                output: { targetX: 0.9, targetY: 0.9 }
            });
            data.push({
                input: { aiX: 0.9, aiY: 0.9, playerX: 0.1, playerY: 0.1, threatX: 0, threatY: 0 },
                output: { targetX: 0.1, targetY: 0.1 }
            });
            // Dodge threat
            data.push({
                input: { aiX: 0.5, aiY: 0.5, playerX: 0.5, playerY: 0.8, threatX: 0.5, threatY: 0.55 },
                output: { targetX: 0.1, targetY: 0.5 } // Flee sideways
            });
        }
        
        this.net.train(data, { iterations: 100, errorThresh: 0.05 });
        this.isTrained = true;
    }

    public predictTarget(state: MLState): MLAction {
        if (!this.isTrained) return { targetX: state.playerX, targetY: state.playerY };
        const input = this.normalizeState(state);
        const output = this.net.run(input) as any;
        return this.denormalizeAction(output);
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
