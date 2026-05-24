import { Component, signal, inject, OnInit, viewChild, ElementRef, afterNextRender, OnDestroy } from '@angular/core';
import { ApiService } from '../services/api.service';
import * as Matter from 'matter-js';
import anime from 'animejs';
import confetti from 'canvas-confetti';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import * as THREE from 'three';
import Lenis from '@studio-freight/lenis';

gsap.registerPlugin(ScrollTrigger);

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit {
  private api = inject(ApiService);
  protected readonly title = signal('Phoenix-Fall');
  
  ngOnInit() {
    this.api.getData('health').subscribe((res: any) => console.log('API Status:', res));
  }

  
  private container = viewChild<ElementRef<HTMLDivElement>>('scene');
  private card = viewChild<ElementRef<HTMLDivElement>>('card');
  private engine?: Matter.Engine;
  private render?: Matter.Render;

  private lenis?: Lenis;

  constructor() {
    afterNextRender(() => {
      this.initPhysics();
      this.initAnimation();
      this.initGSAP();
      this.initThreeJS();
      this.initLenis();

      if (true) window.addEventListener('resize', this.handleResize);
    });
  }

  ngOnDestroy() {
    window.removeEventListener('resize', this.handleResize);
    if (this.render) { Matter.Render.stop(this.render); if (this.render.canvas.parentNode) { this.render.canvas.parentNode.removeChild(this.render.canvas); } }
    if (this.engine) Matter.Engine.clear(this.engine);
    if (this.lenis) this.lenis.destroy();
    ScrollTrigger.getAll().forEach(t => t.kill());
  }

  private handleResize = () => {
    const el = this.container()?.nativeElement;
    if (el && this.render) {
      this.render.canvas.width = el.clientWidth; this.render.options.width = el.clientWidth;
    }
  };


  private initAnimation() {
    const el = this.card()?.nativeElement;
    if (el) {
      anime({
        targets: el,
        scale: [1, 1.02],
        direction: 'alternate',
        easing: 'easeInOutSine',
        duration: 1400,
        loop: true
      });
    }
  }

  private initGSAP() {
    gsap.from(".glass", {
      y: 100,
      opacity: 0,
      duration: 1.2,
      ease: "power4.out",
      stagger: 0.2,
      scrollTrigger: {
        trigger: ".glass",
        start: "top 90%"
      }
    });
  }

  private initLenis() {
    this.lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    });

    const raf = (time: number) => {
      this.lenis?.raf(time);
      requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
  }

  private initThreeJS() {
    const el = this.container()?.nativeElement;
    if (!el) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, el.clientWidth / 220, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    
    renderer.setSize(el.clientWidth, 220);
    el.appendChild(renderer.domElement);

    const geometry = new THREE.TorusKnotGeometry(10, 3, 100, 16);
    const material = new THREE.MeshNormalMaterial();
    const torusKnot = new THREE.Mesh(geometry, material);
    scene.add(torusKnot);

    camera.position.z = 30;

    const animate = () => {
      requestAnimationFrame(animate);
      torusKnot.rotation.x += 0.01;
      torusKnot.rotation.y += 0.01;
      renderer.render(scene, camera);
    };
    animate();
  }

  private initPhysics() {
    const el = this.container()?.nativeElement;
    if (!el) return;

    this.engine = Matter.Engine.create();
    this.render = Matter.Render.create({
      element: el,
      engine: this.engine,
      options: {
        width: el.clientWidth,
        height: 220,
        background: 'transparent',
        wireframes: false
      }
    });

    const ground = Matter.Bodies.rectangle(el.clientWidth / 2, 210, el.clientWidth, 20, { 
      isStatic: true,
      render: { fillStyle: '#d1d5db' }
    });
    
    const ball = Matter.Bodies.circle(80, 30, 20, { 
      restitution: 0.85,
      render: { fillStyle: '#ffb347' }
    });

    Matter.World.add(this.engine.world, [ground, ball]);
    
    const runner = Matter.Runner.create();
    Matter.Runner.run(runner, this.engine);
    Matter.Render.run(this.render);
  }

}
