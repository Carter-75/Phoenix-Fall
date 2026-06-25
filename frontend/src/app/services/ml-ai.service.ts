import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import * as tf from '@tensorflow/tfjs';

export interface MLState {
    aiX: number; aiY: number;
    aiVelX: number; aiVelY: number;
    playerX: number; playerY: number;
    playerVelX: number; playerVelY: number;
    hpRatio: number; playerHpRatio: number;
    radar0: number; radar1: number; radar2: number; radar3: number;
    radar4: number; radar5: number; radar6: number; radar7: number;
}

export interface MLAction {
    targetX: number;
    targetY: number;
    abilityTriggers: number[]; // 20 slots
}

export interface Experience {
    state: MLState;
    action: MLAction;
    reward: number;
}

@Injectable({ providedIn: 'root' })
export class MlAiService {
    private model!: tf.Sequential;
    private optimizer = tf.train.adam(0.01);
    public isTrained = false;
    private http = inject(HttpClient);
    
    private replayBuffer: Experience[] = [];
    private maxBufferSize = 500;
    
    // X, Y, plus 20 generic ability slots
    private readonly OUTPUT_UNITS = 2 + 20;

    constructor() {
        this.initModel();
        this.loadGlobalWeights();
    }

    private initModel() {
        this.model = tf.sequential();
        this.model.add(tf.layers.dense({ units: 64, activation: 'relu', inputShape: [18] }));
        this.model.add(tf.layers.dense({ units: 64, activation: 'relu' }));
        this.model.add(tf.layers.dense({ units: this.OUTPUT_UNITS, activation: 'sigmoid' }));
        this.model.compile({ optimizer: this.optimizer, loss: 'meanSquaredError' });
    }

    private loadGlobalWeights() {
        this.http.get<{weights: any, version: number}>(`${environment.apiUrl}/api/ai/weights`).subscribe({
            next: (res) => {
                if (res.weights && Array.isArray(res.weights) && res.weights.length > 0) {
                    try {
                        this.setWeightsFromArray(res.weights);
                        this.isTrained = true;
                        console.log('Loaded global TFJS weights v' + res.version);
                    } catch (e) {
                        console.warn('Global weights shape mismatch! Starting fresh for dynamic shape compatibility.');
                        this.isTrained = true;
                    }
                } else {
                    this.isTrained = true; 
                    console.log('No valid weights found, starting fresh with random TFJS weights');
                }
            },
            error: (err) => {
                console.log('No global weights found, starting fresh');
                this.isTrained = true;
            }
        });
    }

    public pushGlobalWeights() {
        if (!this.isTrained) return;
        const weightsArr = this.getWeightsAsArray();
        this.http.post(`${environment.apiUrl}/api/ai/weights`, { weights: weightsArr }).subscribe({
            next: () => console.log('Successfully pushed TFJS weights globally!'),
            error: (err) => console.error('Failed to push global weights', err)
        });
    }

    private getWeightsAsArray(): number[] {
        const weights = this.model.getWeights();
        let arr: number[] = [];
        for (let w of weights) {
            const data = w.dataSync();
            arr.push(...Array.from(data));
        }
        return arr;
    }

    private setWeightsFromArray(arr: number[]) {
        const currentWeights = this.model.getWeights();
        let newWeights: tf.Tensor[] = [];
        let offset = 0;
        for (let w of currentWeights) {
            const size = w.size;
            const slice = arr.slice(offset, offset + size);
            if (slice.length !== size) throw new Error('Shape mismatch during array inflation');
            newWeights.push(tf.tensor(slice, w.shape, w.dtype));
            offset += size;
        }
        this.model.setWeights(newWeights);
    }

    public downloadWeights() {
        const arr = this.getWeightsAsArray();
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(arr));
        const dlAnchorElem = document.createElement('a');
        dlAnchorElem.setAttribute("href", dataStr);
        dlAnchorElem.setAttribute("download", "phoenix_tfjs_weights.json");
        document.body.appendChild(dlAnchorElem);
        dlAnchorElem.click();
        dlAnchorElem.remove();
    }
    
    private stateToArray(s: MLState): number[] {
        return [
            s.aiX, s.aiY, s.aiVelX, s.aiVelY,
            s.playerX, s.playerY, s.playerVelX, s.playerVelY,
            s.hpRatio, s.playerHpRatio,
            s.radar0, s.radar1, s.radar2, s.radar3,
            s.radar4, s.radar5, s.radar6, s.radar7
        ];
    }
    
    public predictTarget(state: MLState): MLAction {
        if (!this.isTrained) {
            return {
                targetX: state.playerX * window.innerWidth,
                targetY: state.playerY * window.innerHeight,
                abilityTriggers: Array.from({length: 20}, () => Math.random())
            };
        }
        
        return tf.tidy(() => {
            const input = tf.tensor2d([this.stateToArray(state)]);
            const output = this.model.predict(input) as tf.Tensor;
            const data = output.dataSync();
            
            const explore = Math.random() < 0.05;
            
            let abilities: number[] = [];
            for (let i = 0; i < 20; i++) {
                abilities.push(explore ? Math.random() : data[2 + i]);
            }

            return {
                targetX: (explore ? Math.random() : data[0]) * window.innerWidth,
                targetY: (explore ? Math.random() : data[1]) * window.innerHeight,
                abilityTriggers: abilities
            };
        });
    }

    public addReward(r: number) {
        if (this.replayBuffer.length > 0) {
            this.replayBuffer[this.replayBuffer.length - 1].reward += r;
        }
    }

    public recordExperience(state: MLState, action: MLAction, reward: number) {
        this.replayBuffer.push({ state, action, reward });
        if (this.replayBuffer.length > this.maxBufferSize) {
            this.replayBuffer.shift(); 
        }
    }

    public async trainOnMemory() {
        if (this.replayBuffer.length === 0) return;
        
        const inputs: number[][] = [];
        const outputs: number[][] = [];
        
        for (let exp of this.replayBuffer) {
            inputs.push(this.stateToArray(exp.state));
            
            let tx = exp.action.targetX / window.innerWidth;
            let ty = exp.action.targetY / window.innerHeight;
            
            let abs = [...exp.action.abilityTriggers];
            
            if (exp.reward < 0) {
                tx = 1.0 - tx;
                ty = 1.0 - ty;
                for (let i = 0; i < abs.length; i++) {
                    abs[i] = abs[i] > 0.5 ? 0 : 1;
                }
            }
            outputs.push([tx, ty, ...abs]);
        }
        
        const x = tf.tensor2d(inputs);
        const y = tf.tensor2d(outputs);
        
        await this.model.fit(x, y, {
            epochs: 1,
            batchSize: 32,
            shuffle: true
        });
        
        x.dispose();
        y.dispose();
        
        this.replayBuffer = [];
    }
}
