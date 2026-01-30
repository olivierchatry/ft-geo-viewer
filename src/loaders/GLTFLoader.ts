import { GLTFLoader as ThreeGLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import * as THREE from 'three';
import { OriginManager } from '../utils/OriginManager';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';

// Add BVH methods to Three.js prototypes
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

export class GLTFLoader {
  loader: ThreeGLTFLoader;
  private cache: Map<string, Promise<THREE.Group>> = new Map();

  constructor() {
    this.loader = new ThreeGLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    dracoLoader.setDecoderConfig({ type: 'wasm' });
    this.loader.setDRACOLoader(dracoLoader);
  }

  async load(url: string, position?: THREE.Vector3, scale?: THREE.Vector3, rotation?: THREE.Euler): Promise<THREE.Group> {
    if (!this.cache.has(url)) {
      this.cache.set(url, this.loadInternal(url));
    }

    const original = await this.cache.get(url)!;
    const model = original.clone(true); // Clone the scene for reuse

    // Apply transformations passed in arguments if provided
    if (position) model.position.copy(position);
    if (scale) model.scale.copy(scale);
    if (rotation) model.rotation.copy(rotation);

    model.updateMatrixWorld(true);

    return model;
  }

  private loadInternal(url: string): Promise<THREE.Group> {
    return new Promise((resolve, reject) => {
      this.loader.load(
        url,
        (gltf) => {
          const model = gltf.scene;

          model.updateMatrixWorld(true);

          model.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              mesh.castShadow = true;
              mesh.receiveShadow = true;
              
              // Compute BVH for optimized raycasting
              if (mesh.geometry) {
                mesh.geometry.computeBoundsTree();
              }
            }
          });

          // Search for 'center' in userData recursively
          let userDataCenter: any = null;
          model.traverse((child) => {
            if (userDataCenter) return;
            if (child.userData && child.userData.center) {
              userDataCenter = child.userData.center;
            }
          });

          const originManager = OriginManager.getInstance();
          
          if (userDataCenter) {
            const c = userDataCenter;
            const centerVec = new THREE.Vector3(c.x, c.z, -c.y);

            // If no origin, and this is far away, set it
            if (!originManager.hasOrigin() && centerVec.length() > 1000) {
              originManager.setOrigin(centerVec);
            }

            if (originManager.hasOrigin()) {
              // Geometry is local, but belongs at centerVec. 
              // Move to centerVec - Origin.
              model.position.copy(centerVec).sub(originManager.getOrigin());
            } else {
              model.position.copy(centerVec);
            }
          } else {
            // Heuristic for world-coordinate models without userData.center
            const box = new THREE.Box3().setFromObject(model);
            const center = new THREE.Vector3();
            box.getCenter(center);

            // If no origin, and this is far away, set it
            if (!originManager.hasOrigin() && center.length() > 1000) {
              originManager.setOrigin(center);
            }

            if (originManager.hasOrigin() && center.length() > 1000) {
              // Vertices are at world coords, subtract origin to bring to local space
              model.position.sub(originManager.getOrigin());
            }
          }

          resolve(model);
        },
        undefined,
        (error) => {
          console.error(`Error loading GLB from ${url}:`, error);
          reject(error);
        }
      );
    });
  }
}