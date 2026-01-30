import * as THREE from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

export class World {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: MapControls;
  clock: THREE.Clock;
  container: HTMLElement;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  
  // For custom panning
  private isPanning: boolean = false;
  private panStartPoint: THREE.Vector3 | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    
    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x333333); // Darker background for "Render Window" vibe
    // this.scene.fog = new THREE.Fog(0x333333, 200, 20000); 

    // Camera
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 10000000);
    this.camera.position.set(0, 500, 500); // High angle view

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

    // Controls - MapControls for Geo viewer
    this.controls = new MapControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.2;
    this.controls.screenSpacePanning = false; // Pan along ground plane, not screen
    this.controls.minDistance = 1;
    this.controls.maxDistance = 10000000;
    this.controls.maxPolarAngle = Math.PI; // Allow full rotation
    this.controls.enablePan = true;
    this.controls.panSpeed = 1.0;
    
    // Setup mouse-relative controls
    this.setupMouseRelativeControls();
    
    // Clock
    this.clock = new THREE.Clock();

    // Resize handling
    window.addEventListener('resize', this.onWindowResize.bind(this));

    // Basic Floor Grid for reference
    const gridHelper = new THREE.GridHelper(2000, 20, 0x555555, 0x444444);
    this.scene.add(gridHelper);
    
    // Axes helper
    const axesHelper = new THREE.AxesHelper(100);
    this.scene.add(axesHelper);

    this.animate();
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  animate() {
    requestAnimationFrame(this.animate.bind(this));
    this.controls.update(); // Required for damping
    this.renderer.render(this.scene, this.camera);
  }

  // Helper to add objects
  add(object: THREE.Object3D) {
    this.scene.add(object);
  }

  /**
   * Setup mouse-relative camera controls
   * Implements custom zoom and pan toward mouse cursor point
   */
  private setupMouseRelativeControls() {
    const domElement = this.renderer.domElement;
    
    // Disable built-in zoom and pan - we'll handle them ourselves
    this.controls.enableZoom = false;
    this.controls.enablePan = false;
    
    // Track mouse position
    domElement.addEventListener('mousemove', (event) => {
      this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
      
      // Handle custom panning - keep the grabbed point under cursor
      if (this.isPanning && this.panStartPoint) {
        const currentHitPoint = this.raycastMousePosition();
        if (currentHitPoint) {
          // Calculate how much the point has moved
          const delta = this.panStartPoint.clone().sub(currentHitPoint);
          
          // Move camera and target by the delta
          this.camera.position.add(delta);
          this.controls.target.add(delta);
          
          // Update the pan start point to account for the move
          // (the original point should now be back under the cursor)
        }
      }
    });
    
    // Start panning on left mouse button
    domElement.addEventListener('mousedown', (event) => {
      if (event.button === 0) { // Left click
        const hitPoint = this.raycastMousePosition();
        if (hitPoint) {
          this.isPanning = true;
          this.panStartPoint = hitPoint.clone();
        }
      }
      // Right mouse button (orbit) - update target to point under mouse
      if (event.button === 2 || event.button === 1) {
        const hitPoint = this.raycastMousePosition();
        if (hitPoint) {
          this.controls.target.copy(hitPoint);
        }
      }
    });
    
    // Stop panning
    domElement.addEventListener('mouseup', (event) => {
      if (event.button === 0) {
        this.isPanning = false;
        this.panStartPoint = null;
      }
    });
    
    domElement.addEventListener('mouseleave', () => {
      this.isPanning = false;
      this.panStartPoint = null;
    });

    // Custom zoom: dolly camera toward/away from point under mouse
    domElement.addEventListener('wheel', (event) => {
      event.preventDefault();
      
      const hitPoint = this.raycastMousePosition();
      if (!hitPoint) return;
      
      // Calculate zoom direction and amount
      const zoomSpeed = 0.1;
      const zoomIn = event.deltaY < 0;
      
      // Direction from camera to hit point
      const cameraToHit = hitPoint.clone().sub(this.camera.position);
      const distance = cameraToHit.length();
      const direction = cameraToHit.normalize();
      
      // Calculate move amount (proportional to distance)
      let moveAmount = distance * zoomSpeed;
      moveAmount = Math.max(moveAmount, 0.5); // Minimum move
      
      if (!zoomIn) {
        moveAmount = -moveAmount; // Reverse for zoom out
      }
      
      // Don't zoom in too close
      if (zoomIn && distance < 5) {
        return;
      }
      
      // Move BOTH camera and target by the same vector
      // This prevents any rotation - just pure dolly movement
      const moveVector = direction.multiplyScalar(moveAmount);
      
      this.camera.position.add(moveVector);
      this.controls.target.add(moveVector);
      
      this.controls.update();
    }, { passive: false });
  }

  /**
   * Raycast from mouse position to find intersection with scene geometry
   */
  private raycastMousePosition(): THREE.Vector3 | null {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    // Only raycast against meshes (terrain, shapes, etc.)
    const meshes: THREE.Object3D[] = [];
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        meshes.push(obj);
      }
    });
    
    const intersects = this.raycaster.intersectObjects(meshes, false);
    
    if (intersects.length > 0) {
      return intersects[0].point.clone();
    }
    
    // Fallback: intersect with a horizontal plane at y=0
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersection = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(plane, intersection)) {
      return intersection;
    }
    
    return null;
  }
}
