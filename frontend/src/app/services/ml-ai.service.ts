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
    useDrill: number;
    useBurst: number;
    useFire: number;
    useAura: number;
    useTurret: number;
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

    constructor() {
        this.initModel();
        this.loadGlobalWeights();
    }

    private initModel() {
        this.model = tf.sequential();
        this.model.add(tf.layers.dense({ units: 64, activation: 'relu', inputShape: [18] }));
        this.model.add(tf.layers.dense({ units: 64, activation: 'relu' }));
        this.model.add(tf.layers.dense({ units: 7, activation: 'sigmoid' }));
        this.model.compile({ optimizer: this.optimizer, loss: 'meanSquaredError' });
    }

    private loadGlobalWeights() {
        this.http.get<{weights: any, version: number}>(`${environment.apiUrl}/api/ai/weights`).subscribe({
            next: (res) => {
                if (res.weights && Array.isArray(res.weights) && res.weights.length > 0) {
                    this.setWeightsFromArray(res.weights);
                    this.isTrained = true;
                    console.log('Loaded global TFJS weights v' + res.version);
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
        try {
            const currentWeights = this.model.getWeights();
            let newWeights: tf.Tensor[] = [];
            let offset = 0;
            for (let w of currentWeights) {
                const size = w.size;
                const slice = arr.slice(offset, offset + size);
                newWeights.push(tf.tensor(slice, w.shape, w.dtype));
                offset += size;
            }
            this.model.setWeights(newWeights);
        } catch (err) {
            console.error('Failed to load TFJS array geometry, sticking to random weights', err);
        }
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
                useDrill: Math.random(),
                useBurst: Math.random(),
                useFire: Math.random(),
                useAura: Math.random(),
                useTurret: Math.random()
            };
        }
        
        return tf.tidy(() => {
            const input = tf.tensor2d([this.stateToArray(state)]);
            const output = this.model.predict(input) as tf.Tensor;
            const data = output.dataSync();
            
            const explore = Math.random() < 0.05;

            return {
                targetX: (explore ? Math.random() : data[0]) * window.innerWidth,
                targetY: (explore ? Math.random() : data[1]) * window.innerHeight,
                useDrill: explore ? Math.random() : data[2],
                useBurst: explore ? Math.random() : data[3],
                useFire: explore ? Math.random() : data[4],
                useAura: explore ? Math.random() : data[5],
                useTurret: explore ? Math.random() : data[6]
            };
        });
    }

    public addReward(r: number) {
        // Find last experience and boost it
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
            let ud = exp.action.useDrill;
            let ub = exp.action.useBurst;
            let uf = exp.action.useFire;
            let ua = exp.action.useAura;
            let ut = exp.action.useTurret;
            
            if (exp.reward < 0) {
                tx = 1.0 - tx;
                ty = 1.0 - ty;
                ud = ud > 0.5 ? 0 : 1;
                ub = ub > 0.5 ? 0 : 1;
                uf = uf > 0.5 ? 0 : 1;
                ua = ua > 0.5 ? 0 : 1;
                ut = ut > 0.5 ? 0 : 1;
            } else if (exp.reward > 0) {
                // Keep exactly what we did to reinforce it
            }
            outputs.push([tx, ty, ud, ub, uf, ua, ut]);
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
