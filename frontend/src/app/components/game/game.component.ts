import { Component, ElementRef, OnInit, OnDestroy, ViewChild, inject, NgZone, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameStateService, PhysicsEntity, ABILITIES } from '../../services/game-state.service';
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
      <div class="absolute bottom-8 left-1/2 -translate-x-1/2 w-64 flex flex-col items-center gap-2 pointer-events-auto">
        <div class="w-full h-4 bg-black/50 border border-white/20 rounded-full overflow-hidden shadow-[0_0_15px_rgba(255,0,0,0.2)]">
           <div class="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-300"
                [style.width]="(currentHealth() / maxHealth()) * 100 + '%'"></div>
        </div>
        <span class="text-red-400 font-bold text-sm">{{ currentHealth() }} / {{ maxHealth() }}</span>
      </div>

      <!-- Cooldown UI -->
      <div class="absolute bottom-8 right-8 flex gap-4 pointer-events-auto">
        <!-- Tap Ability -->
        <div class="relative w-16 h-16 bg-black/50 border border-white/20 rounded-2xl overflow-hidden flex items-center justify-center backdrop-blur-sm shadow-[0_0_15px_rgba(255,100,200,0.2)]">
          <span class="text-3xl z-10" [class.opacity-50]="tapCooldown() > 0">{{ getTapIcon() }}</span>
          @if (tapCooldown() > 0) {
            <div class="absolute bottom-0 left-0 w-full bg-pink-600/50 transition-all" [style.height]="(tapCooldown() / getTapMaxCooldown()) * 100 + '%'"></div>
            <span class="absolute z-20 text-white font-bold drop-shadow-md">{{ tapCooldown().toFixed(1) }}</span>
          }
        </div>
        <!-- Hold Ability -->
        <div class="relative w-16 h-16 bg-black/50 border border-white/20 rounded-2xl overflow-hidden flex items-center justify-center backdrop-blur-sm shadow-[0_0_15px_rgba(0,255,255,0.2)]">
          <span class="text-3xl z-10" [class.opacity-50]="holdCooldown() > 0">{{ getHoldIcon() }}</span>
          @if (holdCooldown() > 0) {
            <div class="absolute bottom-0 left-0 w-full bg-cyan-600/50 transition-all" [style.height]="(holdCooldown() / getHoldMaxCooldown()) * 100 + '%'"></div>
            <span class="absolute z-20 text-white font-bold drop-shadow-md">{{ holdCooldown().toFixed(1) }}</span>
          }
        </div>
      </div>

      <!-- Boss Warning -->
      @if (bossSpawned()) {
        <div class="absolute top-24 left-1/2 -translate-x-1/2 animate-pulse pointer-events-none">
           <h2 class="text-4xl font-black text-red-600 drop-shadow-[0_0_20px_rgba(255,0,0,0.8)] tracking-widest uppercase">World Boss Approaching</h2>
        </div>
      }

      <!-- Pause Button -->
      <button (click)="togglePause()" class="absolute top-8 right-8 w-12 h-12 bg-black/50 border border-white/20 rounded-full flex items-center justify-center pointer-events-auto hover:bg-white/10 transition z-20">
        <span class="text-white font-bold text-xl">||</span>
      </button>

      <!-- Pause Screen -->
      @if (gameState.isPaused()) {
        <div class="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center pointer-events-auto z-40">
          <h2 class="text-6xl font-black text-white mb-8 drop-shadow-lg tracking-widest">PAUSED</h2>
          
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
            <button (click)="reviveWithGems()" class="w-full py-4 bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:brightness-125 border border-fuchsia-400/50 rounded-2xl flex justify-center items-center gap-3 transition shadow-[0_0_20px_rgba(200,0,255,0.3)]">
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
  
  public maxHealth = computed(() => this.gameState.currentStats().maxHealth);
  public currentHealth = signal<number>(this.maxHealth());
  public damageFlash = signal<boolean>(false);
  public reviveCount = 0;
  public celestialShieldActive = signal<boolean>(true);
  
  private totalTime = 300; 
  public timeRemaining = signal<number>(this.totalTime);
  public progressPercent = computed(() => ((this.totalTime - this.timeRemaining()) / this.totalTime) * 100);
  
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

  constructor(private ngZone: NgZone) {
      effect(() => {
          const hpRatio = this.currentHealth() / this.maxHealth();
          if (hpRatio < 0.3 && hpRatio > 0 && !this.gameState.isPaused() && !this.gameEnded()) {
              this.audioService.playIntenseBgm();
          } else {
              this.audioService.stopIntenseBgm();
          }
      });
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

    // Invisible player hitbox (Compound Body for Bird Shape)
    const birdCore = Bodies.rectangle(window.innerWidth / 2, window.innerHeight / 2, 10, 20, { label: 'player' });
    const birdLeftWing = Bodies.rectangle(window.innerWidth / 2 - 15, window.innerHeight / 2 - 5, 20, 8, { label: 'player' });
    const birdRightWing = Bodies.rectangle(window.innerWidth / 2 + 15, window.innerHeight / 2 - 5, 20, 8, { label: 'player' });
    
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
                const scale = Math.max(0.2, 1 - (this.progressPercent() / 100));
                this.gameState.coins.update(c => c + (val * scale * this.gameState.coinMultiplier()));
            }
            if (data.type === 'gem') {
                const scale = Math.max(0.2, 1 - (this.progressPercent() / 100));
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
                const scale = Math.max(0.2, 1 - (this.progressPercent() / 100));
                
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
            moveSpeed = 0.0001; // Much faster
            
            if (now - (data.lastAttackTime || 0) > 8000) {
                data.lastAttackTime = now;
                this.fireBossWaveAttack(enemy.position);
            }
            if (now - (data.lastMinionTime || 0) > 5000) {
                data.lastMinionTime = now;
                for(let i=0; i<3; i++) {
                   this.spawnMinion(enemy.position.x, enemy.position.y);
                }
            }

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
                 Matter.Body.applyForce(item, item.position, { x: 0, y: 0.0005 });
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
      
      this.timeRemaining.update(t => Math.max(0, t - 1));
      this.gameState.sessionPlayTime.update(t => t + 1);
      
      if (this.gameState.sessionPlayTime() >= 60) this.gameState.awardTrophy("Survivor");
      
      if (this.gameState.hasCosmicTrail()) {
          this.gameState.xp.update(x => x + 5 * this.gameState.xpMultiplier());
      }
      
      if (this.timeRemaining() === 0 && !this.bossSpawned()) {
        this.spawnBoss();
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
      const mods = abilityData?.modifiers || { cooldown: 1.0, speed: 1.0, duration: 1.0, damage: 1.0, radius: 1.0, range: 1.0 };
      
      this.tapCooldown.set(8 * mods['cooldown']);
      this.tapAbilityEndTime = Date.now() + 1000;
      const damage = this.gameState.currentStats().damage * 0.5 * mods['damage'];
      const range = 12 * mods['range'];
      this.audioService.playSFX('shoot');
      
      // Auto-target nearest enemy instead of mouse
      let fireAngle = 0;
      if (this.enemies.length > 0) {
          let nearest = this.enemies[0];
          let minDist = Infinity;
          this.enemies.forEach(e => {
              const dist = Matter.Vector.magnitude(Matter.Vector.sub(e.position, this.playerBody.position));
              if (dist < minDist) { minDist = dist; nearest = e; }
          });
          const dirVec = Matter.Vector.sub(nearest.position, this.playerBody.position);
          fireAngle = Math.atan2(dirVec.y, dirVec.x);
      } else {
          // Fallback to pointing right if no enemies
          fireAngle = 0;
      }
      
      // Longer duration fire breath (20 projectiles over 1000ms)
      for(let i=0; i<20; i++) {
          setTimeout(() => {
              if (this.isDead() || this.gameState.isRebirthing()) return; // stop if player dies during breath
              
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
          }, i * 50);
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
          plugin: { data: { id: Math.random().toString(), type: 'egg', health: 1, maxHealth: 1, size: 20 } as EnemyData }
      });
      Matter.Composite.add(this.engine.world, egg);
      
      setTimeout(() => {
          if (!egg.parent) return;
          this.audioService.playSFX('shoot');
          
          const baby = Matter.Bodies.circle(egg.position.x, egg.position.y - 30, 15, {
              isSensor: true, label: 'projectile', frictionAir: 0.1,
              plugin: { data: { id: Math.random().toString(), type: 'turret', health: 1, maxHealth: 1, size: 15 } as EnemyData }
          });
          Matter.Composite.add(this.engine.world, baby);
          
          // Remove rigid constraint so we can use smooth Boids steering
          // (No constraint created)

          // 1. Continuous Boids Steering Logic
          let isReturning = false;
          const boidLogic = () => {
              if (!baby.parent || !egg.parent) return;
              
              const speed = isReturning ? 8 : 4;
              const maxTurnForce = 0.5;
              let combinedForce = { x: 0, y: 0 };
              
              if (isReturning) {
                  const dir = Matter.Vector.normalise(Matter.Vector.sub(egg.position, baby.position));
                  combinedForce.x = dir.x * 5.0;
                  combinedForce.y = dir.y * 5.0;
              } else {
                  // Organic Wander
                  const t = Date.now() * 0.002;
                  const wanderForce = { x: Math.cos(t), y: Math.sin(t) };
                  combinedForce.x += wanderForce.x * 0.5;
                  combinedForce.y += wanderForce.y * 0.5;
                  
                  // Enemy Seek
                  let nearest = null;
                  if (this.enemies.length > 0) {
                      nearest = this.enemies[0];
                      let minDist = Infinity;
                      this.enemies.forEach(e => {
                          const dist = Matter.Vector.magnitude(Matter.Vector.sub(e.position, baby.position));
                          if (dist < minDist) { minDist = dist; nearest = e; }
                      });
                      if (minDist < seekRange) {
                          const dir = Matter.Vector.normalise(Matter.Vector.sub(nearest.position, baby.position));
                          combinedForce.x += dir.x * 2.0;
                          combinedForce.y += dir.y * 2.0;
                      }
                  }
                  
                  // Soft Containment (Repel if far from egg)
                  const distToEgg = Matter.Vector.magnitude(Matter.Vector.sub(baby.position, egg.position));
                  if (distToEgg > tetherRange) {
                      const repel = Matter.Vector.normalise(Matter.Vector.sub(egg.position, baby.position));
                      const repelStrength = (distToEgg - tetherRange) * 0.1; // Dynamic weight based on how far out it is
                      combinedForce.x += repel.x * repelStrength;
                      combinedForce.y += repel.y * repelStrength;
                  }
              }
              
              // Reynolds Steering
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
              
              // Ensure constant forward motion
              const currentSpeed = Matter.Vector.magnitude(baby.velocity);
              if (currentSpeed > 0) {
                 Matter.Body.setVelocity(baby, Matter.Vector.mult(Matter.Vector.normalise(baby.velocity), speed));
              } else {
                 Matter.Body.setVelocity(baby, { x: speed, y: 0 });
              }
          };
          
          Matter.Events.on(this.engine, 'beforeUpdate', boidLogic);

          // 2. Fire Breathing Interval
          const fireInterval = setInterval(() => {
              if (!baby.parent) {
                  clearInterval(fireInterval);
                  return;
              }
              
              if (this.enemies.length > 0) {
                  let nearest = this.enemies[0];
                  let minDist = Infinity;
                  this.enemies.forEach(e => {
                      const dist = Matter.Vector.magnitude(Matter.Vector.sub(e.position, baby.position));
                      if (dist < minDist) { minDist = dist; nearest = e; }
                  });
                  if (minDist < seekRange) {
                      const dir = Matter.Vector.normalise(Matter.Vector.sub(nearest.position, baby.position));
                      // Breathe a cone of fire
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
              if (!baby.parent || !egg.parent) return;
              clearInterval(fireInterval);
              isReturning = true;
              
              let exploded = false;
              const explode = () => {
                  if (exploded) return;
                  exploded = true;
                  if (!baby.parent || !egg.parent) return;
                  Matter.Events.off(this.engine, 'beforeUpdate', boidLogic);
                  
                  // Volcanic explosion for turret
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
                  Matter.Composite.remove(this.engine.world, egg);
              };

              const returnCheck = setInterval(() => {
                  if (!baby.parent || !egg.parent) { clearInterval(returnCheck); return; }
                  const dist = Matter.Vector.magnitude(Matter.Vector.sub(baby.position, egg.position));
                  if (dist < 20) {
                      clearInterval(returnCheck);
                      explode();
                  }
              }, 50);
              
              setTimeout(() => {
                  clearInterval(returnCheck);
                  if (baby.parent && egg.parent) explode();
              }, 2000); // 2 second max return time
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
    const boss = this.createEnemyBody(window.innerWidth / 2, -100, 100, 'boss', data);

    this.enemies.push(boss);
    Matter.Composite.add(this.engine.world, boss);
  }

  private scheduleNextSpawn() {
    if (this.spawnInterval) clearTimeout(this.spawnInterval);
    if (!this.gameEnded() && !this.isDead() && !this.bossSpawned() && !this.gameState.isPaused()) {
        this.spawnEnemy();
    }
    
    // Calculate next delay based on progress (from 2000ms down to 300ms)
    const progress = this.progressPercent();
    const delay = Math.max(300, 2000 - (progress * 17));
    this.spawnInterval = setTimeout(() => this.scheduleNextSpawn(), delay);
  }

  private spawnEnemy() {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.max(window.innerWidth, window.innerHeight) * 0.6; 
    const x = this.playerBody.position.x + Math.cos(angle) * distance;
    const y = this.playerBody.position.y + Math.sin(angle) * distance;

    const progress = this.progressPercent();
    let type: 'bat' | 'slime' | 'golem' = 'slime';
    let size = 20;
    let health = 20;

    const rand = Math.random();
    if (progress > 50 && rand < 0.1) {
      type = 'golem'; size = 60; health = 200;
    } else if (progress > 20 && rand < 0.4) {
      type = 'bat'; size = 15; health = 10;
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
                this.dropItem(enemy.position.x + (Math.random()-0.5)*150, enemy.position.y + (Math.random()-0.5)*150, 'gem', valPerGem);
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
           this.dropItem(enemy.position.x + (Math.random()-0.5)*200, enemy.position.y + (Math.random()-0.5)*200, 'coin', valPerCoin);
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
        // Massive Coin Nerf to encourage P2W Gem Exchange
        if (data.type === 'golem') {
            this.dropItem(enemy.position.x, enemy.position.y, 'coin', 5);
        } else {
            if (Math.random() < 0.2) { // Only 20% chance to drop 1 coin
                this.dropItem(enemy.position.x, enemy.position.y, 'coin', 1);
            }
        }
        if (Math.random() < 0.1) { // 10% chance for a heart
            this.dropItem(enemy.position.x + 20, enemy.position.y + 20, 'heart', 20); // Heals 20
        }
      }
    } else {
      this.audioService.playSFX('hit');
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
        this.audioService.playSFX('hit');
        setTimeout(() => this.celestialShieldActive.set(true), 30000);
        return;
    }
    
    if (this.gameState.isDrilling()) {
        amount *= 0.1;
    }

    this.audioService.playSFX('hit');
    this.currentHealth.update(h => Math.max(0, h - amount));
    this.damageFlash.set(true);
    setTimeout(() => this.damageFlash.set(false), 200);

    if (this.currentHealth() <= 0) {
      const activeHold = this.gameState.currentStats().activeHoldAbility;
      if (activeHold === 'rebirth' && this.holdCooldown() === 0) {
         this.holdCooldown.set(this.getHoldMaxCooldown());
         this.gameState.isRebirthing.set(true);
         this.audioService.playSFX('hit');
         
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
                this.audioService.masterVolume.set(0);
                this.audioService.saveSettings();
            },
            afterAd: () => {
                const savedMaster = localStorage.getItem('phoenix_vol_master');
                this.audioService.masterVolume.set(savedMaster !== null ? parseFloat(savedMaster) : 1.0);
                this.audioService.saveSettings();
            }
        });
    } else {
        console.warn("Google AdSense adBreak API not found. Mocking ad watch...");
        // Mock 2 second ad watch
        this.audioService.masterVolume.set(0);
        this.audioService.saveSettings();
        
        setTimeout(() => {
            const savedMaster = localStorage.getItem('phoenix_vol_master');
            this.audioService.masterVolume.set(savedMaster !== null ? parseFloat(savedMaster) : 1.0);
            this.audioService.saveSettings();
            
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
  }

  private clearEnemies() {
    this.enemies.forEach(e => Matter.Composite.remove(this.engine.world, e));
    this.enemies = [];
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
              this.timeRemaining.set(this.totalTime);
              this.startGameLoop();
          }
      };
      
      requestAnimationFrame(animateEntrance);
  }

  public togglePause() {
    if (this.gameEnded() || this.isDead()) return;
    
    // Cheat code: 5 clicks to summon boss and heal
    this.pauseClickCount++;
    if (this.pauseClickCount >= 5) {
        this.timeRemaining.set(1);
        this.currentHealth.set(this.maxHealth());
        this.pauseClickCount = 0;
    }

    this.gameState.isPaused.set(!this.gameState.isPaused());
    
    if (this.gameState.isPaused()) Matter.Runner.stop(this.runner);
    else Matter.Runner.run(this.runner, this.engine);
  }

  private onKeyDown(event: KeyboardEvent) { if (event.key === 'Escape') this.togglePause(); }
  private onVisibilityChange() { if (document.hidden && !this.gameState.isPaused() && !this.gameEnded() && !this.isDead()) this.togglePause(); }
  public quitGame() { 
      this.gameState.coins.update(c => Math.floor(c));
      this.gameState.gems.update(g => Math.floor(g));
      this.gameState.isPaused.set(false);
      this.gameState.activeScreen.set('menu'); 
  }

  private onMouseMove(event: MouseEvent) { this.updateMouseInput(event.clientX, event.clientY); }
  private onTouchMove(event: TouchEvent) { if (event.touches.length > 0) this.updateMouseInput(event.touches[0].clientX, event.touches[0].clientY); }
  
  private updateMouseInput(x: number, y: number) {
      this.mouseX = x;
      this.mouseY = y;
  }

  private onMouseDown(event: MouseEvent) { this.handleInputStart(event.clientX, event.clientY); }
  private onTouchStart(event: TouchEvent) { if (event.touches.length > 0) this.handleInputStart(event.touches[0].clientX, event.touches[0].clientY); }
  
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
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }
}
