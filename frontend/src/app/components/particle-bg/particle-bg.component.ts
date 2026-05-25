import { Component, ElementRef, OnInit, OnDestroy, ViewChild, NgZone, effect, inject } from '@angular/core';
import { GameStateService, PhysicsEntity } from '../../services/game-state.service';
import * as THREE from 'three';

interface PhoenixState {
  theme: string;
  group: THREE.Group;
  particles: THREE.Points;
  basePositions: Float32Array;
  phoenixCount: number;
  currentBank: number;
  flapTime: number;
  
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  previousVelocity: THREE.Vector3;
  
  targetWaypoint: THREE.Vector3;
  
  historyPos: THREE.Vector3[];
  historyQuat: THREE.Quaternion[];
}

interface ParticleEntity {
  mesh: THREE.Points;
  type: string;
}

@Component({
  selector: 'app-particle-bg',
  standalone: true,
  template: `<canvas #bgCanvas id="bg-canvas"></canvas>`,
  styles: [`
    :host {
      display: block;
      position: fixed;
      inset: 0;
      z-index: -50;
      background: #020205;
      pointer-events: auto;
    }
    #bg-canvas {
      width: 100%;
      height: 100%;
    }
  `]
})
export class ParticleBgComponent implements OnInit, OnDestroy {
  @ViewChild('bgCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  
  private gameState = inject(GameStateService);
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private particles!: THREE.Points;
  private walls!: THREE.Points;
  private bgGlow!: THREE.Mesh;
  private animationId!: number;
  
  private bird!: PhoenixState;
  private readonly MAX_HISTORY = 600;
  
  private boundX = 15;
  private boundY = 10;
  private birdScale = 0.5; // Scaled down
  private readonly ambientBoxSize = 80;

  private mouseTarget = new THREE.Vector3(0, -10, -15);
  private entityPool = new Map<string, ParticleEntity>();
  
  constructor(private ngZone: NgZone) {
    effect(() => {
      const theme = this.gameState.worlds[this.gameState.selectedWorldIndex()].theme;
      this.updateColors(theme);
    });
  }
  
  ngOnInit() {
    this.initThree();
    this.createParticles();
    this.createWalls();
    
    this.bird = this.createBirdState('orange');
    this.initHistory(this.bird);
    this.createPhoenixMesh(this.bird);
    
    this.updateColors(this.gameState.worlds[this.gameState.selectedWorldIndex()].theme);

    this.animate();
    
    window.addEventListener('resize', this.onResize.bind(this));
    window.addEventListener('mousemove', this.onMouseMove.bind(this));
    window.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
  }
  
  ngOnDestroy() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    window.removeEventListener('resize', this.onResize.bind(this));
    window.removeEventListener('mousemove', this.onMouseMove.bind(this));
    window.removeEventListener('touchmove', this.onTouchMove.bind(this));
    this.renderer.dispose();
  }

  private updateColors(theme: string) {
    if (!this.particles || !this.bird || !this.bird.particles) return;

    let p1 = [1.0, 0.8, 0.2]; let p2 = [1.0, 0.4, 0.0]; let p3 = [0.8, 0.1, 0.0]; 
    if (theme === 'blue') { p1 = [0.2, 0.8, 1.0]; p2 = [0.0, 0.4, 1.0]; p3 = [0.0, 0.1, 0.8]; }
    else if (theme === 'purple') { p1 = [0.6, 0.0, 1.0]; p2 = [0.3, 0.0, 0.8]; p3 = [0.1, 0.0, 0.5]; }
    else if (theme === 'green') { p1 = [0.2, 1.0, 0.4]; p2 = [0.0, 0.8, 0.2]; p3 = [0.0, 0.4, 0.1]; }
    else if (theme === 'gray') { p1 = [0.9, 0.9, 0.9]; p2 = [0.5, 0.5, 0.5]; p3 = [0.2, 0.2, 0.2]; }
    else if (theme === 'cyan') { p1 = [0.4, 1.0, 1.0]; p2 = [0.0, 0.8, 1.0]; p3 = [0.0, 0.5, 0.8]; }
    else if (theme === 'magenta') { p1 = [1.0, 0.4, 1.0]; p2 = [0.8, 0.0, 0.8]; p3 = [0.5, 0.0, 0.5]; }
    else if (theme === 'yellow') { p1 = [1.0, 1.0, 0.2]; p2 = [0.8, 0.8, 0.0]; p3 = [0.5, 0.5, 0.0]; }
    else if (theme === 'crimson') { p1 = [1.0, 0.2, 0.2]; p2 = [0.8, 0.0, 0.0]; p3 = [0.5, 0.0, 0.0]; }
    else if (theme === 'void') { p1 = [0.2, 0.0, 0.4]; p2 = [0.1, 0.0, 0.2]; p3 = [0.0, 0.0, 0.0]; }

    const aColors = this.particles.geometry.attributes['color'].array as Float32Array;
    for (let i = 0; i < aColors.length; i += 3) {
      const r = Math.random();
      if (r > 0.66) { aColors[i] = p1[0]; aColors[i+1] = p1[1]; aColors[i+2] = p1[2]; }
      else if (r > 0.33) { aColors[i] = p2[0]; aColors[i+1] = p2[1]; aColors[i+2] = p2[2]; }
      else { aColors[i] = p3[0]; aColors[i+1] = p3[1]; aColors[i+2] = p3[2]; }
    }
    this.particles.geometry.attributes['color'].needsUpdate = true;

    const bColors = this.bird.particles.geometry.attributes['color'].array as Float32Array;
    const positions = this.bird.particles.geometry.attributes['position'].array as Float32Array;
    const count = this.bird.phoenixCount;
    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      const x = positions[idx];
      const z = positions[idx+2];
      const distFromCenter = Math.sqrt(x*x + z*z);
      
      if (distFromCenter < 2 && z < 2) { bColors[idx] = p1[0]; bColors[idx+1] = p1[1]; bColors[idx+2] = p1[2]; }
      else if (distFromCenter < 5 && z < 6) { bColors[idx] = p2[0]; bColors[idx+1] = p2[1]; bColors[idx+2] = p2[2]; }
      else { bColors[idx] = p3[0]; bColors[idx+1] = p3[1]; bColors[idx+2] = p3[2]; }
    }
    this.bird.particles.geometry.attributes['color'].needsUpdate = true;

    if (this.bgGlow) {
        const mat = this.bgGlow.material as THREE.MeshBasicMaterial;
        mat.color.setRGB(p2[0], p2[1], p2[2]);
    }
  }

  private onMouseMove(event: MouseEvent) {
    this.updateMouseTarget(event.clientX, event.clientY);
  }

  private onTouchMove(event: TouchEvent) {
    if (event.touches.length > 0) {
      this.updateMouseTarget(event.touches[0].clientX, event.touches[0].clientY);
    }
  }

  private updateMouseTarget(x: number, y: number) {
    const vec = new THREE.Vector3();
    const pos = new THREE.Vector3();
    vec.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1, 0.5);
    vec.unproject(this.camera);
    vec.sub(this.camera.position).normalize();
    const distance = (-15 - this.camera.position.z) / vec.z;
    pos.copy(this.camera.position).add(vec.multiplyScalar(distance));
    this.mouseTarget.copy(pos);
  }

  private createBirdState(theme: string): PhoenixState {
    return {
      theme, group: new THREE.Group(), particles: new THREE.Points(), basePositions: new Float32Array(0),
      phoenixCount: 4000, currentBank: 0, flapTime: 0, position: new THREE.Vector3(0, -5, -15),
      velocity: new THREE.Vector3(0, 1, 0), previousVelocity: new THREE.Vector3(0, 1, 0),
      targetWaypoint: new THREE.Vector3(), historyPos: [], historyQuat: []
    };
  }

  private initThree() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvasRef.nativeElement, alpha: true, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.camera.position.z = 5;
    
    // Atmospheric Core Glow
    const glowGeo = new THREE.PlaneGeometry(400, 400);
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xff5500, transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending, depthWrite: false });
    this.bgGlow = new THREE.Mesh(glowGeo, glowMat);
    this.bgGlow.position.set(0, 0, -50);
    this.scene.add(this.bgGlow);

    this.updateBounds();
  }

  private updateBounds() {
    this.birdScale = Math.max(0.2, Math.min(0.5, window.innerWidth / 1200)); // Scaled down bird
    const vFOV = THREE.MathUtils.degToRad(this.camera.fov);
    const height = 2 * Math.tan(vFOV / 2) * Math.abs(this.camera.position.z + 15);
    this.boundY = height / 2;
    this.boundX = (height * this.camera.aspect) / 2;
  }

  private createParticles() {
    const geometry = new THREE.BufferGeometry();
    const count = 7000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * this.ambientBoxSize;
      positions[i+1] = (Math.random() - 0.5) * this.ambientBoxSize;
      if (i < 5000 * 3) positions[i+2] = (Math.random() - 0.5) * 40 - 10;
      else positions[i+2] = Math.random() * 8 - 4;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({ size: 0.025, vertexColors: true, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending });
    this.particles = new THREE.Points(geometry, material);
    this.scene.add(this.particles);
  }

  private createWalls() {
    const geo = new THREE.BufferGeometry();
    const count = 4000;
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    for(let i=0; i<count; i++) {
        const idx = i*3;
        const isLeft = Math.random() > 0.5;
        pos[idx] = (isLeft ? -1 : 1) * (this.boundX + 2) + (Math.random()-0.5)*8;
        pos[idx+1] = (Math.random() - 0.5) * 80; // y from -40 to 40
        pos[idx+2] = (Math.random() - 0.5) * 30 - 10; // z depth
        
        // Wall color - give it a fiery/nebula mix based on depth
        col[idx] = 0.8 + Math.random()*0.2; 
        col[idx+1] = 0.3 + Math.random()*0.3; 
        col[idx+2] = 0.1 + Math.random()*0.2;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({ size: 0.15, vertexColors: true, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending });
    this.walls = new THREE.Points(geo, mat);
    this.scene.add(this.walls);
  }

  private initHistory(bird: PhoenixState) {
    const depth = -15;
    const startPos = new THREE.Vector3(0, -10, depth);
    const startDir = new THREE.Vector3(0, 1, 0);
    const speed = 0.06; 
    const startVel = startDir.clone().multiplyScalar(speed);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < this.MAX_HISTORY; i++) {
        const p = startPos.clone().sub(startDir.clone().multiplyScalar(i * speed));
        bird.historyPos.push(p);
        dummy.position.copy(p);
        dummy.lookAt(p.clone().add(startVel));
        dummy.rotateY(Math.PI);
        bird.historyQuat.push(dummy.quaternion.clone());
    }
    bird.position.copy(startPos);
    bird.velocity.copy(startVel);
    this.mouseTarget.copy(startPos);
  }

  private createPhoenixMesh(bird: PhoenixState) {
    const geometry = new THREE.BufferGeometry();
    bird.basePositions = new Float32Array(bird.phoenixCount * 3);
    const positions = new Float32Array(bird.phoenixCount * 3);
    const colors = new Float32Array(bird.phoenixCount * 3);
    for (let i = 0; i < bird.phoenixCount; i++) {
      const idx = i * 3;
      let x = 0, y = 0, z = 0;
      let rand = Math.random();
      if (rand < 0.5) { x = (Math.random() - 0.5) * 20; z = 0.05 * (x * x) + Math.random() * 1.5 + 4; y = Math.sin(Math.abs(x) * 0.3) * 1.5 + (Math.random() - 0.5) * 0.1; }
      else if (rand < 0.7) { const u = Math.random() * Math.PI * 2; const v = Math.acos(2 * Math.random() - 1); const r = Math.cbrt(Math.random()); x = r * Math.sin(v) * Math.cos(u) * 0.8; y = r * Math.sin(v) * Math.sin(u) * 0.8; z = r * Math.cos(v) * 3 + 6; }
      else if (rand < 0.85) { z = Math.random() * 4; let radius = 0; if (z < 0.8) radius = z * 0.3; else if (z < 1.8) radius = 0.6 - Math.abs(z - 1.3) * 0.4; else radius = 0.2 + (z - 1.8) * 0.1; const angle = Math.random() * Math.PI * 2; x = Math.cos(angle) * Math.random() * radius; y = Math.sin(angle) * Math.random() * radius; }
      else { const feather = Math.floor(Math.random() * 5); z = 9 + Math.random() * 16; x = (feather - 2) * (z - 9) * 0.15 + (Math.random() - 0.5) * 0.2; y = -Math.pow(Math.abs(z - 9), 1.1) * 0.15 + (Math.random() - 0.5) * 0.2; }
      z += (Math.random() - 0.5) * 0.5; if (z < 0) z = 0; const scale = 0.4;
      bird.basePositions[idx] = x * scale; bird.basePositions[idx+1] = y * scale; bird.basePositions[idx+2] = z * scale;
      positions[idx] = x; positions[idx+1] = y; positions[idx+2] = z;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({ size: 0.15, vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending });
    bird.particles = new THREE.Points(geometry, material);
    bird.particles.frustumCulled = false; 
    bird.group = new THREE.Group();
    bird.group.add(bird.particles);
    this.scene.add(bird.group);
  }

  private animate() {
    this.ngZone.runOutsideAngular(() => {
      const render = () => {
        // Ambient particles moving downward
        const positions = this.particles.geometry.attributes['position'].array as Float32Array;
        const halfBox = this.ambientBoxSize / 2;
        for (let i = 0; i < positions.length; i += 3) {
          positions[i+1] -= 0.03; 
          if (positions[i+1] < -halfBox) { positions[i+1] = halfBox; positions[i] = (Math.random() - 0.5) * this.ambientBoxSize; }
        }
        this.particles.geometry.attributes['position'].needsUpdate = true;
        this.particles.rotation.y += 0.0001;

        // Walls moving down
        if (this.walls) {
            const wPos = this.walls.geometry.attributes['position'].array as Float32Array;
            for (let i = 0; i < wPos.length; i += 3) {
              wPos[i+1] -= 0.2 * this.gameState.currentStats().speed; // Scale wall speed
              if (wPos[i+1] < -30) { wPos[i+1] = 30; }
            }
            this.walls.geometry.attributes['position'].needsUpdate = true;
        }

        const speed = 0.08 * this.gameState.currentStats().speed; 
        const bird = this.bird;
        
        // --- ONLY UPDATE BIRD PHYSICS IF NOT PAUSED ---
        if (!this.gameState.isPaused()) {
          // Cinematic Override
          const overridePos = this.gameState.phoenixOverridePosition();
          if (overridePos) {
            this.updateMouseTarget(overridePos.x, overridePos.y);
          }

          // Track Mouse
          bird.targetWaypoint.lerp(this.mouseTarget, 0.1);

          const directToTarget = bird.targetWaypoint.clone().sub(bird.position);
          
          if (directToTarget.lengthSq() < 0.1) {
            directToTarget.set(0,0,0);
          } else {
            directToTarget.normalize().multiplyScalar(0.015);
          }

          const speedMult = this.gameState.currentStats().speed;
          const maxTurnForce = (0.001 / this.birdScale) * speedMult; 
          const desiredVelocity = bird.velocity.clone().add(directToTarget.multiplyScalar(speedMult)).normalize().multiplyScalar(speed);
          const steering = desiredVelocity.sub(bird.velocity);
          if (steering.length() > maxTurnForce) steering.normalize().multiplyScalar(maxTurnForce);
          bird.velocity.add(steering);
          if (bird.velocity.lengthSq() > 0) bird.velocity.normalize().multiplyScalar(speed);
          
          bird.position.add(bird.velocity);
        }
        
        // --- Output 2D screen coordinate for Matter.js sync ---
        const screenPos = bird.position.clone();
        screenPos.project(this.camera);
        const x2d = (screenPos.x * .5 + .5) * window.innerWidth;
        const y2d = (screenPos.y * -.5 + .5) * window.innerHeight;
        this.gameState.phoenixScreenPos.set({x: x2d, y: y2d});
        // ------------------------------------------------------

        const lookTarget = bird.position.clone().add(bird.velocity.clone().multiplyScalar(100));
        const dummy = new THREE.Object3D();
        dummy.position.copy(bird.position);
        
        const targetQuat = new THREE.Quaternion().setFromRotationMatrix(
          new THREE.Matrix4().lookAt(dummy.position, lookTarget, new THREE.Vector3(0, 1, 0))
        );
        targetQuat.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI));
        
        if (bird.historyQuat.length > 0) {
            dummy.quaternion.copy(bird.historyQuat[0]).slerp(targetQuat, 0.15);
        } else {
            dummy.quaternion.copy(targetQuat);
        }

        const vDiff = bird.velocity.clone().sub(bird.previousVelocity);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(dummy.quaternion);
        let targetBank = vDiff.dot(right) * 600; 
        targetBank = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, targetBank));
        bird.currentBank += (targetBank - bird.currentBank) * 0.05;
        dummy.rotateZ(bird.currentBank);
        bird.previousVelocity.copy(bird.velocity);

        bird.historyPos.unshift(bird.position.clone());
        bird.historyQuat.unshift(dummy.quaternion.clone());
        if (bird.historyPos.length > this.MAX_HISTORY) {
            bird.historyPos.pop(); bird.historyQuat.pop();
        }

        if (!this.gameState.isPaused()) {
            bird.flapTime += 0.04;
        }
        const pPositions = bird.particles.geometry.attributes['position'].array as Float32Array;
        
        for (let k = 0; k < bird.phoenixCount; k++) {
          const idx = k * 3;
          const baseX = bird.basePositions[idx];
          const baseY = bird.basePositions[idx+1];
          const baseZ = bird.basePositions[idx+2];
          
          const scaledBaseX = baseX * this.birdScale;
          const scaledBaseY = baseY * this.birdScale;
          const scaledBaseZ = baseZ * this.birdScale;
          
          let histIdx = Math.floor(scaledBaseZ / speed);
          histIdx = Math.max(0, Math.min(bird.historyPos.length - 1, histIdx));
          
          const hPos = bird.historyPos[histIdx];
          const hQuat = bird.historyQuat[histIdx];
          
          const flapAmount = Math.abs(scaledBaseX) * 0.5; 
          const flapPhase = bird.flapTime - scaledBaseZ * 2.0; 
          const flapOffset = Math.sin(flapPhase) * flapAmount;
          
          const flickerX = (Math.random() - 0.5) * 0.05 * this.birdScale;
          const flickerY = (Math.random() - 0.5) * 0.05 * this.birdScale;
          
          const localOffset = new THREE.Vector3(scaledBaseX + flickerX, scaledBaseY + flapOffset + flickerY, 0);
          localOffset.applyQuaternion(hQuat);
          
          let finalX = hPos.x + localOffset.x;
          const wrapWidth = this.boundX * 2 + 10;
          
          if (finalX > wrapWidth / 2) {
            finalX -= wrapWidth;
          } else if (finalX < -wrapWidth / 2) {
            finalX += wrapWidth;
          }

          pPositions[idx] = finalX;
          pPositions[idx+1] = hPos.y + localOffset.y;
          pPositions[idx+2] = hPos.z + localOffset.z;
        }
        bird.particles.geometry.attributes['position'].needsUpdate = true;
        
        this.syncEntities();

        this.renderer.render(this.scene, this.camera);
        this.animationId = requestAnimationFrame(render);
      };
      render();
    });
  }

  private syncEntities() {
    const active = this.gameState.activeEntities();
    const activeIds = new Set(active.map(e => e.id));

    // Remove dead entities
    for (const [id, entity] of this.entityPool.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(entity.mesh);
        entity.mesh.geometry.dispose();
        (entity.mesh.material as THREE.Material).dispose();
        this.entityPool.delete(id);
      }
    }

    // Add/Update active entities
    for (const data of active) {
      let entity = this.entityPool.get(data.id);
      if (!entity) {
        entity = this.createEntityMesh(data);
        this.scene.add(entity.mesh);
        this.entityPool.set(data.id, entity);
      }

      // Unproject 2D to 3D
      const vec = new THREE.Vector3(
        (data.x / window.innerWidth) * 2 - 1,
        -(data.y / window.innerHeight) * 2 + 1,
        0.5
      );
      vec.unproject(this.camera);
      vec.sub(this.camera.position).normalize();
      const distance = (-15 - this.camera.position.z) / vec.z;
      const pos3d = this.camera.position.clone().add(vec.multiplyScalar(distance));
      
      entity.mesh.position.copy(pos3d);
      
      // Rotate for visual effect
      if (data.type === 'coin') {
        entity.mesh.rotation.y += 0.1;
      } else if (data.type === 'heart') {
        const beat = 1 + Math.sin(Date.now() * 0.01) * 0.2;
        entity.mesh.scale.set(beat, beat, beat);
      } else if (data.type === 'gem') {
        entity.mesh.rotation.y += 0.05;
        entity.mesh.rotation.x += 0.02;
      } else if (data.type === 'bat') {
        const flap = 1 + Math.sin(Date.now() * 0.03) * 0.8;
        entity.mesh.scale.y = flap;
        entity.mesh.rotation.y = Math.sin(Date.now() * 0.005) * 0.5; 
      } else if (data.type === 'golem') {
        entity.mesh.rotation.y = Math.sin(Date.now() * 0.002) * 0.2;
        entity.mesh.position.y += Math.sin(Date.now() * 0.005) * 0.2; // lumbering walk
      } else if (data.type === 'slime') {
        const squish = 1 + Math.sin(Date.now() * 0.01) * 0.2;
        entity.mesh.scale.set(1/squish, squish, 1/squish);
      } else {
        entity.mesh.rotation.y += 0.02;
      }

      // Make aura expand dynamically
      if (data.type === 'aura') {
        entity.mesh.rotation.z += 0.1;
      }
    }
  }

  private createEntityMesh(data: PhysicsEntity): ParticleEntity {
    const geo = new THREE.BufferGeometry();
    const count = data.type === 'boss' ? 4000 : (data.type.startsWith('projectile') ? 100 : (data.type === 'aura' ? 500 : (data.type === 'coin' || data.type === 'gem' || data.type === 'heart' ? 200 : 800)));
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);

    // Color based on type
    let color = new THREE.Color(0xffffff);
    if (data.type === 'bat') color.setHex(0xef4444);
    else if (data.type === 'slime') color.setHex(0x22c55e); // Green Slime
    else if (data.type === 'golem') color.setHex(0x7f1d1d); // Dark Red Golem
    else if (data.type === 'boss') color.setHex(0xf97316); // Orange fiery Boss
    else if (data.type === 'projectile_player') color.setHex(0xfbbf24);
    else if (data.type === 'projectile_enemy') color.setHex(0xef4444);
    else if (data.type === 'aura') color.setHex(0x06b6d4);
    else if (data.type === 'coin') color.setHex(0xfacc15); // Yellow
    else if (data.type === 'gem') color.setHex(0xc084fc); // Purple
    else if (data.type === 'heart') color.setHex(0xec4899); // Pinkish red

    const r = data.size / 30; // Scale factor

    for (let i=0; i<count; i++) {
      const idx = i*3;
      let x = 0, y = 0, z = 0;

      if (data.type === 'slime') {
          // Hemisphere blob
          const u = Math.random() * Math.PI * 2;
          const v = Math.acos(Math.random()); // top half
          const rad = Math.cbrt(Math.random()) * r;
          x = rad * Math.sin(v) * Math.cos(u);
          z = rad * Math.sin(v) * Math.sin(u);
          y = (rad * Math.cos(v) - r * 0.5) * 0.8; 
      }
      else if (data.type === 'bat') {
          // V-shaped wings
          const isLeft = Math.random() > 0.5;
          const wingX = Math.random() * r * 2;
          x = isLeft ? -wingX : wingX;
          y = Math.abs(x) * 0.5 + (Math.random() - 0.5) * 0.2 * r;
          z = (Math.random() - 0.5) * 0.2 * r;
          // Add a small body
          if (Math.random() < 0.2) {
              x = (Math.random() - 0.5) * 0.5 * r;
              y = (Math.random() - 0.5) * 0.5 * r;
              z = (Math.random() - 0.5) * 0.5 * r;
          }
      }
      else if (data.type === 'golem') {
          // Boxy / Cuboid shape
          x = (Math.random() - 0.5) * r * 1.5;
          y = (Math.random() - 0.5) * r * 2;
          z = (Math.random() - 0.5) * r * 1.5;
      }
      else if (data.type === 'boss') {
          // Giant Skull-like shape (Sphere with hollow eyes/mouth)
          const u = Math.random() * Math.PI * 2;
          const v = Math.acos(2 * Math.random() - 1);
          const rad = Math.cbrt(Math.random()) * r * 1.5;
          x = rad * Math.sin(v) * Math.cos(u);
          y = rad * Math.sin(v) * Math.sin(u);
          z = rad * Math.cos(v);
          
          // Hollow out eyes
          if (y > 0.2 * r && y < 0.8 * r && z > 0) {
              if (Math.abs(x) > 0.3 * r && Math.abs(x) < 0.8 * r) {
                  z = -Math.abs(z); // Push to back
              }
          }
          // Hollow out mouth
          if (y > -0.8 * r && y < -0.3 * r && z > 0 && Math.abs(x) < 0.6 * r) {
              z = -Math.abs(z); // Push to back
          }
      }
      else if (data.type === 'heart') {
          // Math curve for a heart
          const t = Math.random() * Math.PI * 2;
          const rad = Math.random() * r * 0.05; 
          x = 16 * Math.pow(Math.sin(t), 3) * rad;
          y = (13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t)) * rad;
          z = (Math.random() - 0.5) * r * 0.2;
      }
      else if (data.type === 'gem') {
          // Diamond shape (Octahedron)
          x = (Math.random() - 0.5) * r;
          y = (Math.random() - 0.5) * r * 2;
          z = (Math.random() - 0.5) * r;
          const sum = Math.abs(x/r) + Math.abs(y/(r*2)) + Math.abs(z/r);
          if (sum > 0.5) {
             x /= (sum * 2); y /= (sum * 2); z /= (sum * 2);
          }
      }
      else if (data.type === 'coin') {
          // Torus / Ring
          const angle = Math.random() * Math.PI * 2;
          const rad = r * 0.8 + (Math.random() - 0.5) * r * 0.2;
          x = Math.cos(angle) * rad;
          y = Math.sin(angle) * rad;
          z = (Math.random() - 0.5) * r * 0.1;
      }
      else if (data.type === 'aura') {
         // Ring of particles
         const angle = Math.random() * Math.PI * 2;
         x = Math.cos(angle) * r;
         y = Math.sin(angle) * r;
         z = (Math.random() - 0.5) * 0.5;
      } 
      else {
         // Default Sphere
         const u = Math.random() * Math.PI * 2;
         const v = Math.acos(2 * Math.random() - 1);
         const rad = Math.cbrt(Math.random()) * r;
         x = rad * Math.sin(v) * Math.cos(u);
         y = rad * Math.sin(v) * Math.sin(u);
         z = rad * Math.cos(v);
      }

      pos[idx] = x;
      pos[idx+1] = y;
      pos[idx+2] = z;

      // Add a bit of jitter to colors
      col[idx] = color.r * (0.8 + Math.random()*0.4);
      col[idx+1] = color.g * (0.8 + Math.random()*0.4);
      col[idx+2] = color.b * (0.8 + Math.random()*0.4);
    }
    
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    
    const mat = new THREE.PointsMaterial({ size: 0.15, vertexColors: true, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending });
    const mesh = new THREE.Points(geo, mat);
    
    return { mesh, type: data.type };
  }

  private onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.updateBounds();
  }
}
