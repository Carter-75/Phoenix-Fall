import { Component, ElementRef, OnInit, OnDestroy, ViewChild, inject, NgZone, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameStateService, PhysicsEntity, ABILITIES } from '../../services/game-state.service';
import { Capacitor } from '@capacitor/core';
import { AudioService } from '../../services/audio.service';
import { SettingsComponent } from '../settings/settings.component';
import * as Matter from 'matter-js';
import anime from 'animejs';

interface EnemyData {
  id: string;
  type: 'bat' | 'slime' | 'golem' | 'boss' | 'projectile_player' | 'projectile_enemy' | 'aura' | 'coin' | 'gem' | 'heart' | 'drill' | 'fire' | 'turret' | 'egg';
  health: number;
  maxHealth: number;
  lastAttackTime?: number;
  lastMinionTime?: number;
  burstDamage?: number; // Custom damage payload
  value?: number;
}

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [CommonModule, SettingsComponent],
  template: `
    <div class="fixed inset-0 z-10 w-full h-full pointer-events-none">
      
      <!-- Progress Bar Overlay -->
      <div class="absolute top-8 left-1/2 -translate-x-1/2 w-[80%] max-w-2xl flex flex-col items-center gap-2 pointer-events-auto">
        <span class="text-white font-bold tracking-widest uppercase drop-shadow-md">
           {{ bossSpawned() ? 'BOSS HEALTH' : 'SURVIVE' }}
        </span>
        <div class="w-full h-3 bg-black/50 border border-white/20 rounded-full overflow-hidden shadow-[0_0_15px_rgba(255,255,255,0.1)]">
           <div class="h-full bg-gradient-to-r transition-all duration-1000"
                [ngClass]="bossSpawned() ? 'from-red-600 to-red-400' : currentWorld().textColorClass"
                [style.width]="bossSpawned() ? bossHealthPercent() + '%' : progressPercent() + '%'"></div>
        </div>
        @if (!bossSpawned()) {
          <span class="text-white/80 font-mono text-sm">{{ formatTime(Math.max(0, timeRemaining())) }}</span>
        }
      </div>
      
      <!-- Health Bar -->
      <div class="absolute bottom-8 left-1/2 -translate-x-1/2 w-48 md:w-64 flex flex-col items-center gap-2 pointer-events-auto">
        <div class="w-full h-4 bg-black/50 border border-white/20 rounded-full overflow-hidden shadow-[0_0_15px_rgba(255,0,0,0.2)]">
           <div class="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-300"
                [style.width]="(currentHealth() / maxHealth()) * 100 + '%'"></div>
        </div>
        <span class="text-red-400 font-bold text-sm">{{ currentHealth() }} / {{ maxHealth() }}</span>
      </div>

      <!-- Cooldown UI -->
      <div class="absolute bottom-8 right-4 md:right-8 flex gap-2 md:gap-4 pointer-events-auto">
        <!-- Tap Ability -->
        <div class="relative w-14 h-14 md:w-16 md:h-16 bg-black/50 border border-white/20 rounded-2xl overflow-hidden flex items-center justify-center backdrop-blur-sm shadow-[0_0_15px_rgba(255,100,200,0.2)]">
          <span class="text-3xl z-10" [class.opacity-50]="tapCooldown() > 0">{{ getTapIcon() }}</span>
          @if (tapCooldown() > 0) {
            <div class="absolute bottom-0 left-0 w-full bg-pink-600/50 transition-all" [style.height]="(tapCooldown() / getTapMaxCooldown()) * 100 + '%'"></div>
            <span class="absolute z-20 text-white font-bold drop-shadow-md">{{ tapCooldown().toFixed(1) }}</span>
          }
        </div>
        <!-- Hold Ability -->
        <div class="relative w-14 h-14 md:w-16 md:h-16 bg-black/50 border border-white/20 rounded-2xl overflow-hidden flex items-center justify-center backdrop-blur-sm shadow-[0_0_15px_rgba(0,255,255,0.2)]">
          <span class="text-3xl z-10" [class.opacity-50]="holdCooldown() > 0">{{ getHoldIcon() }}</span>
          @if (holdCooldown() > 0) {
            <div class="absolute bottom-0 left-0 w-full bg-cyan-600/50 transition-all" [style.height]="(holdCooldown() / getHoldMaxCooldown()) * 100 + '%'"></div>
            <span class="absolute z-20 text-white font-bold drop-shadow-md">{{ holdCooldown().toFixed(1) }}</span>
          }
        </div>
      </div>

      <!-- Boss Warning & Rage Mode -->
      @if (bossSpawned() && !rageModeActive()) {
        <div class="absolute top-24 left-1/2 -translate-x-1/2 animate-pulse pointer-events-none z-20">
           <h2 class="text-4xl font-black text-red-600 drop-shadow-[0_0_20px_rgba(255,0,0,0.8)] tracking-widest uppercase">World Boss Approaching</h2>
        </div>
      }
      @if (rageModeActive() && !isDead() && !gameEnded()) {
        <div class="absolute top-24 left-1/2 -translate-x-1/2 pointer-events-none z-20 flex flex-col items-center">
           <h2 class="text-5xl font-black text-red-600 drop-shadow-[0_0_30px_rgba(255,0,0,1)] tracking-widest uppercase animate-ping">RAGE MODE</h2>
           <span class="text-2xl text-white font-mono mt-2 bg-black/50 px-4 py-1 rounded">Death in: {{ killScreenTimer() }}s</span>
        </div>
        <div class="absolute inset-0 bg-red-900/20 pointer-events-none z-10 animate-pulse"></div>
      }

      <!-- Pause Button -->
      <button (click)="togglePause()" class="absolute top-8 right-4 md:right-8 w-10 h-10 md:w-12 md:h-12 bg-black/50 border border-white/20 rounded-full flex items-center justify-center pointer-events-auto hover:bg-white/10 transition z-20">
        <span class="text-white font-bold text-xl">||</span>
      </button>

      <!-- Pause Screen -->
      @if (gameState.isPaused()) {
        <div class="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center pointer-events-auto z-40">
          <h2 (click)="onPauseTextClick()" 
              class="text-6xl font-black mb-8 tracking-widest cursor-pointer select-none transition-all duration-300"
              [class.text-red-500]="cheatPrepared()"
              [class.drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]]="cheatPrepared()"
              [class.text-white]="!cheatPrepared()"
              [class.drop-shadow-lg]="!cheatPrepared()">PAUSED</h2>
          
          <div class="flex flex-col gap-4 w-full max-w-xs">
            <button (click)="togglePause()" class="w-full py-4 bg-white/10 hover:bg-white/20 border border-white/30 rounded-2xl text-white font-bold text-xl transition">
              Resume
            </button>
            <button (click)="showSettings = true" class="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/20 rounded-2xl text-white font-bold text-lg transition">
              Settings
            </button>
            <button (click)="quitGame()" class="w-full py-4 bg-transparent hover:bg-white/5 border border-transparent hover:border-white/10 rounded-2xl text-white/50 hover:text-white transition">
              Quit to Menu
            </button>
          </div>
        </div>
      }
      
      @if (showSettings) {
          <app-settings (close)="showSettings = false"></app-settings>
      }

      <!-- Damage Overlay (Red Flash) -->
      <div class="absolute inset-0 bg-red-600 transition-opacity duration-300 pointer-events-none"
           [style.opacity]="damageFlash() ? 0.3 : 0"></div>

      <!-- Death / Tombstone Screen -->
      @if (isDead()) {
        <div class="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center pointer-events-auto z-50">
          <div class="w-32 h-40 bg-gray-800 border-4 border-gray-600 rounded-t-full flex flex-col items-center justify-center mb-8 shadow-[0_0_50px_rgba(0,0,0,1)]">
            <span class="text-5xl text-gray-400">✝</span>
            <span class="text-gray-500 mt-2 font-mono text-sm">R.I.P</span>
          </div>

          <h2 class="text-5xl font-black text-red-500 mb-2 drop-shadow-lg">YOU DIED</h2>
          <p class="text-white text-xl font-bold mb-8">Revive in: <span class="text-orange-400 font-mono">{{ reviveCountdown() }}s</span></p>
          
          <div class="flex flex-col gap-4 w-full max-w-sm">
            <button (click)="reviveWithGems()" 
                    [disabled]="gameState.gems() < getReviveCost()"
                    [class.opacity-50]="gameState.gems() < getReviveCost()"
                    [class.cursor-not-allowed]="gameState.gems() < getReviveCost()"
                    class="w-full py-4 bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:brightness-125 border border-fuchsia-400/50 rounded-2xl flex justify-center items-center gap-3 transition shadow-[0_0_20px_rgba(200,0,255,0.3)]">
              <span class="text-white font-bold text-xl">Instant Revive</span>
              <img src="assets/gem_icon.png" class="w-6 h-6"/>
              <span class="text-white font-bold text-xl">{{ getReviveCost() }}</span>
            </button>
            <button (click)="reviveWithAd()" class="w-full mt-2 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:brightness-125 border border-cyan-400/50 rounded-2xl flex justify-center items-center gap-3 transition shadow-[0_0_20px_rgba(0,200,255,0.3)]">
              <span class="text-white font-bold text-xl">Watch Ad to Revive</span>
              <span class="text-2xl">📺</span>
            </button>
            <button (click)="quitGame()" class="w-full mt-4 py-4 bg-transparent hover:bg-white/5 border border-transparent hover:border-white/10 rounded-2xl text-white/50 hover:text-white transition">
              Give Up
            </button>
          </div>
        </div>
      }

      <!-- End Game Screen -->
      @if (gameEnded() && !isDead()) {
        <div class="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center pointer-events-auto z-50">
          <h2 class="text-6xl font-black text-white mb-4 drop-shadow-lg" [ngClass]="gameWon() ? 'text-yellow-400' : 'text-red-500'">
            {{ gameWon() ? 'VICTORY' : 'DEFEAT' }}
          </h2>
          @if (gameWon()) {
            <div class="flex items-center gap-3 mb-8 bg-purple-900/50 px-6 py-3 rounded-full border border-purple-500/50">
              <span class="text-white font-bold">Reward:</span>
              <span class="text-purple-400 font-bold text-2xl">+1</span>
              <img src="assets/gem_icon.png" class="w-8 h-8"/>
            </div>
          }
          <button (click)="quitGame()" class="px-8 py-3 bg-white/10 hover:bg-white/20 border border-white/30 rounded-full text-white font-bold transition">
            Return to Menu
          </button>
        </div>
      }

      <!-- Invisible Physics Container (Hidden entirely, rendered via ParticleBg) -->
      <div #physicsContainer class="absolute inset-0 w-full h-full opacity-0 pointer-events-none"></div>
    </div>
  `
})
export class GameComponent implements OnInit, OnDestroy {
  @ViewChild('physicsContainer', { static: true }) physicsContainer!: ElementRef<HTMLDivElement>;

  public gameState = inject(GameStateService);
  private audioService = inject(AudioService);
  public Math = Math;
  public currentWorld = computed(() => this.gameState.worlds[this.gameState.selectedWorldIndex()]);
  
  get screenScale() {
      return Math.max(0.4, Math.min(1.0, window.innerWidth / 1000));
  }
  
  public maxHealth = computed(() => this.gameState.currentStats().maxHealth);
  public currentHealth = signal<number>(this.maxHealth());
  public damageFlash = signal<boolean>(false);
  public reviveCount = 0;
  public celestialShieldActive = signal<boolean>(true);
  
  public totalTimeSignal = signal<number>(300);
  public timeRemaining = signal<number>(300);
  public progressPercent = computed(() => {
      const tot = this.totalTimeSignal();
      if (tot <= 0) return 0;
      return ((tot - this.timeRemaining()) / tot) * 100;
  });
  
  public gameEnded = signal<boolean>(false);
  public gameWon = signal<boolean>(false);
  public isDead = signal<boolean>(false);
  public bossSpawned = signal<boolean>(false);
  public bossHealth = signal<number>(1000);
  public bossMaxHealth = signal<number>(1000);
  public bossHealthPercent = computed(() => (this.bossHealth() / this.bossMaxHealth()) * 100);

  // Cinematic Boss Defeat Sequence State
  public bossGemsDropped = 0;
  public bossGemsCollected = 0;
  public inBossDefeatSequence = signal<boolean>(false);
  public bossDefeatTimestamp = 0;
  public animatingAscension = signal<boolean>(false);
  
  public showSettings = false;

  // Revive UI
  public reviveCountdown = signal<number>(10);
  private reviveInterval: any;

  // Abilities
  public tapCooldown = signal<number>(0);
  public holdCooldown = signal<number>(0);
  public hasRebirthed = false;
  private lastClickTime = 0;
  private pauseClickCount = 0;
  public cheatPrepared = signal<boolean>(false);
  
  private lastUpdateTime = Date.now();
  private tapAbilityEndTime = 0;
  private holdAbilityEndTime = 0;

  getTapIcon() { return ABILITIES[this.gameState.currentStats().activeTapAbility || 'burst']?.icon || '💥'; }
  getHoldIcon() { return ABILITIES[this.gameState.currentStats().activeHoldAbility || 'aura']?.icon || '🌀'; }

  getTapMaxCooldown() {
      const id = this.gameState.currentStats().activeTapAbility || 'burst';
      const abilityData = this.gameState.worldUpgrades()[this.gameState.selectedWorldIndex()]?.unlockedAbilities[id];
      const mod = abilityData?.modifiers?.['cooldown'] || 1.0;
      if (id === 'drill_attack') return 3 * mod; 
      if (id === 'fire_breath') return 8 * mod;  
      return 5 * mod; // burst
  }

  getHoldMaxCooldown() {
      const id = this.gameState.currentStats().activeHoldAbility || 'aura';
      const abilityData = this.gameState.worldUpgrades()[this.gameState.selectedWorldIndex()]?.unlockedAbilities[id];
      const mod = abilityData?.modifiers?.['cooldown'] || 1.0;
      if (id === 'phoenix_turret') return 10 * mod;
      if (id === 'rebirth') return 60 * mod; // 60s cooldown for Rebirth
      return 15 * mod; // aura
  }
  
  // Input Tracking
  private mouseX = window.innerWidth / 2;
  private mouseY = window.innerHeight / 2;
  private isMouseHeld = false;
  private holdTimer = 0;
  private holdStartX = 0;
  private holdStartY = 0;

  // Matter.js
  private engine!: Matter.Engine;
  private runner!: Matter.Runner;
  private playerBody!: Matter.Body;
  
  private timerInterval: any;
  private spawnInterval: any;
  private attackInterval: any;
  private enemies: Matter.Body[] = [];
  private items: Matter.Body[] = [];

  // Listeners bound
  private boundKeyDown = this.onKeyDown.bind(this);
  private boundVisibility = this.onVisibilityChange.bind(this);
  private boundMouseMove = this.onMouseMove.bind(this);
  private boundMouseDown = this.onMouseDown.bind(this);
  private boundMouseUp = this.onMouseUp.bind(this);
  private boundTouchStart = this.onTouchStart.bind(this);
  private boundTouchMove = this.onTouchMove.bind(this);
  private boundTouchEnd = this.onTouchEnd.bind(this);

  public rageModeActive = signal<boolean>(false);
  public killScreenTimer = signal<number>(10);

  constructor(private ngZone: NgZone) {
      // Remove old health-based intense BGM effect because intense BGM is now for the boss
      effect(() => {
          if (this.audioService.onWorldBgmEnded() && !this.bossSpawned() && !this.gameEnded()) {
              // Untracked to avoid infinite loops, but using setTimeout is safer in Angular
              setTimeout(() => {
                  this.spawnBoss();
                  this.audioService.playIntenseBgm(this.gameState.selectedWorldIndex());
              }, 0);
          }
      });

      effect(() => {
          if (this.audioService.onIntenseBgmEnded() && this.bossSpawned() && !this.inBossDefeatSequence() && !this.isDead()) {
              setTimeout(() => {
                  if (!this.rageModeActive()) {
                      this.triggerRageMode();
                  }
              }, 0);
          }
      });
  }

  private triggerRageMode() {
      this.rageModeActive.set(true);
      const kInt = setInterval(() => {
          if (this.gameEnded() || this.isDead() || this.inBossDefeatSequence()) {
              clearInterval(kInt);
              return;
          }
          if (!this.gameState.isPaused()) {
              this.killScreenTimer.update(t => t - 1);
              if (this.killScreenTimer() <= 0) {
                  clearInterval(kInt);
                  this.executeKillScreen();
              }
          }
      }, 1000);
  }

  private executeKillScreen() {
      const boss = this.enemies.find(e => e.plugin['data']?.type === 'boss');
      if (!boss) return;
      for (let i = 0; i < 60; i++) {
          setTimeout(() => {
              if (this.isDead()) return;
              const dir = Matter.Vector.normalise(Matter.Vector.sub(this.playerBody.position, boss.position));
              const spreadAngle = (Math.random() - 0.5) * 1.5;
              const angle = Math.atan2(dir.y, dir.x) + spreadAngle;
              const fireDir = { x: Math.cos(angle), y: Math.sin(angle) };
              const proj = Matter.Bodies.circle(boss.position.x, boss.position.y, 20, {
                  label: 'projectile', isSensor: true,
                  plugin: { data: { id: Math.random().toString(), type: 'projectile_enemy', health: 1, maxHealth: 1 } as EnemyData }
              });
              Matter.Body.setVelocity(proj, Matter.Vector.mult(fireDir, 15));
              Matter.Composite.add(this.engine.world, proj);
          }, i * 50);
      }
      setTimeout(() => this.takeDamage(9999), 2000);
  }

  ngOnInit() {
    this.currentHealth.set(this.maxHealth());
    this.gameState.sessionPlayTime.set(0);
    this.gameState.sessionKills.set({});
    this.gameState.heartsCollected.set(0);
    
    this.initPhysics();
    this.startGameLoop();
    
    window.addEventListener('mousemove', this.boundMouseMove);
    window.addEventListener('mousedown', this.boundMouseDown);
    window.addEventListener('mouseup', this.boundMouseUp);
    window.addEventListener('touchstart', this.boundTouchStart, { passive: false });
    window.addEventListener('touchmove', this.boundTouchMove, { passive: false });
    window.addEventListener('touchend', this.boundTouchEnd);
    
    window.addEventListener('keydown', this.boundKeyDown);
    document.addEventListener('visibilitychange', this.boundVisibility);
  }

  ngOnDestroy() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (this.spawnInterval) clearTimeout(this.spawnInterval);
    if (this.attackInterval) clearInterval(this.attackInterval);
    if (this.reviveInterval) clearInterval(this.reviveInterval);
    
    window.removeEventListener('mousemove', this.boundMouseMove);
    window.removeEventListener('mousedown', this.boundMouseDown);
    window.removeEventListener('mouseup', this.boundMouseUp);
    window.removeEventListener('touchstart', this.boundTouchStart);
    window.removeEventListener('touchmove', this.boundTouchMove);
    window.removeEventListener('touchend', this.boundTouchEnd);
    window.removeEventListener('keydown', this.boundKeyDown);
    document.removeEventListener('visibilitychange', this.boundVisibility);
    
    this.gameState.phoenixOverridePosition.set(null);
    this.gameState.activeEntities.set([]);
    
    if (this.engine) {
        Matter.Events.off(this.engine, 'beforeUpdate');
        Matter.Events.off(this.engine, 'collisionStart');
        Matter.Engine.clear(this.engine);
    }
    if (this.runner) {
        Matter.Runner.stop(this.runner);
    }
    
    this.audioService.stopIntenseBgm();
  }

  private initPhysics() {
    const Engine = Matter.Engine,
          Runner = Matter.Runner,
          Bodies = Matter.Bodies,
          Composite = Matter.Composite;

    this.engine = Engine.create({ gravity: { x: 0, y: 0 } });
    
    // Speed up physics engine if running natively on a mobile device
    if (Capacitor.isNativePlatform()) {
        this.engine.timing.timeScale = 1.35;
    }

    // Invisible player hitbox (Compound Body for Bird Shape)
    const scale = this.screenScale;
    const birdCore = Bodies.rectangle(window.innerWidth / 2, window.innerHeight / 2, 10 * scale, 20 * scale, { label: 'player' });
    const birdLeftWing = Bodies.rectangle(window.innerWidth / 2 - (15 * scale), window.innerHeight / 2 - (5 * scale), 20 * scale, 8 * scale, { label: 'player' });
    const birdRightWing = Bodies.rectangle(window.innerWidth / 2 + (15 * scale), window.innerHeight / 2 - (5 * scale), 20 * scale, 8 * scale, { label: 'player' });
    
    const playerCategory = 0x0002;
    const playerCollisionFilter = { category: playerCategory, mask: 0xFFFF };
    birdCore.collisionFilter = playerCollisionFilter;
    birdLeftWing.collisionFilter = playerCollisionFilter;
    birdRightWing.collisionFilter = playerCollisionFilter;

    this.playerBody = Matter.Body.create({
      parts: [birdCore, birdLeftWing, birdRightWing],
      isSensor: false,
      label: 'player',
      collisionFilter: playerCollisionFilter
    });

    Composite.add(this.engine.world, [this.playerBody]);

    // Handle collisions
    Matter.Events.on(this.engine, 'collisionStart', (event) => {
      if (this.isDead() || this.gameEnded()) return;

      const pairs = event.pairs;
      for (let i = 0; i < pairs.length; i++) {
        const bodyA = pairs[i].bodyA.parent;
        const bodyB = pairs[i].bodyB.parent;
        
        // Player taking damage
        if (bodyA.label === 'player' || bodyB.label === 'player') {
          const otherBody = bodyA.label === 'player' ? bodyB : bodyA;
          const data = otherBody.plugin['data'] as EnemyData;
          if (!data) continue;

          if (otherBody.label === 'enemy' || otherBody.label === 'boss') {
            if (this.gameState.isDrilling()) {
                this.damageEnemy(otherBody, this.gameState.currentStats().burstDamage * 3);
                this.triggerImpactEffect(otherBody.position.x, otherBody.position.y, false);
                continue; // Skip player taking damage while drilling
            }
            this.takeDamage(data.type === 'boss' ? 50 : 10);
            
            // Knockback logic
            const force = Matter.Vector.sub(this.playerBody.position, otherBody.position);
            const normalized = Matter.Vector.normalise(force);
            if (data.type !== 'boss') {
                Matter.Body.applyForce(otherBody, otherBody.position, Matter.Vector.mult(normalized, -0.05));
            }
          } else if (otherBody.label === 'projectile' && (data.type === 'projectile_enemy')) {
            this.takeDamage(15);
            Matter.Composite.remove(this.engine.world, otherBody);
          } else if (otherBody.label === 'item') {
            if (data.type === 'coin') {
                let val = data.value || 0;
                if (this.gameState.hasGoldenAura() && Math.random() < 0.1) val *= 5;
                const scale = 3 * Math.max(0.2, 1 - (this.progressPercent() / 100));
                this.gameState.coins.update(c => c + (val * scale * this.gameState.coinMultiplier() * 3));
            }
            if (data.type === 'gem') {
                const scale = 3 * Math.max(0.2, 1 - (this.progressPercent() / 100));
                this.gameState.gems.update(g => g + ((data.value || 0) * scale));
                if (this.inBossDefeatSequence()) {
                    this.bossGemsCollected++;
                    if (this.bossGemsCollected >= this.bossGemsDropped && !this.animatingAscension()) {
                        this.triggerAscension();
                    }
                }
            }
            if (data.type === 'heart') {
                this.audioService.playSFX('heal');
                const scale = 3 * Math.max(0.2, 1 - (this.progressPercent() / 100));
                
                const healAmt = Math.floor((data.value || 0) * scale);
                
                this.currentHealth.update(h => Math.floor(Math.min(this.maxHealth(), h + healAmt)));
                
                this.gameState.heartsCollected.update(v => v + 1);
                if (this.gameState.heartsCollected() >= 5) this.gameState.awardTrophy("Healer");
                
                // Green flash for heart
                const el = document.createElement('div');
                const colorClass = 'bg-green-500/20';
                el.className = `fixed inset-0 ${colorClass} z-50 pointer-events-none transition-opacity duration-300`;
                document.body.appendChild(el);
                setTimeout(() => el.style.opacity = '0', 50);
                setTimeout(() => el.remove(), 350);
            }
            if (data.type === 'coin' || data.type === 'gem') {
                this.audioService.playSFX('drop');
            }
            Matter.Composite.remove(this.engine.world, otherBody);
            this.items = this.items.filter(i => i !== otherBody);
          }
        }
        
        // Projectile hits enemy
        if (bodyA.label === 'projectile' || bodyB.label === 'projectile') {
          const projectile = bodyA.label === 'projectile' ? bodyA : bodyB;
          const other = bodyA.label === 'projectile' ? bodyB : bodyA;
          
          if (other.label === 'enemy' || other.label === 'boss') {
            const projData = projectile.plugin['data'] as EnemyData;
            if (!projData || projData.type === 'projectile_enemy') continue;

            if (projData.type === 'egg' || projData.type === 'turret') {
                projData.health -= (other.label === 'boss' ? 50 : 10);
                if (projData.type === 'egg' && other.parent) {
                    (projData as any).aggroTarget = other;
                }
                if (projData.health <= 0 && projData.type === 'turret') {
                    Matter.Composite.remove(this.engine.world, projectile);
                }
                this.triggerImpactEffect(projectile.position.x, projectile.position.y, false);
                continue;
            }

            if (projData.type !== 'aura') { 
                Matter.Composite.remove(this.engine.world, projectile);
            }
            
            this.triggerImpactEffect(other.position.x, other.position.y, other.label === 'boss');
            this.damageEnemy(other, projData.burstDamage || this.gameState.currentStats().damage);
          }
        }
      }
    });

    // Update Loop
    Matter.Events.on(this.engine, 'beforeUpdate', () => {
      const now = Date.now();
      const delta = Math.min(0.1, (now - this.lastUpdateTime) / 1000); // exact real-time delta
      this.lastUpdateTime = now;
      
      // Cooldowns
      if (now > this.tapAbilityEndTime) {
          this.tapCooldown.update(c => Math.max(0, c - delta));
      }
      if (now > this.holdAbilityEndTime) {
          this.holdCooldown.update(c => Math.max(0, c - delta));
      }

      // 1. Sync hitbox to EXACT visual 3D position of Phoenix
      if (!this.isDead()) {
         const pxPos = this.gameState.phoenixScreenPos();
         Matter.Body.setPosition(this.playerBody, pxPos);
      }

      // 2. Track Hold-Still for Aura
      if (this.isMouseHeld && !this.isDead() && !this.gameState.isPaused() && !this.gameState.isRebirthing()) {
        const dist = Math.hypot(this.mouseX - this.holdStartX, this.mouseY - this.holdStartY);
        if (dist > 10) {
            this.holdStartX = this.mouseX;
            this.holdStartY = this.mouseY;
            this.holdTimer = 0;
        } else {
            this.holdTimer += delta * 1000;
            if (this.holdTimer >= 3000 && this.holdCooldown() <= 0) {
                const ability = this.gameState.currentStats().activeHoldAbility;
                if (ability === 'aura') this.triggerAura();
                else if (ability === 'phoenix_turret') this.triggerPhoenixTurret();
                
                this.holdTimer = 0;
            }
        }
      }

      // 3. Update enemies
      this.enemies.forEach(enemy => {
        const force = Matter.Vector.sub(this.playerBody.position, enemy.position);
        const normalized = Matter.Vector.normalise(force);
        
        const data = enemy.plugin['data'] as EnemyData;
        if (!data) return;

        let moveSpeed = 0.0001;
        if (data.type === 'bat') moveSpeed = 0.0005;
        if (data.type === 'slime') moveSpeed = 0.00005;
        if (data.type === 'golem') {
            moveSpeed = 0.00002;
            // Golem Ranged Attack
            if (now - (data.lastAttackTime || 0) > 3000) {
                data.lastAttackTime = now;
                this.fireEnemyProjectile(enemy.position);
            }
        }
        if (data.type === 'boss') {
            moveSpeed = this.rageModeActive() ? 0.0003 : 0.0001; // Much faster
            
            const intensity = this.audioService.getAudioIntensity();
            
            // Audio reactive boss attacks
            // Threshold varies if rage mode is active
            const attackThreshold = this.rageModeActive() ? 0.25 : 0.35;
            
            if (intensity > attackThreshold && now - (data.lastAttackTime || 0) > (this.rageModeActive() ? 3000 : 6000)) {
                data.lastAttackTime = now;
                this.fireBossWaveAttack(enemy.position);
            }
            
            if (intensity > attackThreshold - 0.1 && now - (data.lastMinionTime || 0) > (this.rageModeActive() ? 2000 : 4000)) {
                data.lastMinionTime = now;
                for(let i=0; i<3; i++) {
                   this.spawnMinion(enemy.position.x, enemy.position.y);
                }
            }
            
            // If the song is quiet, slowly creep. If loud, move faster
            moveSpeed *= (1 + intensity);

            // Strict Bounds Checking for Boss
            if (enemy.position.x < 100) Matter.Body.setPosition(enemy, { x: 100, y: enemy.position.y });
            if (enemy.position.x > window.innerWidth - 100) Matter.Body.setPosition(enemy, { x: window.innerWidth - 100, y: enemy.position.y });
            if (enemy.position.y < 100) Matter.Body.setPosition(enemy, { x: enemy.position.x, y: 100 });
            if (enemy.position.y > window.innerHeight - 100) Matter.Body.setPosition(enemy, { x: enemy.position.x, y: window.innerHeight - 100 });
        }
        
        Matter.Body.applyForce(enemy, enemy.position, Matter.Vector.mult(normalized, moveSpeed));
      });

      // 4. Magnetism for items
      const magnetRadius = 150 * this.gameState.currentStats().magnetism;
      this.items.forEach(item => {
         const data = item.plugin['data'];
         const isBossGem = this.inBossDefeatSequence() && data && data.type === 'gem';
         
         if (isBossGem && now - this.bossDefeatTimestamp > 1500) {
            // Boss Defeat Homing Phase: Boss gems forcefully float to phoenix after 1.5s
            const force = Matter.Vector.sub(this.playerBody.position, item.position);
            const normalized = Matter.Vector.normalise(force);
            // Cancel existing gravity/velocity and pull strongly
            Matter.Body.setVelocity(item, { x: 0, y: 0 });
            Matter.Body.applyForce(item, item.position, Matter.Vector.mult(normalized, 0.05));
         } else if (data) {
             // Normal Magnetism
             const force = Matter.Vector.sub(this.playerBody.position, item.position);
             const dist = Matter.Vector.magnitude(force);
             if (dist < magnetRadius) {
                const normalized = Matter.Vector.normalise(force);
                const pullStrength = 0.002 * (1 - dist / magnetRadius);
                Matter.Body.applyForce(item, item.position, Matter.Vector.mult(normalized, pullStrength));
             } else {
                 // Fall down via gravity
                 Matter.Body.applyForce(item, item.position, { x: 0, y: 0.00015 });
             }
         }
      });

      // 4.5 Homing Missiles
      const homingLvl = this.gameState.currentStats().homingLevel;
      if (homingLvl > 0 && this.enemies.length > 0) {
          Matter.Composite.allBodies(this.engine.world).forEach(body => {
              if (body.label === 'projectile') {
                  const data = body.plugin['data'] as EnemyData;
                  if (data && data.type === 'projectile_player') {
                      let nearest = this.enemies[0];
                      let minDist = Infinity;
                      this.enemies.forEach(e => {
                          const dist = Matter.Vector.magnitude(Matter.Vector.sub(e.position, body.position));
                          if (dist < minDist) { minDist = dist; nearest = e; }
                      });
                      if (minDist < 600) {
                          const force = Matter.Vector.sub(nearest.position, body.position);
                          const normalized = Matter.Vector.normalise(force);
                          // Starts weak, but scales quadratically with level for stronger homing over time
                          const pullStrength = 0.00003 + (0.000015 * Math.pow(homingLvl, 1.5));
                          Matter.Body.applyForce(body, body.position, Matter.Vector.mult(normalized, pullStrength));
                      }
                  }
              }
          });
      }

      // 4.6 Cleanup off-screen items
      this.items = this.items.filter(item => {
          if (item.position.y > window.innerHeight + 200) {
              if (item.parent) Matter.Composite.remove(this.engine.world, item);
              return false;
          }
          return true;
      });

      // 5. Publish bodies to ParticleBg rendering service
      const entities: PhysicsEntity[] = [];
      const renderBodies = [...Matter.Composite.allBodies(this.engine.world)];
      renderBodies.forEach(body => {
         if (body.label !== 'player') {
             const data = body.plugin['data'] as any;
             if (data) {
                 entities.push({
                     id: data.id,
                     x: body.position.x,
                     y: body.position.y,
                     type: data.type,
                     size: body.circleRadius || 20
                 });
             }
         }
      });
      // Deduplicate by ID
      const uniqueEntities = Array.from(new Map(entities.map(e => [e.id, e])).values());
      this.gameState.activeEntities.set(uniqueEntities);
    });

    this.runner = Runner.create();
    Runner.run(this.runner, this.engine);
  }

  private startGameLoop() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (this.spawnInterval) clearTimeout(this.spawnInterval);
    if (this.attackInterval) clearInterval(this.attackInterval);
    
    this.timerInterval = setInterval(() => {
      if (this.gameEnded() || this.isDead() || this.gameState.isPaused()) return;
      
      this.timeRemaining.update(t => Math.max(0, Math.floor(t - 1)));
      this.gameState.sessionPlayTime.update(t => t + 1);
      
      if (this.timeRemaining() === 0 && this.bossSpawned() && !this.inBossDefeatSequence() && !this.isDead() && !this.rageModeActive()) {
          this.triggerRageMode();
      }
      
      if (this.gameState.sessionPlayTime() >= 60) this.gameState.awardTrophy("Survivor");
      
      if (this.gameState.hasCosmicTrail()) {
          this.gameState.xp.update(x => x + 5 * this.gameState.xpMultiplier());
      }
    }, 1000);

    this.scheduleNextSpawn();

    const attackSpeed = this.gameState.currentStats().attackSpeed;
    this.attackInterval = setInterval(() => {
      if (this.gameEnded() || this.isDead() || this.gameState.isPaused()) return;
      this.fireProjectile();
    }, 1000 / attackSpeed);
    
  }



  private triggerDrillAttack() {
      if (this.gameState.isRebirthing()) return;
      
      const abilityData = this.gameState.worldUpgrades()[this.gameState.selectedWorldIndex()]?.unlockedAbilities['drill_attack'];
      const mods = abilityData?.modifiers || { cooldown: 1.0, speed: 1.0, duration: 1.0, damage: 1.0, radius: 1.0, range: 1.0 };
      const duration = 600 * mods['duration'];

      this.tapCooldown.set(3 * mods['cooldown']);
      this.tapAbilityEndTime = Date.now() + duration;
      this.audioService.playSFX('shoot');
      
      const dir = Matter.Vector.normalise(Matter.Vector.sub({ x: this.mouseX, y: this.mouseY }, this.playerBody.position));
      Matter.Body.setVelocity(this.playerBody, Matter.Vector.mult(dir, 40 * mods['speed']));
      
      this.gameState.isDrilling.set(true);
      setTimeout(() => {
          this.gameState.isDrilling.set(false);
          Matter.Body.setVelocity(this.playerBody, { x: 0, y: 0 });
      }, duration);
  }

  private triggerFireBreath() {
      if (this.gameState.isRebirthing()) return;

      const abilityData = this.gameState.worldUpgrades()[this.gameState.selectedWorldIndex()]?.unlockedAbilities['fire_breath'];
      const mods = abilityData?.modifiers || { cooldown: 1.0, speed: 1.0, duration: 1.0, damage: 1.0, radius: 1.0, range: 1.0, ammo: 1.0 };
      
      // Proximity check - only trigger if an enemy is near
      let nearest = null;
      let minDist = Infinity;
      if (this.enemies.length > 0) {
          nearest = this.enemies[0];
          this.enemies.forEach(e => {
              const dist = Matter.Vector.magnitude(Matter.Vector.sub(e.position, this.playerBody.position));
              if (dist < minDist) { minDist = dist; nearest = e; }
          });
      }
      if (minDist > 500 || !nearest) return; 

      // Ammo-based firing over time
      const ammo = Math.floor(20 * (mods['ammo'] || 1.0));
      const fireIntervalMs = 50;
      const firingDurationSec = (ammo * fireIntervalMs) / 1000;
      
      // Cooldown includes firing duration so it effectively begins after completion
      this.tapCooldown.set(firingDurationSec + (8 * mods['cooldown']));
      this.tapAbilityEndTime = Date.now() + (ammo * fireIntervalMs);
      const damage = this.gameState.currentStats().damage * 0.5 * mods['damage'];
      const range = 12 * mods['range'];
      
      // Smart targeting: Track expected damage to prevent overkill
      const incomingDamage = new Map<string, number>();

      for(let i=0; i<ammo; i++) {
          setTimeout(() => {
              if (this.isDead() || this.gameState.isRebirthing()) return;
              
              // Recalculate target for EACH projectile individually
              let target: any = null;
              let bestDist = Infinity;
              
              if (this.enemies.length > 0) {
                  this.enemies.forEach(e => {
                      const data = e.plugin['data'] as EnemyData;
                      if (!data) return;
                      const currentIncoming = incomingDamage.get(data.id) || 0;
                      // Don't target enemies that will already die from previous projectiles
                      if (data.health - currentIncoming > 0 || data.type === 'boss') {
                          const dist = Matter.Vector.magnitude(Matter.Vector.sub(e.position, this.playerBody.position));
                          if (dist < bestDist) { bestDist = dist; target = e; }
                      }
                  });
                  
                  // Fallback: If all enemies are marked as "dead", just shoot the closest one anyway
                  if (!target) {
                      this.enemies.forEach(e => {
                          const dist = Matter.Vector.magnitude(Matter.Vector.sub(e.position, this.playerBody.position));
                          if (dist < bestDist) { bestDist = dist; target = e; }
                      });
                  }
              }
              
              let fireAngle = 0;
              if (target) {
                  const dirVec = Matter.Vector.sub(target.position, this.playerBody.position);
                  fireAngle = Math.atan2(dirVec.y, dirVec.x);
                  
                  const data = target.plugin['data'] as EnemyData;
                  if (data) {
                      incomingDamage.set(data.id, (incomingDamage.get(data.id) || 0) + damage);
                  }
              }

              this.audioService.playSFX('shoot');
              
              const spreadAngle = (Math.random() - 0.5) * 0.5;
              const angle = fireAngle + spreadAngle;
              const fireDir = { x: Math.cos(angle), y: Math.sin(angle) };
              const proj = Matter.Bodies.circle(this.playerBody.position.x, this.playerBody.position.y, 15, {
                  isSensor: true, label: 'projectile',
                  plugin: { data: { id: Math.random().toString(), type: 'fire', health: 1, maxHealth: 1, burstDamage: damage } as EnemyData }
              });
              Matter.Body.setVelocity(proj, Matter.Vector.mult(fireDir, range));
              Matter.Composite.add(this.engine.world, proj);
              setTimeout(() => { if (proj.parent) Matter.Composite.remove(this.engine.world, proj) }, 500);
          }, i * fireIntervalMs);
      }
  }

  private triggerPhoenixTurret() {
      const abilityData = this.gameState.worldUpgrades()[this.gameState.selectedWorldIndex()]?.unlockedAbilities['phoenix_turret'];
      const mods = abilityData?.modifiers || { cooldown: 1.0, speed: 1.0, duration: 1.0, damage: 1.0, radius: 1.0, range: 1.0 };
      
      const seekRange = 500 * (mods['range'] || 1.0);
      const tetherRange = 100 * (mods['range'] || 1.0);
      const duration = 6000 * mods['duration'];
      const baseDamage = this.gameState.currentStats().damage * mods['damage'];
      
      this.holdCooldown.set(10 * mods['cooldown']);
      this.holdAbilityEndTime = Date.now() + duration + 2000; // Freeze CD during duration + return
      
      const egg = Matter.Bodies.circle(this.playerBody.position.x, this.playerBody.position.y, 20, {
          isStatic: true, isSensor: true, label: 'projectile',
          plugin: { data: { id: Math.random().toString(), type: 'egg', health: 1000, maxHealth: 1000, size: 20, aggroTarget: null } as any }
      });
      Matter.Composite.add(this.engine.world, egg);
      
      setTimeout(() => {
          if (!egg.parent) return;
          this.audioService.playSFX('shoot');
          
          const baby = Matter.Bodies.circle(egg.position.x, egg.position.y - 30, 15, {
              isSensor: true, label: 'projectile', frictionAir: 0.1,
              plugin: { data: { id: Math.random().toString(), type: 'turret', health: 500, maxHealth: 500, size: 15 } as EnemyData }
          });
          Matter.Composite.add(this.engine.world, baby);
          
          let exploded = false;
          let fireInterval: any;
          let boidLogic: any;
          
          const explode = () => {
              if (exploded) return;
              exploded = true;
              if (boidLogic) Matter.Events.off(this.engine, 'beforeUpdate', boidLogic);
              if (fireInterval) clearInterval(fireInterval);
              
              this.audioService.playSFX('explosion');
              const radius = 200;
              
              for (let i = 0; i < 40; i++) {
                  const angle = Math.random() * Math.PI * 2;
                  const speed = Math.random() * 8 + 4;
                  const fireDir = { x: Math.cos(angle), y: Math.sin(angle) };
                  const proj = Matter.Bodies.circle(egg.position.x, egg.position.y, 15, {
                      isSensor: true, label: 'projectile',
                      plugin: { data: { id: Math.random().toString(), type: 'fire', health: 1, maxHealth: 1, burstDamage: baseDamage * 5 } as EnemyData }
                  });
                  Matter.Body.setVelocity(proj, Matter.Vector.mult(fireDir, speed));
                  Matter.Composite.add(this.engine.world, proj);
                  setTimeout(() => { if (proj.parent) Matter.Composite.remove(this.engine.world, proj) }, 500 + Math.random() * 300);
              }
              
              this.enemies.forEach(e => {
                  const dist = Matter.Vector.magnitude(Matter.Vector.sub(e.position, egg.position));
                  if (dist < radius) this.damageEnemy(e, baseDamage * 5);
              });
              
                  Matter.Composite.remove(this.engine.world, baby);
              if (egg.parent) Matter.Composite.remove(this.engine.world, egg);
          };

          let isReturning = false;
          boidLogic = () => {
              const eggData = egg.plugin['data'] as any;
              if (eggData && eggData.health <= 0 && !exploded) {
                  explode();
                  return;
              }
              
              if (!baby.parent || !egg.parent) {
                  if (!exploded) explode();
                  return;
              }
              
              const speed = isReturning ? 4 : (eggData.aggroTarget ? 3 : 2);
              const maxTurnForce = 0.5;
              let combinedForce = { x: 0, y: 0 };
              
              if (isReturning) {
                  const dir = Matter.Vector.normalise(Matter.Vector.sub(egg.position, baby.position));
                  combinedForce.x = dir.x * 5.0;
                  combinedForce.y = dir.y * 5.0;
              } else {
                  const t = Date.now() * 0.002;
                  const wanderForce = { x: Math.cos(t), y: Math.sin(t) };
                  combinedForce.x += wanderForce.x * 0.5;
                  combinedForce.y += wanderForce.y * 0.5;
                  
                  let nearest = null;
                  if (this.enemies.length > 0) {
                      if (eggData && eggData.aggroTarget && eggData.aggroTarget.parent) {
                          nearest = eggData.aggroTarget;
                      } else {
                          nearest = this.enemies[0];
                          let minDist = Infinity;
                          this.enemies.forEach(e => {
                              const dist = Matter.Vector.magnitude(Matter.Vector.sub(e.position, baby.position));
                              if (dist < minDist) { minDist = dist; nearest = e; }
                          });
                      }
                      
                      const distToNearest = Matter.Vector.magnitude(Matter.Vector.sub(nearest.position, baby.position));
                      if (distToNearest < seekRange) {
                          const dir = Matter.Vector.normalise(Matter.Vector.sub(nearest.position, baby.position));
                          combinedForce.x += dir.x * 2.0;
                          combinedForce.y += dir.y * 2.0;
                      }
                  }
                  
                  const distToEgg = Matter.Vector.magnitude(Matter.Vector.sub(baby.position, egg.position));
                  if (distToEgg > tetherRange) {
                      const repel = Matter.Vector.normalise(Matter.Vector.sub(egg.position, baby.position));
                      const repelStrength = (distToEgg - tetherRange) * 0.1;
                      combinedForce.x += repel.x * repelStrength;
                      combinedForce.y += repel.y * repelStrength;
                  }
              }
              
              if (combinedForce.x === 0 && combinedForce.y === 0) combinedForce = { x: 1, y: 0 };
              const desiredVelocity = Matter.Vector.mult(Matter.Vector.normalise(combinedForce), speed);
              const steering = Matter.Vector.sub(desiredVelocity, baby.velocity);
              const steeringMag = Matter.Vector.magnitude(steering);
              
              if (steeringMag > maxTurnForce) {
                  const limitedSteering = Matter.Vector.mult(Matter.Vector.normalise(steering), maxTurnForce);
                  Matter.Body.applyForce(baby, baby.position, Matter.Vector.mult(limitedSteering, 0.005));
              } else {
                  Matter.Body.applyForce(baby, baby.position, Matter.Vector.mult(steering, 0.005));
              }
              
              const currentSpeed = Matter.Vector.magnitude(baby.velocity);
              if (currentSpeed > 0) {
                 Matter.Body.setVelocity(baby, Matter.Vector.mult(Matter.Vector.normalise(baby.velocity), speed));
              } else {
                 Matter.Body.setVelocity(baby, { x: speed, y: 0 });
              }
          };
          
          Matter.Events.on(this.engine, 'beforeUpdate', boidLogic);

          fireInterval = setInterval(() => {
              if (!baby.parent) {
                  clearInterval(fireInterval);
                  return;
              }
              
              if (this.enemies.length > 0) {
                  const eggData = egg.plugin['data'] as any;
                  let nearest = null;
                  if (eggData && eggData.aggroTarget && eggData.aggroTarget.parent) {
                      nearest = eggData.aggroTarget;
                  } else {
                      nearest = this.enemies[0];
                      let minDist = Infinity;
                      this.enemies.forEach(e => {
                          const dist = Matter.Vector.magnitude(Matter.Vector.sub(e.position, baby.position));
                          if (dist < minDist) { minDist = dist; nearest = e; }
                      });
                  }
                  
                  const distToNearest = Matter.Vector.magnitude(Matter.Vector.sub(nearest.position, baby.position));
                  if (distToNearest < seekRange) {
                      const dir = Matter.Vector.normalise(Matter.Vector.sub(nearest.position, baby.position));
                      for(let i=0; i<5; i++) {
                          setTimeout(() => {
                              if (!baby.parent) return;
                              const spreadAngle = (Math.random() - 0.5) * 0.5;
                              const angle = Math.atan2(dir.y, dir.x) + spreadAngle;
                              const fireDir = { x: Math.cos(angle), y: Math.sin(angle) };
                              const proj = Matter.Bodies.circle(baby.position.x, baby.position.y, 10, {
                                  isSensor: true, label: 'projectile',
                                  plugin: { data: { id: Math.random().toString(), type: 'fire', health: 1, maxHealth: 1, burstDamage: baseDamage } as EnemyData }
                              });
                              Matter.Body.setVelocity(proj, Matter.Vector.mult(fireDir, 15));
                              Matter.Composite.add(this.engine.world, proj);
                              setTimeout(() => { if (proj.parent) Matter.Composite.remove(this.engine.world, proj) }, 1000);
                          }, i * 50);
                      }
                  }
              }
          }, 500);

          setTimeout(() => {
              if (!baby.parent || !egg.parent || exploded) return;
              isReturning = true;
              
              const returnCheck = setInterval(() => {
                  if (!baby.parent || !egg.parent || exploded) { clearInterval(returnCheck); return; }
                  const dist = Matter.Vector.magnitude(Matter.Vector.sub(baby.position, egg.position));
                  if (dist < 20) {
                      clearInterval(returnCheck);
                      explode();
                  }
              }, 50);
              
              setTimeout(() => {
                  clearInterval(returnCheck);
                  if (baby.parent && egg.parent && !exploded) explode();
              }, 2000);
          }, duration);
      }, 2000);
  }

  private triggerBurst() {
      if (this.gameState.isRebirthing()) return;

      const abilityData = this.gameState.worldUpgrades()[this.gameState.selectedWorldIndex()]?.unlockedAbilities['burst'];
      const mods = abilityData?.modifiers || { cooldown: 1.0, speed: 1.0, duration: 1.0, damage: 1.0, radius: 1.0, range: 1.0 };

      this.tapCooldown.set(5 * mods['cooldown']);
      const damage = this.gameState.currentStats().burstDamage * mods['damage'];
      const radius = 10 * mods['radius'];
      this.audioService.playSFX('shoot');
      
      for(let i=0; i<8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          const dir = { x: Math.cos(angle), y: Math.sin(angle) };
          const proj = Matter.Bodies.circle(this.playerBody.position.x, this.playerBody.position.y, radius, {
              isSensor: true,
              label: 'projectile',
              plugin: {
                  data: { id: Math.random().toString(), type: 'projectile_player', health: 1, maxHealth: 1, burstDamage: damage } as EnemyData
              }
          });
          Matter.Body.setVelocity(proj, Matter.Vector.mult(dir, 15));
          Matter.Composite.add(this.engine.world, proj);
          setTimeout(() => { if (proj.parent) Matter.Composite.remove(this.engine.world, proj) }, 1000);
      }
  }

  private triggerAura() {
      const abilityData = this.gameState.worldUpgrades()[this.gameState.selectedWorldIndex()]?.unlockedAbilities['aura'];
      const mods = abilityData?.modifiers || { cooldown: 1.0, speed: 1.0, duration: 1.0, damage: 1.0, radius: 1.0, range: 1.0 };
      
      this.holdCooldown.set(15 * mods['cooldown']);
      const radius = this.gameState.currentStats().auraRadius * mods['radius'];
      
      const aura = Matter.Bodies.circle(this.playerBody.position.x, this.playerBody.position.y, radius, {
          isSensor: true,
          label: 'projectile',
          plugin: {
             data: { id: Math.random().toString(), type: 'aura', health: 1, maxHealth: 1, size: radius } as EnemyData
          }
      });
      Matter.Composite.add(this.engine.world, aura);
      
      // Damage everything inside
      this.enemies.forEach(e => {
          const dist = Matter.Vector.magnitude(Matter.Vector.sub(e.position, aura.position));
          if (dist < radius + (e.circleRadius || 0)) {
              this.damageEnemy(e, this.gameState.currentStats().damage * 5 * mods['damage']);
          }
      });

      setTimeout(() => Matter.Composite.remove(this.engine.world, aura), 500); 
  }

  private createEnemyBody(x: number, y: number, size: number, type: string, data: any): Matter.Body {
      const options = {
          label: type === 'boss' ? 'boss' : 'enemy',
          frictionAir: type === 'boss' ? 0.1 : 0.05,
          plugin: { data }
      };

      if (type === 'slime') {
          return Matter.Bodies.rectangle(x, y, size * 2, size * 1.5, { ...options, chamfer: { radius: [size*0.7, size*0.7, 0, 0] } as any });
      } else if (type === 'golem') {
          return Matter.Bodies.circle(x, y, size * 1.5, options);
      } else if (type === 'boss') {
          return Matter.Bodies.circle(x, y, size * 1.5, options);
      }

      return Matter.Bodies.circle(x, y, size, options);
  }

  private spawnBoss() {
    this.bossSpawned.set(true);
    this.clearEnemies();

    const data = { id: Math.random().toString(), type: 'boss', health: 1000, maxHealth: 1000 } as EnemyData;
    const scale = this.screenScale;
    const boss = this.createEnemyBody(window.innerWidth / 2, -100, 100 * scale, 'boss', data);

    this.enemies.push(boss);
    Matter.Composite.add(this.engine.world, boss);
  }

  private scheduleNextSpawn() {
    if (this.spawnInterval) clearTimeout(this.spawnInterval);
    if (!this.gameEnded() && !this.isDead() && !this.bossSpawned() && !this.gameState.isPaused()) {
        // Only spawn if intensity is high enough, giving breathing room on quiet parts
        const intensity = this.audioService.getAudioIntensity();
        if (intensity > 0.1 || Math.random() < 0.2) { 
            this.spawnEnemy();
        }
    }
    
    // Delay driven by audio intensity: lower intensity = longer delay
    const progress = this.progressPercent();
    const intensity = this.audioService.getAudioIntensity(); // 0.0 to ~0.5 usually
    const baseDelay = Math.max(300, 2000 - (progress * 17));
    const intensityModifier = Math.max(0.2, 1.0 - (intensity * 2));
    const delay = baseDelay * intensityModifier;
    
    this.spawnInterval = setTimeout(() => this.scheduleNextSpawn(), delay);
  }

  private spawnEnemy() {
    let x, y;
    const padding = 100; // spawn exactly 100px outside the screen bounds
    if (Math.random() < 0.5) {
        // Top or bottom edge
        x = Math.random() * window.innerWidth;
        y = Math.random() < 0.5 ? -padding : window.innerHeight + padding;
    } else {
        // Left or right edge
        x = Math.random() < 0.5 ? -padding : window.innerWidth + padding;
        y = Math.random() * window.innerHeight;
    }

    const progress = this.progressPercent();
    let type: 'bat' | 'slime' | 'golem' = 'slime';
    const scale = this.screenScale;
    let size = 20 * scale;
    let health = 20;

    const rand = Math.random();
    if (progress > 50 && rand < 0.1) {
      type = 'golem'; size = 60 * scale; health = 200;
    } else if (progress > 20 && rand < 0.4) {
      type = 'bat'; size = 15 * scale; health = 10;
    }

    const data = { id: Math.random().toString(), type, health, maxHealth: health, lastAttackTime: Date.now() } as EnemyData;
    const enemy = this.createEnemyBody(x, y, size, type, data);

    this.enemies.push(enemy);
    Matter.Composite.add(this.engine.world, enemy);
  }

  private fireProjectile() {
    if (this.enemies.length === 0) return;

    let nearest = this.enemies[0];
    let minDist = Infinity;
    this.enemies.forEach(e => {
      const dist = Matter.Vector.magnitude(Matter.Vector.sub(e.position, this.playerBody.position));
      if (dist < minDist) { minDist = dist; nearest = e; }
    });

    if (minDist > 500) return; 

    const dir = Matter.Vector.normalise(Matter.Vector.sub(nearest.position, this.playerBody.position));
    
    // Projectiles spawn EXACTLY at the player body (which is now exactly the Phoenix 3D visual position)
    const projectile = Matter.Bodies.circle(this.playerBody.position.x, this.playerBody.position.y, 8, {
      label: 'projectile',
      isSensor: true,
      plugin: {
          data: { id: Math.random().toString(), type: 'projectile_player', health: 1, maxHealth: 1 } as EnemyData
      }
    });

    Matter.Body.setVelocity(projectile, Matter.Vector.mult(dir, 15));
    Matter.Composite.add(this.engine.world, projectile);
    
    this.audioService.playSFX('shoot');
    setTimeout(() => { if (projectile.parent) Matter.Composite.remove(this.engine.world, projectile); }, 2000);
  }

  private calculateBossGemDrop(realmIndex: number): number {
      // Boss drop should be roughly the equivalent of $5 worth of gems (approx 50 gems)
      // but with a random range, and scaling slightly per realm.
      let min = 40;
      let max = 60;
      
      if (realmIndex > 0) {
          min += realmIndex * 20;
          max += realmIndex * 30;
      }
      return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private fireEnemyProjectile(source: Matter.Vector) {
    const dir = Matter.Vector.normalise(Matter.Vector.sub(this.playerBody.position, source));
    
    const projectile = Matter.Bodies.circle(source.x, source.y, 10, {
      label: 'projectile',
      isSensor: true,
      plugin: {
          data: { id: Math.random().toString(), type: 'projectile_enemy', health: 1, maxHealth: 1 } as EnemyData
      }
    });

    Matter.Body.setVelocity(projectile, Matter.Vector.mult(dir, 8)); // Slower than player projectiles
    Matter.Composite.add(this.engine.world, projectile);
    setTimeout(() => { if (projectile.parent) Matter.Composite.remove(this.engine.world, projectile); }, 3000);
  }

  private spawnMinion(x: number, y: number) {
      const data = { id: Math.random().toString(), type: 'bat', health: 5, maxHealth: 5 } as EnemyData;
      const minion = this.createEnemyBody(x, y, 10, 'bat', data);
      Matter.Body.setVelocity(minion, { x: (Math.random()-0.5)*10, y: (Math.random()-0.5)*10 });
      this.enemies.push(minion);
      Matter.Composite.add(this.engine.world, minion);
  }

  private fireBossWaveAttack(pos: Matter.Vector) {
      this.audioService.playSFX('shoot');
      for (let i = 0; i < 12; i++) {
          const angle = (i / 12) * Math.PI * 2;
          const dir = { x: Math.cos(angle), y: Math.sin(angle) };
          const proj = Matter.Bodies.circle(pos.x, pos.y, 15, {
              label: 'projectile', isSensor: true,
              plugin: { data: { id: Math.random().toString(), type: 'projectile_enemy', health: 1, maxHealth: 1 } as EnemyData }
          });
          Matter.Body.setVelocity(proj, Matter.Vector.mult(dir, 8));
          Matter.Composite.add(this.engine.world, proj);
          
          setTimeout(() => {
              if (proj.parent) {
                  Matter.Body.setVelocity(proj, { x: 0, y: 0 }); // Pause
                  setTimeout(() => {
                      if (proj.parent) {
                          const boss = this.enemies.find(e => e.plugin['data']?.type === 'boss');
                          if (boss) {
                              const returnDir = Matter.Vector.normalise(Matter.Vector.sub(boss.position, proj.position));
                              Matter.Body.setVelocity(proj, Matter.Vector.mult(returnDir, 12));
                              setTimeout(() => { if (proj.parent) Matter.Composite.remove(this.engine.world, proj); }, 2000);
                          } else {
                              Matter.Composite.remove(this.engine.world, proj);
                          }
                      }
                  }, 500);
              }
          }, 1500);
      }
  }

  private damageEnemy(enemy: Matter.Body, damage: number) {
    const data = enemy.plugin['data'] as EnemyData;
    data.health -= damage;
    
    if (data.type === 'boss') {
       this.bossHealth.set(Math.max(0, data.health));
    }
    
    if (data.health <= 0) {
      this.audioService.playSFX('explosion');
      Matter.Composite.remove(this.engine.world, enemy);
      this.enemies = this.enemies.filter(e => e !== enemy);
      
      // Award XP
      let xp = 0;
      if (data.type === 'slime') xp = 2;
      if (data.type === 'bat') xp = 5;
      if (data.type === 'golem') xp = 20;
      if (data.type === 'boss') xp = 500;
      this.gameState.addXp(xp);
      
      // Bestiary Unlock
      if (!this.gameState.unlockedEnemies().includes(data.type) && ['slime', 'bat', 'golem', 'boss'].includes(data.type)) {
          this.gameState.unlockedEnemies.update(arr => [...arr, data.type]);
      }
      
      // Track Kills & Trophies
      this.gameState.awardTrophy("First Blood");
      const currentKills = this.gameState.sessionKills();
      const killCount = (currentKills[data.type] || 0) + 1;
      this.gameState.sessionKills.set({ ...currentKills, [data.type]: killCount });
      
      if (data.type === 'slime' && killCount >= 50) this.gameState.awardTrophy("Slime Slayer");
      if (data.type === 'bat' && killCount >= 25) this.gameState.awardTrophy("Bat Hunter");
      if (data.type === 'golem' && killCount >= 5) this.gameState.awardTrophy("Golem Breaker");
      
      if (data.type === 'boss') {
        this.gameState.awardTrophy("Realm Conqueror");
        
        // Setup Cinematic Defeat Sequence
        this.inBossDefeatSequence.set(true);
        this.bossDefeatTimestamp = Date.now();
        this.bossGemsCollected = 0;
        
        // Base gems based on realm index (Only drop on first defeat!)
        const currentWorldIndex = this.gameState.selectedWorldIndex();
        const isFirstDefeat = !this.gameState.unlockedWorlds().includes(currentWorldIndex + 1);
        const intendedGems = isFirstDefeat ? this.calculateBossGemDrop(currentWorldIndex) : 0;
        
        const scaleAtEnd = Math.max(0.2, 1 - (this.progressPercent() / 100));
        
        // Cap physical gem bodies at 100 to prevent physics lag on mobile
        this.bossGemsDropped = isFirstDefeat ? Math.min(100, Math.floor(intendedGems / scaleAtEnd)) : 0;
        
        if (this.bossGemsDropped > 0) {
            const valPerGem = intendedGems / (this.bossGemsDropped * scaleAtEnd);
            for(let i=0; i<this.bossGemsDropped; i++) {
                setTimeout(() => {
                    this.dropItem(enemy.position.x + (Math.random()-0.5)*150, enemy.position.y + (Math.random()-0.5)*150, 'gem', valPerGem);
                    this.audioService.playSFX('drop');
                }, i * 30);
            }
        } else {
            // If no gems dropped, automatically ascend after a delay to let the coins bounce
            setTimeout(() => {
                if (!this.animatingAscension()) this.triggerAscension();
            }, 1500);
        }
        
        // Coins explosion (Huge visual blast, value scales to intended)
        const intendedCoins = 1000;
        const physicalCoins = Math.min(150, Math.floor(intendedCoins / scaleAtEnd));
        const valPerCoin = intendedCoins / (physicalCoins * scaleAtEnd);
        for(let i=0; i<physicalCoins; i++) {
           setTimeout(() => {
               this.dropItem(enemy.position.x + (Math.random()-0.5)*200, enemy.position.y + (Math.random()-0.5)*200, 'coin', valPerCoin);
               this.audioService.playSFX('drop');
           }, i * 15); // Stagger drop and sound for a nice "brrrrr" effect
        }
        
        this.triggerMassiveExplosion(enemy.position.x, enemy.position.y);
        
        // Remove the boss completely so it doesn't trigger damage or blocks anymore
        Matter.Composite.remove(this.engine.world, enemy);
        this.enemies = this.enemies.filter(e => e !== enemy);
        
        // Stop the normal timers so enemies stop spawning
        clearInterval(this.timerInterval);
        clearInterval(this.spawnInterval);
        clearInterval(this.attackInterval);
        
        // We do NOT call winGame() instantly here anymore!
      } else {
        if (data.type === 'golem') {
            for (let i = 0; i < 5; i++) {
                this.dropItem(enemy.position.x + (Math.random()-0.5)*20, enemy.position.y + (Math.random()-0.5)*20, 'coin', 10);
            }
        } else {
            if (Math.random() < 0.6) { // 60% chance to drop coins
                const amount = Math.floor(Math.random() * 3) + 1; // 1 to 3 coins visually
                for (let i = 0; i < amount; i++) {
                    this.dropItem(enemy.position.x + (Math.random()-0.5)*15, enemy.position.y + (Math.random()-0.5)*15, 'coin', 5);
                }
            }
        }
        if (Math.random() < 0.1) { // 10% chance for a heart
            this.dropItem(enemy.position.x + 20, enemy.position.y + 20, 'heart', 20); // Heals 20
        }
      }
    } else {
      // Hit sound removed permanently
    }
  }

  private dropItem(x: number, y: number, type: 'coin' | 'gem' | 'heart', value: number) {
      const item = Matter.Bodies.circle(x, y, type === 'gem' ? 15 : 10, {
          isSensor: true,
          label: 'item',
          frictionAir: 0.1,
          plugin: {
              data: { id: Math.random().toString(), type: type, value: value } as any
          }
      });
      Matter.Body.setVelocity(item, { x: (Math.random() - 0.5) * 5, y: (Math.random() - 0.5) * 5 });
      Matter.Composite.add(this.engine.world, item);
      this.items.push(item);
  }

  private takeDamage(amount: number) {
    if (this.isDead() || this.gameEnded() || this.gameState.isRebirthing()) return;
    
    if (this.gameState.hasCelestialShield() && this.celestialShieldActive()) {
        this.celestialShieldActive.set(false);
        // Hit sound removed permanently
        setTimeout(() => this.celestialShieldActive.set(true), 30000);
        return;
    }
    
    if (this.gameState.isDrilling()) {
        amount *= 0.1;
    }

    // Hit sound removed permanently
    this.currentHealth.update(h => Math.max(0, h - amount));
    this.damageFlash.set(true);
    setTimeout(() => this.damageFlash.set(false), 200);

    if (this.currentHealth() <= 0) {
      const activeHold = this.gameState.currentStats().activeHoldAbility;
      if (activeHold === 'rebirth' && this.holdCooldown() === 0) {
         this.holdCooldown.set(this.getHoldMaxCooldown());
         this.gameState.isRebirthing.set(true);
         // Hit sound removed permanently
         
         // 3 second Ash visual effect loop
         const ashInterval = setInterval(() => {
             if (!this.gameState.isRebirthing()) {
                 clearInterval(ashInterval);
                 return;
             }
             const ash = document.createElement('div');
             ash.style.position = 'fixed';
             ash.style.left = `${this.playerBody.position.x + (Math.random()-0.5)*30}px`;
             ash.style.top = `${this.playerBody.position.y + (Math.random()-0.5)*30}px`;
             ash.style.width = '4px';
             ash.style.height = '4px';
             ash.style.backgroundColor = '#9ca3af';
             ash.style.borderRadius = '50%';
             ash.style.pointerEvents = 'none';
             ash.style.zIndex = '50';
             document.body.appendChild(ash);
             anime({
                 targets: ash,
                 translateY: -50,
                 opacity: [1, 0],
                 duration: 1000,
                 easing: 'linear',
                 complete: () => ash.remove()
             });
         }, 100);
         
         // 3 second Ash state
         setTimeout(() => {
             clearInterval(ashInterval);
             this.gameState.isRebirthing.set(false);
             this.currentHealth.set(Math.floor(this.maxHealth() / 2)); 
             
             // Massive explosion
             const radius = 500;
             const explosion = Matter.Bodies.circle(this.playerBody.position.x, this.playerBody.position.y, radius, {
                 isSensor: true, label: 'projectile',
                 plugin: { data: { id: Math.random().toString(), type: 'aura', health: 1, maxHealth: 1, size: radius } as EnemyData }
             });
             Matter.Composite.add(this.engine.world, explosion);
             setTimeout(() => { if (explosion.parent) Matter.Composite.remove(this.engine.world, explosion) }, 500);
             
             this.enemies.forEach(e => {
                 const dist = Matter.Vector.magnitude(Matter.Vector.sub(e.position, this.playerBody.position));
                 if (dist < radius) this.damageEnemy(e, this.gameState.currentStats().damage * 10);
             });
             
             this.audioService.playSFX('explosion');
             
             // Volcanic fire rebirth particles
             for (let i = 0; i < 30; i++) {
                 const angle = (i / 30) * Math.PI * 2;
                 const speed = 8 + Math.random() * 8;
                 const fireDir = { x: Math.cos(angle), y: Math.sin(angle) };
                 const proj = Matter.Bodies.circle(this.playerBody.position.x, this.playerBody.position.y, 15, {
                     isSensor: true, label: 'projectile',
                     plugin: { data: { id: Math.random().toString(), type: 'fire', health: 1, maxHealth: 1, burstDamage: this.gameState.currentStats().damage * 3 } as EnemyData }
                 });
                 Matter.Body.setVelocity(proj, Matter.Vector.mult(fireDir, speed));
                 Matter.Composite.add(this.engine.world, proj);
                 setTimeout(() => { if (proj.parent) Matter.Composite.remove(this.engine.world, proj) }, 800 + Math.random() * 600);
             }
         }, 3000);
         return;
      }
      this.triggerDeathSequence();
    }
  }

  private triggerImpactEffect(x: number, y: number, isBoss: boolean) {
    const numParticles = isBoss ? 30 : 10;
    const colors = ['#fbbf24', '#f97316', '#ffffff'];
    
    for (let i = 0; i < numParticles; i++) {
        const particle = document.createElement('div');
        particle.style.position = 'fixed';
        particle.style.left = `${x}px`;
        particle.style.top = `${y}px`;
        particle.style.width = isBoss ? '12px' : '6px';
        particle.style.height = isBoss ? '12px' : '6px';
        particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        particle.style.borderRadius = '50%';
        particle.style.pointerEvents = 'none';
        particle.style.zIndex = '100';
        document.body.appendChild(particle);

        const angle = Math.random() * Math.PI * 2;
        const velocity = isBoss ? 50 + Math.random() * 150 : 20 + Math.random() * 80;

        anime({
            targets: particle,
            translateX: Math.cos(angle) * velocity,
            translateY: Math.sin(angle) * velocity + (isBoss ? 50 : 20), // slight gravity
            opacity: [1, 0],
            scale: [1, 0],
            duration: isBoss ? 1500 : 800,
            easing: 'easeOutExpo',
            complete: () => particle.remove()
        });
    }
  }

  private triggerMassiveExplosion(x: number, y: number) {
    const colors = ['#a855f7', '#fbbf24', '#f97316'];
    for (let i = 0; i < 100; i++) {
        const particle = document.createElement('div');
        particle.style.position = 'fixed';
        particle.style.left = `${x}px`;
        particle.style.top = `${y}px`;
        particle.style.width = '10px';
        particle.style.height = '10px';
        particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        particle.style.borderRadius = '2px'; // Square fragments
        particle.style.pointerEvents = 'none';
        particle.style.zIndex = '100';
        document.body.appendChild(particle);

        const angle = Math.random() * Math.PI * 2;
        const velocity = 100 + Math.random() * 300;

        anime({
            targets: particle,
            translateX: Math.cos(angle) * velocity,
            translateY: Math.sin(angle) * velocity + 150, // gravity effect
            rotate: Math.random() * 360,
            opacity: [1, 0],
            duration: 2000 + Math.random() * 1000,
            easing: 'easeOutCirc',
            complete: () => particle.remove()
        });
    }
  }

  private triggerDeathSequence() {
    this.isDead.set(true);
    this.gameState.phoenixOverridePosition.set({ x: window.innerWidth / 2, y: window.innerHeight + 200 });
    this.gameState.syncProgressToServer();

    if (this.runner) Matter.Runner.stop(this.runner);
    
    // Revive mechanic logic
    this.reviveCountdown.set(10);
    this.reviveInterval = setInterval(() => {
        this.reviveCountdown.update(c => c - 1);
        if (this.reviveCountdown() <= 0) {
            clearInterval(this.reviveInterval);
            this.quitGame();
        }
    }, 1000);
  }

  private startReviveCountdown() {
      if (this.reviveInterval) clearInterval(this.reviveInterval);
      this.reviveInterval = setInterval(() => {
          this.reviveCountdown.update(c => c - 1);
          if (this.reviveCountdown() <= 0) {
              clearInterval(this.reviveInterval);
              this.quitGame();
          }
      }, 1000);
  }

  public getReviveCost(): number {
    return 10 * Math.pow(2, this.reviveCount);
  }

  public reviveWithGems() {
    const cost = this.getReviveCost();
    if (this.gameState.gems() >= cost) { 
        this.gameState.gems.update(g => g - cost); 
        this.reviveCount++;
        this.executeRevival(); 
    }
  }

  public reviveWithAd() {
    // Pause the countdown while ad plays
    clearInterval(this.reviveInterval);
    
    const win = window as any;
    if (typeof win.adBreak === 'function') {
        win.adBreak({
            type: 'reward',
            name: 'revive_ad',
            beforeReward: (showAdFn: any) => { showAdFn(); },
            adViewed: () => {
                this.executeRevival();
            },
            adDismissed: () => {
                // User skipped ad, resume countdown
                this.startReviveCountdown();
            },
            beforeAd: () => {
                this.audioService.pauseAudioForAd();
            },
            afterAd: () => {
                this.audioService.resumeAudioAfterAd();
            }
        });
    } else {
        console.warn("Google AdSense adBreak API not found. Mocking ad watch...");
        // Mock 2 second ad watch
        this.audioService.pauseAudioForAd();
        
        setTimeout(() => {
            this.audioService.resumeAudioAfterAd();
            
            this.executeRevival();
        }, 2000);
    }
  }

  private executeRevival() {
    clearInterval(this.reviveInterval);
    this.isDead.set(false);
    this.currentHealth.set(this.maxHealth());
    this.gameState.phoenixOverridePosition.set(null);
    this.clearEnemies();
    if (this.runner && this.engine) Matter.Runner.run(this.runner, this.engine); // Unfreeze physics
    if (this.bossSpawned()) {
        // Boss fight continues: reset timer so rage mode doesn't trigger instantly
        this.timeRemaining.set(this.totalTimeSignal());
        // Restart the intense BGM if it ended
        if (this.audioService.onIntenseBgmEnded() || this.audioService.getBgmDuration() === 0) {
            this.audioService.playIntenseBgm(this.gameState.selectedWorldIndex());
        } else {
            this.audioService.resumeCurrentBgm();
        }
    }
  }

  private clearEnemies() {
    this.enemies.forEach(e => {
        if (e.plugin['data']?.type !== 'boss') {
            Matter.Composite.remove(this.engine.world, e);
        }
    });
    this.enemies = this.enemies.filter(e => e.plugin['data']?.type === 'boss');
    this.items.forEach(i => Matter.Composite.remove(this.engine.world, i));
    this.items = [];
  }

  private winGame() {
    this.gameEnded.set(true);
    this.gameWon.set(true);
    
    this.gameState.phoenixOverridePosition.set({ x: window.innerWidth / 2, y: window.innerHeight / 2 }); 

    const currentIdx = this.gameState.selectedWorldIndex();
    const nextIdx = currentIdx + 1;
    if (nextIdx < this.gameState.worlds.length && !this.gameState.unlockedWorlds().includes(nextIdx)) {
      this.gameState.unlockedWorlds.update(worlds => [...worlds, nextIdx]);
    }
    
    this.gameState.syncProgressToServer();
  }
  
  private triggerAscension() {
      this.animatingAscension.set(true);
      
      // Animate Phoenix flying upwards
      const startY = this.gameState.phoenixScreenPos().y;
      const endY = -200; // Off screen top
      const duration = 2000;
      const startTime = Date.now();
      
      const animateFrame = () => {
          const now = Date.now();
          const progress = Math.min((now - startTime) / duration, 1);
          
          // Easing: easeInQuad (accelerates upwards)
          const currentY = startY + (endY - startY) * (progress * progress);
          
          this.gameState.phoenixOverridePosition.set({ x: window.innerWidth / 2, y: currentY });
          
          if (progress < 1) {
              requestAnimationFrame(animateFrame);
          } else {
              this.executeRealmTransition();
          }
      };
      
      requestAnimationFrame(animateFrame);
  }
  
  private executeRealmTransition() {
      // 1. Advance to next realm seamlessly
      const currentIdx = this.gameState.selectedWorldIndex();
      const nextIdx = currentIdx + 1;
      
      if (nextIdx < this.gameState.worlds.length && !this.gameState.worlds[nextIdx].isComingSoon) {
          if (!this.gameState.unlockedWorlds().includes(nextIdx)) {
              this.gameState.unlockedWorlds.update(worlds => [...worlds, nextIdx]);
          }
          this.gameState.selectedWorldIndex.set(nextIdx);
          
          // Flash animation for cool realm switch
          const flash = document.createElement('div');
          flash.className = 'fixed inset-0 bg-white z-[100] pointer-events-none transition-opacity duration-1000';
          document.body.appendChild(flash);
          
          // Force reflow
          void flash.offsetWidth;
          
          setTimeout(() => flash.style.opacity = '0', 50);
          setTimeout(() => flash.remove(), 1050);
      } else {
          // If the next realm is coming soon, just go to the main screen by quitting
          this.quitGame();
          return;
      }
      
      this.gameState.syncProgressToServer();
      
      // 2. Reset Sequence States
      this.inBossDefeatSequence.set(false);
      this.animatingAscension.set(false);
      this.bossSpawned.set(false);
      this.clearEnemies();
      
      // 3. Animate Phoenix entering from bottom
      const startY = window.innerHeight + 200; // Off screen bottom
      const endY = window.innerHeight / 2; // Default starting position
      const duration = 1500;
      const startTime = Date.now();
      
      const animateEntrance = () => {
          const now = Date.now();
          const progress = Math.min((now - startTime) / duration, 1);
          
          // Easing: easeOutQuad (decelerates upwards)
          const currentY = startY + (endY - startY) * (progress * (2 - progress));
          this.gameState.phoenixOverridePosition.set({ x: window.innerWidth / 2, y: currentY });
          
          if (progress < 1) {
              requestAnimationFrame(animateEntrance);
          } else {
              this.gameState.phoenixOverridePosition.set(null); // Return to mouse control
              
              // 4. Restart Level fully
              this.timeRemaining.set(this.totalTimeSignal());
              this.startGameLoop();
          }
      };
      
      requestAnimationFrame(animateEntrance);
  }

  public togglePause() {
    if (this.gameEnded() || this.isDead()) return;
    
    // If cheat was prepared and we are resuming, trigger it
    if (this.gameState.isPaused() && this.cheatPrepared()) {
        // Fast forward song to 1 second before it ends
        this.audioService.worldBgm.currentTime = Math.max(0, this.audioService.worldBgm.duration - 1);
        this.cheatPrepared.set(false);
    }

    this.gameState.isPaused.set(!this.gameState.isPaused());
    
    if (this.gameState.isPaused()) {
        Matter.Runner.stop(this.runner);
        this.audioService.pauseCurrentBgm();
    } else {
        Matter.Runner.run(this.runner, this.engine);
        this.audioService.resumeCurrentBgm();
    }
  }

  private onKeyDown(event: KeyboardEvent) { if (event.key === 'Escape') this.togglePause(); }
  private onVisibilityChange() { if (document.hidden && !this.gameState.isPaused() && !this.gameEnded() && !this.isDead()) this.togglePause(); }
  public onPauseTextClick() {
      this.pauseClickCount++;
      if (this.pauseClickCount >= 5) {
          this.cheatPrepared.set(true);
          this.pauseClickCount = 0;
      }
  }

  public quitGame() { 
      this.gameState.isPaused.set(false);
      this.cheatPrepared.set(false);
      this.gameState.coins.update(c => Math.floor(c));
      this.gameState.gems.update(g => Math.floor(g));
      this.audioService.playMenuBgm();
      this.gameState.activeScreen.set('menu'); 
  }

  private onMouseMove(event: MouseEvent) { this.updateMouseInput(event.clientX, event.clientY); }
  private onTouchMove(event: TouchEvent) { 
      event.preventDefault(); 
      if (event.touches.length > 0) this.updateMouseInput(event.touches[0].clientX, event.touches[0].clientY); 
  }
  
  private updateMouseInput(x: number, y: number) {
      this.mouseX = x;
      this.mouseY = y;
  }

  private onMouseDown(event: MouseEvent) { this.handleInputStart(event.clientX, event.clientY); }
  private onTouchStart(event: TouchEvent) { 
      // Do not prevent default here, as it blocks UI clicks (like the pause button)
      if (event.touches.length > 0) this.handleInputStart(event.touches[0].clientX, event.touches[0].clientY); 
  }
  
  private handleInputStart(x: number, y: number) {
      this.isMouseHeld = true;
      this.holdStartX = x;
      this.holdStartY = y;
      this.holdTimer = 0;

      const now = Date.now();
      if (now - this.lastClickTime < 300 && this.tapCooldown() <= 0 && !this.gameState.isPaused()) {
          const ability = this.gameState.currentStats().activeTapAbility;
          if (ability === 'burst') this.triggerBurst();
          else if (ability === 'drill_attack') this.triggerDrillAttack();
          else if (ability === 'fire_breath') this.triggerFireBreath();
      }
      this.lastClickTime = now;
  }

  private onMouseUp() { this.isMouseHeld = false; }
  private onTouchEnd() { this.isMouseHeld = false; }

  public formatTime(seconds: number): string {
    const totalSeconds = Math.floor(seconds);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }
}
