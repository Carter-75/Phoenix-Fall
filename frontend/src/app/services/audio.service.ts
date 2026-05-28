import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AudioService {
  public masterVolume = signal<number>(1.0);
  public menuVolume = signal<number>(1.0);
  public attackVolume = signal<number>(1.0);
  public intenseVolume = signal<number>(1.0);
  
  private currentBgm: HTMLAudioElement | null = null;
  private menuBgm = new Audio('assets/audio/menu_bgm.wav');
  private world1Bgm = new Audio('assets/audio/world_1_bgm.wav');
  private intenseBgm = new Audio('assets/audio/intense_bgm.wav');
  
  private sfxShoot = new Audio('assets/audio/shoot.wav');
  private sfxHit = new Audio('assets/audio/hit.wav');
  private sfxExplosion = new Audio('assets/audio/explosion.wav');
  private sfxHeal = new Audio('assets/audio/heal.wav');
  private sfxBuy = new Audio('assets/audio/buy.wav');
  private sfxClick = new Audio('assets/audio/click.wav');

  constructor() {
    this.menuBgm.loop = true;
    this.world1Bgm.loop = true;
    this.intenseBgm.loop = true;

    this.loadSettings();
    this.updateVolumes();

    const startAudioContext = () => {
        if (this.currentBgm && this.currentBgm.paused) {
            this.currentBgm.play().catch(() => {});
        }
        document.removeEventListener('click', startAudioContext);
        document.removeEventListener('touchstart', startAudioContext);
    };
    document.addEventListener('click', startAudioContext);
    document.addEventListener('touchstart', startAudioContext);
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
  }

  public saveSettings() {
      localStorage.setItem('phoenix_vol_master', this.masterVolume().toString());
      localStorage.setItem('phoenix_vol_menu', this.menuVolume().toString());
      localStorage.setItem('phoenix_vol_attack', this.attackVolume().toString());
      localStorage.setItem('phoenix_vol_intense', this.intenseVolume().toString());
      this.updateVolumes();
  }

  private updateVolumes() {
      const mVol = this.masterVolume();
      this.menuBgm.volume = 0.3 * mVol * this.menuVolume();
      this.world1Bgm.volume = 0.3 * mVol * this.menuVolume(); // Game bgm uses menu/music volume channel
      this.intenseBgm.volume = 0.5 * mVol * this.intenseVolume();
  }

  // Helper to check if effectively muted
  public isMuted() {
      return this.masterVolume() === 0;
  }

  private preAdMasterVolume: number | null = null;

  public pauseAudioForAd() {
      this.preAdMasterVolume = this.masterVolume();
      this.masterVolume.set(0);
      this.updateVolumes(); // Update active audio elements without saving 0 to localStorage
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

  playMenuBgm() {
    this.stopBgm();
    this.currentBgm = this.menuBgm;
    this.currentBgm.play().catch(e => console.log('BGM play prevented', e));
  }
  
  playWorldBgm(worldId: number = 0) {
      this.stopBgm();
      this.currentBgm = this.world1Bgm;
      this.currentBgm.play().catch(e => console.log('BGM play prevented', e));
  }
  
  playIntenseBgm() {
      if (this.intenseBgm.paused) {
          this.intenseBgm.play().catch(e => console.log('Intense BGM play prevented', e));
      }
  }
  
  stopIntenseBgm() {
      if (!this.intenseBgm.paused) {
          this.intenseBgm.pause();
      }
  }

  playBgm() {
      // Backwards compatibility if called directly
      this.playWorldBgm();
  }

  stopBgm() {
    if (this.currentBgm) {
        this.currentBgm.pause();
        this.currentBgm.currentTime = 0;
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
        const channelVol = isMenuSfx ? this.menuVolume() : this.attackVolume();
        clone.volume = 0.4 * this.masterVolume() * channelVol;
        
        if (clone.volume > 0) {
            clone.play().catch(e => console.log('SFX play prevented', e));
        }
    }
  }
}
