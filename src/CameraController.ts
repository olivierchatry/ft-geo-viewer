import { 
  PerspectiveCamera, 
  Scene, 
  Raycaster, 
  Vector2, 
  Vector3, 
  Plane, 
  Euler, 
  MathUtils 
} from 'three';

const NAVIGATION_STATE = {
  NONE: -1,
  ROTATE: 0,
  ZOOM: 1,
  PAN: 2,
};

/**
 * Custom camera controller for geo viewer
 */
export class CameraController {
  camera: PerspectiveCamera;
  
  private domElement: HTMLElement;
  private scene: Scene;
  private raycaster: Raycaster;
  private mouse: Vector2 = new Vector2();
  
  private navigationState: number = NAVIGATION_STATE.NONE;
  private navigationCenter: Vector3 = new Vector3();
  private panPlane: Plane = new Plane();
  private maxPanDistance: number = 1000000;
  
  private prevMouse: Vector2 = new Vector2();
  
  // Settings
  private zoomSpeed: number = 0.01;
  private minDistance: number = 1;

  public target: Vector3 = new Vector3();

  // Flag to indicate render is needed
  private needsRender: boolean = false;

  constructor(camera: PerspectiveCamera, domElement: HTMLElement, scene: Scene) {
    this.camera = camera;
    this.domElement = domElement;
    this.scene = scene;
    this.raycaster = new Raycaster();
    
    this.setupEventListeners();
  }
  
  private setupEventListeners() {
    const dom = this.domElement;
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
    dom.addEventListener('mousedown', this.onMouseDown.bind(this));
    window.addEventListener('mousemove', this.onMouseMove.bind(this));
    window.addEventListener('mouseup', this.onMouseUp.bind(this));
    dom.addEventListener('wheel', this.onWheel.bind(this), { passive: false });
  }
  
  private updateMouse(event: MouseEvent) {
    const rect = this.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private onMouseDown(event: MouseEvent) {
    this.updateMouse(event);
    this.prevMouse.set(event.clientX, event.clientY);

    switch (event.button) {
      case 0: // Left click - PAN
        this.navigationState = NAVIGATION_STATE.PAN;
        this.setNavigationCenter(this.mouse);
        break;
      case 1: // Middle click - ZOOM
        this.navigationState = NAVIGATION_STATE.ZOOM;
        this.setNavigationCenter(this.mouse);
        break;
      case 2: // Right click - ROTATE
        this.navigationState = NAVIGATION_STATE.ROTATE;
        this.setNavigationCenter(this.mouse);
        break;
    }
    this.needsRender = true;
  }

  private onMouseMove(event: MouseEvent) {
    if (this.navigationState === NAVIGATION_STATE.NONE) return;

    this.updateMouse(event);
    const deltaX = event.clientX - this.prevMouse.x;
    const deltaY = event.clientY - this.prevMouse.y;
    this.prevMouse.set(event.clientX, event.clientY);

    if (this.navigationState === NAVIGATION_STATE.ROTATE) {
      this.rotate(new Vector2(deltaX * -0.01, deltaY * -0.01));
    } else if (this.navigationState === NAVIGATION_STATE.ZOOM) {
      this.zoom(deltaY);
    } else if (this.navigationState === NAVIGATION_STATE.PAN) {
      this.pan(this.mouse);
    }
  }

  private onMouseUp() {
    this.navigationState = NAVIGATION_STATE.NONE;
    this.needsRender = true;
  }

  private onWheel(event: WheelEvent) {
    event.preventDefault();
    this.updateMouse(event);
    
    // Set navigation center but only penetrate geometry when zooming in
    const zoomIn = event.deltaY < 0;
    this.setNavigationCenter(this.mouse, zoomIn);
    
    // Use the same step-based logic as the navigation control for consistent wheel feel
    const scale = 9;
    const input = (event.deltaY > 0 ? 1 : -1) * scale;
    this.zoom(input);
  }

  private setNavigationCenter(ndc: Vector2, applyPenetrationOffset: boolean = false) {
    const rayOffset = applyPenetrationOffset ? 10 : 0; // Fixed penetration distance
    const hitPoint = this.raycast(ndc, rayOffset);
    this.navigationCenter.copy(hitPoint);

    // Update pan plane
    this.panPlane.setFromNormalAndCoplanarPoint(this.camera.up, this.navigationCenter);
    
    // Update max pan distance based on distance to center
    const distToPlane = Math.abs(this.panPlane.distanceToPoint(this.camera.position));
    this.maxPanDistance = distToPlane * 60;
  }

  private raycast(ndc: Vector2, rayOffset: number = 0): Vector3 {
    this.camera.updateMatrixWorld();
    this.raycaster.setFromCamera(ndc, this.camera);
    
    if (rayOffset > 0) {
      this.raycaster.ray.origin.add(this.raycaster.ray.direction.clone().multiplyScalar(rayOffset));
    }
    
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);
    for (const hit of intersects) {
      if (hit.object.visible) {
        return hit.point.clone();
      }
    }
    
    // Fallback: Plane at target height (or y=0)
    const plane = new Plane(new Vector3(0, 1, 0), 0);
    const intersection = new Vector3();
    if (this.raycaster.ray.intersectPlane(plane, intersection)) {
      return intersection;
    }

    // Secondary fallback: point at fixed distance
    const fallbackPoint = new Vector3();
    this.raycaster.ray.at(500, fallbackPoint);
    return fallbackPoint;
  }

  private rotate(delta: Vector2) {
    const navCenter = this.navigationCenter;
    const camera = this.camera;

    // rotationKernelDelta logic
    const toCamera = camera.position.clone().sub(navCenter).applyQuaternion(camera.quaternion.clone().invert());
    const euler = new Euler(0, 0, 0, 'YXZ'); // Changed to YXZ for Y-up
    euler.setFromQuaternion(camera.quaternion);
    
    // Adjust indices for Y-up
    euler.x = MathUtils.clamp(euler.x + delta.y, -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01);
    euler.y += delta.x;
    
    camera.quaternion.setFromEuler(euler);
    camera.position.copy(navCenter).add(toCamera.applyQuaternion(camera.quaternion));
    
    this.needsRender = true;
  }

  private pan(ndc: Vector2) {
    const raycaster = this.raycaster;
    this.camera.updateWorldMatrix(false, false);
    raycaster.setFromCamera(ndc, this.camera);
    
    const intersectionPos = new Vector3();
    const ray = raycaster.ray;
    
    const intersected = ray.intersectPlane(this.panPlane, intersectionPos);
    if (!intersected) {
      const to = new Vector3();
      const from = new Vector3();
      this.panPlane.projectPoint(ray.origin.clone().add(ray.direction), to);
      this.panPlane.projectPoint(ray.origin, from);
      const direction = to.clone().sub(from).normalize();
      intersectionPos.copy(from).add(direction.multiplyScalar(this.maxPanDistance));
    }

    // Restrict distance
    const from = new Vector3();
    this.panPlane.projectPoint(ray.origin, from);
    if (from.distanceTo(intersectionPos) > this.maxPanDistance) {
      const direction = intersectionPos.clone().sub(from).normalize();
      intersectionPos.copy(from).add(direction.multiplyScalar(this.maxPanDistance));
    }

    const delta = intersectionPos.sub(this.navigationCenter);
    this.camera.position.sub(delta);
    
    this.needsRender = true;
  }

  private zoom(input: number) {
    const center = this.navigationCenter;
    const camera = this.camera;

    const direction = camera.position.clone().sub(center).normalize();
    const distance = center.distanceTo(camera.position);
    
    const distanceDelta = input * distance * this.zoomSpeed;
    const newDistance = Math.max(this.minDistance, distance + distanceDelta);
    
    camera.position.copy(center).add(direction.multiplyScalar(newDistance));
    this.needsRender = true;
  }

  setView(position: Vector3, target: Vector3) {
    this.camera.position.copy(position);
    this.navigationCenter.copy(target);
    this.target.copy(target);
    this.camera.lookAt(target);
    this.needsRender = true;
  }

  update(): boolean {
    const shouldRender = this.needsRender;
    this.needsRender = false;
    return shouldRender;
  }
}
