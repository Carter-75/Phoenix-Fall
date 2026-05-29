import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AudioService {
  public masterVolume = signal<number>(1.0);
  public menuVolume = signal<number>(1.0);
  public attackVolume = signal<number>(1.0);
  public intenseVolume = signal<number>(1.0);
  public sfxVolume = signal<number>(1.0);
  
  public onWorldBgmEnded = signal<boolean>(false);
  public onIntenseBgmEnded = signal<boolean>(false);

  private currentBgm: HTMLAudioElement | null = null;
  public menuBgm = new Audio('assets/audio/menu_bgm.wav');
  public worldBgm = new Audio('assets/audio/world_1_bgm.wav');
  public intenseBgm = new Audio('assets/audio/world_1_intense_bgm.wav');
  
  private sfxShoot = new Audio('assets/audio/shoot.wav');
  private sfxHit = new Audio('assets/audio/hit.wav');
  private sfxExplosion = new Audio('assets/audio/explosion.wav');
  private sfxHeal = new Audio('assets/audio/heal.wav');
  private sfxBuy = new Audio('assets/audio/buy.wav');
  private sfxClick = new Audio('assets/audio/click.wav');

  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array | null = null;
  private sourceMap = new Map<HTMLAudioElement, MediaElementAudioSourceNode>();

  constructor() {
    this.menuBgm.loop = false;
    this.worldBgm.loop = false;
    this.intenseBgm.loop = false;

    const setupLoop = (audio: HTMLAudioElement) => {
        let isFadingOutForLoop = false;
        audio.addEventListener('play', () => isFadingOutForLoop = false);
        audio.addEventListener('timeupdate', () => {
            if (audio.duration && audio.currentTime >= audio.duration - 0.6 && !isFadingOutForLoop && this.currentBgm === audio) {
                isFadingOutForLoop = true;
                this.fadeAudio(true, 500, false); // Fade out but don't pause so 'ended' fires
            }
        });
        audio.addEventListener('ended', () => {
            isFadingOutForLoop = false;
            if (this.currentBgm === audio) {
                audio.currentTime = 0;
                audio.volume = 0;
                audio.play().then(() => this.fadeAudio(false, 500)).catch(() => {});
            }
        });
    };

    setupLoop(this.menuBgm);
    setupLoop(this.worldBgm);
    setupLoop(this.intenseBgm);

    // Unified Audio Unlock for Mobile Browsers
    const initAndUnlockAudio = () => {
        // 1. Initialize and resume AudioContext if supported
        this.initAudioContext();
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }

        // 2. "Unlock" all audio elements by playing them silently in the user-gesture
        const allAudio = [this.menuBgm, this.worldBgm, this.intenseBgm, this.sfxShoot, this.sfxHit, this.sfxExplosion, this.sfxHeal, this.sfxBuy, this.sfxClick];
        allAudio.forEach(audio => {
            if (audio.paused) {
                // Save current state
                const isCurrentBgm = (audio === this.currentBgm);
                
                audio.play().then(() => {
                    // If it's not the currently active BGM, pause it immediately
                    if (!isCurrentBgm) {
                        audio.pause();
                        audio.currentTime = 0;
                    } else {
                        // If it is the current BGM, start fading it in
                        this.fadeAudio(false);
                    }
                }).catch(() => {
                    console.log('Audio unlock prevented for:', audio.src);
                });
            }
        });

        document.removeEventListener('click', initAndUnlockAudio);
        document.removeEventListener('touchstart', initAndUnlockAudio);
    };
    
    document.addEventListener('click', initAndUnlockAudio);
    document.addEventListener('touchstart', initAndUnlockAudio, { passive: true });

    let worldFading = false;
    this.worldBgm.addEventListener('play', () => worldFading = false);
    this.worldBgm.addEventListener('timeupdate', () => {
        if (this.worldBgm.duration && this.worldBgm.currentTime >= this.worldBgm.duration - 0.6 && !worldFading && this.currentBgm === this.worldBgm) {
            worldFading = true;
            this.fadeAudio(true, 500, false);
        }
    });

    this.worldBgm.addEventListener('ended', () => {
        this.onWorldBgmEnded.set(true);
    });

    this.intenseBgm.addEventListener('ended', () => {
        this.onIntenseBgmEnded.set(true);
    });

    this.loadSettings();
    this.updateVolumes();
  }

  private initAudioContext() {
      if (this.audioCtx) return;
      // @ts-ignore
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContextClass();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      const bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(bufferLength);

      this.connectSource(this.menuBgm);
      this.connectSource(this.worldBgm);
      this.connectSource(this.intenseBgm);
  }

  private connectSource(audioElement: HTMLAudioElement) {
      if (!this.audioCtx || !this.analyser) return;
      if (this.sourceMap.has(audioElement)) return;
      try {
          const source = this.audioCtx.createMediaElementSource(audioElement);
          source.connect(this.analyser);
          this.analyser.connect(this.audioCtx.destination);
          this.sourceMap.set(audioElement, source);
      } catch (e) {
          console.error("Failed to connect audio element to analyzer", e);
      }
  }

  public getAudioIntensity(): number {
      if (!this.analyser || !this.dataArray) return 0;
      this.analyser.getByteFrequencyData(this.dataArray as any);
      let sum = 0;
      for (let i = 0; i < this.dataArray.length; i++) {
          sum += this.dataArray[i];
      }
      const average = sum / this.dataArray.length;
      return average / 255.0; // Return 0.0 to 1.0
  }

  public getBgmDuration(): number {
      return this.currentBgm ? this.currentBgm.duration || 0 : 0;
  }

  public getBgmCurrentTime(): number {
      return this.currentBgm ? this.currentBgm.currentTime || 0 : 0;
  }

  private loadSettings() {
      const savedMaster = localStorage.getItem('phoenix_vol_master');
      if (savedMaster !== null) this.masterVolume.set(parseFloat(savedMaster));
      
      const savedMenu = localStorage.getItem('phoenix_vol_menu');
      if (savedMenu !== null) this.menuVolume.set(parseFloat(savedMenu));
      
      const savedAttack = localStorage.getItem('phoenix_vol_attack');
      if (savedAttack !== null) this.attackVolume.set(parseFloat(savedAttack));
      
      const savedIntense = localStorage.getItem('phoenix_vol_intense');
      if (savedIntense !== null) this.intenseVolume.set(parseFloat(savedIntense));
      
      const savedSfx = localStorage.getItem('phoenix_vol_sfx');
      if (savedSfx !== null) this.sfxVolume.set(parseFloat(savedSfx));
  }

  public saveSettings() {
      localStorage.setItem('phoenix_vol_master', this.masterVolume().toString());
      localStorage.setItem('phoenix_vol_menu', this.menuVolume().toString());
      localStorage.setItem('phoenix_vol_attack', this.attackVolume().toString());
      localStorage.setItem('phoenix_vol_intense', this.intenseVolume().toString());
      localStorage.setItem('phoenix_vol_sfx', this.sfxVolume().toString());
      this.updateVolumes();
  }

  private updateVolumes() {
      const mVol = this.masterVolume();
      this.menuBgm.volume = 0.3 * mVol * this.menuVolume();
      this.worldBgm.volume = 0.3 * mVol * this.menuVolume(); 
      this.intenseBgm.volume = 0.5 * mVol * this.intenseVolume();
  }

  public isMuted() {
      return this.masterVolume() === 0;
  }

  private preAdMasterVolume: number | null = null;

  public pauseAudioForAd() {
      this.preAdMasterVolume = this.masterVolume();
      this.masterVolume.set(0);
      this.updateVolumes();
  }

  public resumeAudioAfterAd() {
      if (this.preAdMasterVolume !== null) {
          this.masterVolume.set(this.preAdMasterVolume);
          this.preAdMasterVolume = null;
      } else {
          const savedMaster = localStorage.getItem('phoenix_vol_master');
          this.masterVolume.set(savedMaster !== null ? parseFloat(savedMaster) : 1.0);
      }
      this.updateVolumes();
  }

  private fadeInterval: any = null;

  public fadeAudio(out: boolean, duration: number = 500, pauseOnComplete: boolean = true) {
      if (!this.currentBgm) return;
      if (this.fadeInterval) clearInterval(this.fadeInterval);

      const targetVolume = out ? 0 : this.getTargetVolumeFor(this.currentBgm);
      const startVolume = this.currentBgm.volume;
      const steps = 20;
      const stepTime = duration / steps;
      const stepVol = (targetVolume - startVolume) / steps;

      let currentStep = 0;
      this.fadeInterval = setInterval(() => {
          currentStep++;
          if (!this.currentBgm) {
              clearInterval(this.fadeInterval);
              return;
          }
          
          let nextVol = startVolume + (stepVol * currentStep);
          // Clamp
          if (nextVol < 0) nextVol = 0;
          if (nextVol > 1) nextVol = 1;
          
          this.currentBgm.volume = nextVol;

          if (currentStep >= steps) {
              this.currentBgm.volume = targetVolume;
              clearInterval(this.fadeInterval);
              if (out && this.currentBgm && pauseOnComplete) {
                  this.currentBgm.pause();
              }
          }
      }, stepTime);
  }

  private getTargetVolumeFor(bgm: HTMLAudioElement): number {
      const mVol = this.masterVolume();
      if (bgm === this.intenseBgm) return 0.5 * mVol * this.intenseVolume();
      return 0.3 * mVol * this.menuVolume();
  }

  playMenuBgm() {
    this.stopBgm(true);
    this.currentBgm = this.menuBgm;
    this.currentBgm.volume = 0; // Prepare for fade
    this.currentBgm.play().then(() => this.fadeAudio(false)).catch(e => console.log('BGM play prevented', e));
  }
  
  playWorldBgm(worldId: number = 0) {
      this.stopBgm(true);
      this.currentBgm = this.worldBgm;
      this.worldBgm.src = `assets/audio/world_${worldId + 1}_bgm.wav`;
      this.onWorldBgmEnded.set(false);
      this.currentBgm.currentTime = 0;
      this.currentBgm.volume = 0;
      this.currentBgm.play().then(() => this.fadeAudio(false)).catch(e => console.log('BGM play prevented', e));
  }
  
  playIntenseBgm(worldId: number = 0) {
      this.stopBgm(true);
      this.currentBgm = this.intenseBgm;
      this.intenseBgm.src = `assets/audio/world_${worldId + 1}_intense_bgm.wav`;
      this.onIntenseBgmEnded.set(false);
      this.currentBgm.currentTime = 0;
      this.currentBgm.volume = 0;
      if (this.currentBgm.paused) {
          this.currentBgm.play().then(() => this.fadeAudio(false)).catch(e => console.log('Intense BGM play prevented', e));
      }
  }
  
  stopIntenseBgm() {
      if (!this.intenseBgm.paused) {
          if (this.currentBgm === this.intenseBgm) {
              this.fadeAudio(true, 500, true);
          } else {
              this.intenseBgm.pause();
          }
      }
  }

  playBgm() {
      this.playWorldBgm();
  }

  stopBgm(immediate: boolean = false) {
    if (this.currentBgm) {
        if (immediate) {
            this.currentBgm.pause();
            this.currentBgm.currentTime = 0;
        } else {
            this.fadeAudio(true, 500, true);
            const bgmToReset = this.currentBgm;
            setTimeout(() => {
                if (bgmToReset.paused) bgmToReset.currentTime = 0;
            }, 600); // After fade
        }
    }
  }

  public pauseCurrentBgm() {
      this.fadeAudio(true, 300, true);
  }

  public resumeCurrentBgm() {
      if (this.currentBgm && this.currentBgm.paused) {
          this.currentBgm.play().then(() => this.fadeAudio(false, 300)).catch(() => {});
      }
  }

  playSFX(type: 'shoot' | 'hit' | 'explosion' | 'heal' | 'buy' | 'click' | 'boss') {
    if (this.isMuted()) return;
    
    let audio: HTMLAudioElement | null = null;
    switch(type) {
        case 'shoot': audio = this.sfxShoot; break;
        case 'hit': audio = this.sfxHit; break;
        case 'explosion': audio = this.sfxExplosion; break;
        case 'heal': audio = this.sfxHeal; break;
        case 'buy': audio = this.sfxBuy; break;
        case 'click': audio = this.sfxClick; break;
        case 'boss': audio = this.sfxExplosion; break; // fallback
    }
    
    if (audio) {
        const clone = audio.cloneNode() as HTMLAudioElement;
        const isMenuSfx = (type === 'buy' || type === 'click');
        const isCombatSfx = (type === 'shoot' || type === 'hit' || type === 'explosion' || type === 'boss');
        const channelVol = isMenuSfx ? this.sfxVolume() : (isCombatSfx ? this.attackVolume() : this.sfxVolume());
        clone.volume = 0.4 * this.masterVolume() * channelVol;
        
        if (clone.volume > 0) {
            clone.play().catch(e => console.log('SFX play prevented', e));
        }
    }
  }
}
