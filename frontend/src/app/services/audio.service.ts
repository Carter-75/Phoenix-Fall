import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AudioService {
  public isMuted = signal<boolean>(false);
  
  private currentBgm: HTMLAudioElement | null = null;
  private menuBgm = new Audio('assets/audio/menu_bgm.wav');
  private world1Bgm = new Audio('assets/audio/world_1_bgm.wav');
  
  private sfxShoot = new Audio('assets/audio/shoot.wav');
  private sfxHit = new Audio('assets/audio/hit.wav');
  private sfxExplosion = new Audio('assets/audio/explosion.wav');
  private sfxHeal = new Audio('assets/audio/heal.wav');
  private sfxBuy = new Audio('assets/audio/buy.wav');
  private sfxClick = new Audio('assets/audio/click.wav');

  constructor() {
    this.menuBgm.loop = true;
    this.menuBgm.volume = 0.3;
    
    this.world1Bgm.loop = true;
    this.world1Bgm.volume = 0.3;

    // Load from local storage
    const saved = localStorage.getItem('phoenix_muted');
    if (saved === 'true') {
        this.isMuted.set(true);
    }
  }

  toggleMute() {
    this.isMuted.set(!this.isMuted());
    localStorage.setItem('phoenix_muted', this.isMuted().toString());
    
    if (this.isMuted()) {
        if (this.currentBgm) this.currentBgm.pause();
    } else {
        if (this.currentBgm) this.currentBgm.play().catch(e => console.log('BGM play prevented', e));
    }
  }

  playMenuBgm() {
    this.stopBgm();
    this.currentBgm = this.menuBgm;
    if (!this.isMuted()) {
        this.currentBgm.play().catch(e => console.log('BGM play prevented', e));
    }
  }
  
  playWorldBgm(worldId: number = 0) {
      this.stopBgm();
      // Right now only world 1 (id 0) is generated, fallback to world 1
      this.currentBgm = this.world1Bgm;
      if (!this.isMuted()) {
          this.currentBgm.play().catch(e => console.log('BGM play prevented', e));
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
        clone.volume = 0.4;
        clone.play().catch(e => console.log('SFX play prevented', e));
    }
  }
}
