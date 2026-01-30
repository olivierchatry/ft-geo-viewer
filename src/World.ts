import * as THREE from 'three';
import { CameraController } from './CameraController';

export class World {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: CameraController;
  clock: THREE.Clock;
  container: HTMLElement;
  private needsRender: boolean = false;

  // For smooth transitions (programmatic moves like setView)
  private targetDestination: THREE.Vector3 | null = null;
  private cameraDestination: THREE.Vector3 | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    
    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x333333);

    // Camera
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 10000000);
    this.camera.position.set(0, 500, 500);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ 
        antialias: true, 
        alpha: true,
        logarithmicDepthBuffer: true 
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    container.appendChild(this.renderer.domElement);

    // Light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(100, 1000, 500);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    this.scene.add(dirLight);

    // Custom Camera Controller
    this.controls = new CameraController(this.camera, this.renderer.domElement, this.scene);
    this.camera.lookAt(this.controls.target);
    
    // Clock
    this.clock = new THREE.Clock();

    // Resize handling
    window.addEventListener('resize', this.onWindowResize.bind(this));
    window.addEventListener('focus', () => {
      this.onWindowResize();
    });
    this.onWindowResize(); // Force initial state sync

    // Ensure we render on any mouse activity (move, click, zoom)
    const renderTrigger = () => { this.needsRender = true; };
    this.renderer.domElement.addEventListener('mousemove', renderTrigger);
    this.renderer.domElement.addEventListener('mousedown', renderTrigger);
    this.renderer.domElement.addEventListener('mouseup', renderTrigger);
    this.renderer.domElement.addEventListener('wheel', renderTrigger, { passive: true });

    // Basic Floor Grid for reference
    const gridHelper = new THREE.GridHelper(2000, 20, 0x555555, 0x444444);
    this.scene.add(gridHelper);
    
    // Axes helper
    const axesHelper = new THREE.AxesHelper(100);
    this.scene.add(axesHelper);

    this.animate();
  }

  private frameCount = 0;

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.needsRender = true;
  }

  animate() {
    requestAnimationFrame(this.animate.bind(this));

    // Hack: Force resize for first few frames to handle layout shifts
    if (this.frameCount < 10) {
      this.onWindowResize();
      this.frameCount++;
    }

    const delta = this.clock.getDelta();
    const lerpFactor = 1 - Math.pow(0.001, delta);

    const controlsMoved = this.controls.update();

    // If user interacts, stop any smooth programmatic transitions
    if (controlsMoved) {
      this.targetDestination = null;
      this.cameraDestination = null;
    }

    let moved = false;

    // Handle smooth programmatic transitions
    if (this.targetDestination) {
      this.controls.target.lerp(this.targetDestination, lerpFactor);
      moved = true;
      if (this.controls.target.distanceTo(this.targetDestination) < 0.001) {
        this.controls.target.copy(this.targetDestination);
        this.targetDestination = null;
      }
    }

    if (this.cameraDestination) {
      this.camera.position.lerp(this.cameraDestination, lerpFactor);
      moved = true;
      if (this.camera.position.distanceTo(this.cameraDestination) < 0.001) {
        this.camera.position.copy(this.cameraDestination);
        this.cameraDestination = null;
      }
    }

    if (moved) {
      this.camera.lookAt(this.controls.target);
    }

    const controlsActive = this.controls.update();
    
    if (moved || controlsActive || this.needsRender) {
      this.renderer.render(this.scene, this.camera);
      this.needsRender = false;
    }
  }

  add(object: THREE.Object3D) {
    this.scene.add(object);
  }

  /**
   * Set camera view with optional smooth transition
   */
  setView(position: THREE.Vector3, target: THREE.Vector3, smooth: boolean = true) {
    if (smooth) {
      this.cameraDestination = position.clone();
      this.targetDestination = target.clone();
    } else {
      this.controls.setView(position, target);
      this.cameraDestination = null;
      this.targetDestination = null;
    }
    this.needsRender = true;
  }

  requestRender() {
    this.needsRender = true;
  }
}
