import { Component, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AudioService } from '../../services/audio.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="settings-modal" (click)="onBackdropClick($event)">
        <div class="settings-content window-panel">
            <h2 class="title text-4xl mb-6">SETTINGS</h2>
            
            <div class="sliders-container flex flex-col gap-4">
                <div class="slider-group">
                    <div class="flex justify-between">
                        <label>Master Volume</label>
                        <span>{{(audio.masterVolume() * 100).toFixed(0)}}%</span>
                    </div>
                    <input type="range" min="0" max="1" step="0.05" 
                           [value]="audio.masterVolume()" 
                           (input)="updateVolume('masterVolume', $event)" 
                           class="w-full">
                </div>
                
                <div class="slider-group">
                    <div class="flex justify-between">
                        <label>Menu / BGM Volume</label>
                        <span>{{(audio.menuVolume() * 100).toFixed(0)}}%</span>
                    </div>
                    <input type="range" min="0" max="1" step="0.05" 
                           [value]="audio.menuVolume()" 
                           (input)="updateVolume('menuVolume', $event)" 
                           class="w-full">
                </div>
                
                <div class="slider-group">
                    <div class="flex justify-between">
                        <label>Attack / SFX Volume</label>
                        <span>{{(audio.attackVolume() * 100).toFixed(0)}}%</span>
                    </div>
                    <input type="range" min="0" max="1" step="0.05" 
                           [value]="audio.attackVolume()" 
                           (input)="updateVolume('attackVolume', $event)" 
                           class="w-full">
                </div>
                
                <div class="slider-group">
                    <div class="flex justify-between">
                        <label class="text-red-400">Intense (Low HP) Volume</label>
                        <span class="text-red-400">{{(audio.intenseVolume() * 100).toFixed(0)}}%</span>
                    </div>
                    <input type="range" min="0" max="1" step="0.05" 
                           [value]="audio.intenseVolume()" 
                           (input)="updateVolume('intenseVolume', $event)" 
                           class="w-full intense-slider">
                </div>
            </div>
            
            <button class="btn btn-primary mt-8 w-full" (click)="close.emit()">DONE</button>
        </div>
    </div>
  `,
  styles: [`
    .settings-modal {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex; justify-content: center; align-items: center;
        z-index: 1000;
        backdrop-filter: blur(5px);
    }
    .settings-content {
        background: linear-gradient(145deg, #1a1a24, #0d0d14);
        padding: 2rem;
        border-radius: 1rem;
        border: 2px solid #ffaa00;
        width: 90%; max-width: 400px;
        box-shadow: 0 0 30px rgba(255, 170, 0, 0.2);
    }
    .title {
        color: #ffaa00;
        text-align: center;
        font-weight: 800;
        text-shadow: 0 0 10px rgba(255,170,0,0.5);
    }
    .slider-group label {
        font-weight: bold;
        color: #ccc;
    }
    .slider-group span {
        font-weight: bold;
    }
    input[type=range] {
        -webkit-appearance: none;
        background: #333;
        height: 8px;
        border-radius: 4px;
        outline: none;
        margin-top: 0.5rem;
    }
    input[type=range]::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 20px; height: 20px;
        background: #ffaa00;
        border-radius: 50%;
        cursor: pointer;
        box-shadow: 0 0 10px #ffaa00;
    }
    .intense-slider::-webkit-slider-thumb {
        background: #ff4444;
        box-shadow: 0 0 10px #ff4444;
    }
    .btn {
        background: linear-gradient(90deg, #ff8800, #ffaa00);
        color: white; font-weight: bold;
        padding: 1rem; border-radius: 0.5rem;
        text-transform: uppercase; letter-spacing: 2px;
        border: none; cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s;
    }
    .btn:hover {
        transform: scale(1.05);
        box-shadow: 0 0 20px rgba(255,170,0,0.4);
    }
  `]
})
export class SettingsComponent {
  public audio = inject(AudioService);
  @Output() close = new EventEmitter<void>();

  updateVolume(channel: 'masterVolume'|'menuVolume'|'attackVolume'|'intenseVolume', event: any) {
      const val = parseFloat(event.target.value);
      this.audio[channel].set(val);
      this.audio.saveSettings();
  }

  onBackdropClick(event: MouseEvent) {
      if ((event.target as HTMLElement).classList.contains('settings-modal')) {
          this.close.emit();
      }
  }
}
