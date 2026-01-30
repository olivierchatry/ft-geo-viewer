import { GLTFLoader as ThreeGLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import * as THREE from 'three';
import { OriginManager } from '../utils/OriginManager';

export class GLTFLoader {
  loader: ThreeGLTFLoader;

  constructor() {
    this.loader = new ThreeGLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    dracoLoader.setDecoderConfig({ type: 'js' });
    this.loader.setDRACOLoader(dracoLoader);
  }

  load(url: string, position: THREE.Vector3 = new THREE.Vector3(), scale: THREE.Vector3 = new THREE.Vector3(1, 1, 1), rotation: THREE.Euler = new THREE.Euler()): Promise<THREE.Group> {
    return new Promise((resolve, reject) => {
      this.loader.load(
        url,
        (gltf) => {
          const model = gltf.scene;

          model.updateMatrixWorld(true);
          const box = new THREE.Box3().setFromObject(model);
          const center = box.getCenter(new THREE.Vector3());

          const originManager = OriginManager.getInstance();

          // Search for 'center' in userData recursively
          let userDataCenter: any = null;
          model.traverse((child) => {
            if (userDataCenter) return;
            if (child.userData && child.userData.center) {
              userDataCenter = child.userData.center;
            }
          });

          // Check if userData defines a center (World Position)
          if (userDataCenter) {
            const c = userDataCenter;
            // User data usually comes as X=East, Y=North, Z=Elevation
            // We match GeoJSONLoader behavior: X->X, Y->Height(Y), Z->-North(-Z)
            // If userData is {x, y, z} where y=North, z=Height:
            // Vector3(x, z, -y) is correct.
            const centerVec = new THREE.Vector3(c.x, c.z, -c.y);

            // If no origin, and this is huge, set it
            if (!originManager.hasOrigin() && centerVec.length() > 10000) {
              originManager.setOrigin(centerVec);
            }

            if (originManager.hasOrigin()) {
              // Geometry is local, but belongs at centerVec.
              // Move to centerVec - Origin.
              model.position.copy(centerVec).sub(originManager.getOrigin());
            } else {
              // No origin logic needed (small coords or first object is small)
              model.position.copy(centerVec);
            }
          } else {
            // If no origin set, use this model's bounding center as origin
            // Heuristic: If coordinates are huge (>10000), assume world coordinates.
            if (!originManager.hasOrigin()) {
              if (center.length() > 10000) {
                originManager.setOrigin(center);
              }
            }

            if (originManager.hasOrigin()) {
              const origin = originManager.getOrigin();
              // Assume GLB has world coordinates built into geometry (Vertices are huge).
              // Shift model back by origin so vertices become local.
              model.position.sub(origin);
            }
          }

          // Apply transformations passed in arguments
          // We add the position because the model might already be positioned relative to origin above
          model.position.add(position);
          model.scale.copy(scale);
          model.rotation.copy(rotation);

          model.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          resolve(model);
        },
        undefined,
        (error) => {
          reject(error);
        }
      );
    });
  }
}