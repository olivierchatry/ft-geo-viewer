// src/utils/OriginManager.ts
import * as THREE from 'three';

export class OriginManager {
  private static instance: OriginManager;
  public origin: THREE.Vector3 | null = null;

  private constructor() {}

  public static getInstance(): OriginManager {
    if (!OriginManager.instance) {
      OriginManager.instance = new OriginManager();
    }
    return OriginManager.instance;
  }

  public setOrigin(point: THREE.Vector3) {
    if (!this.origin) {
      this.origin = point.clone();
      console.log('World Origin set to:', this.origin);
    }
  }

  public getOrigin(): THREE.Vector3 {
    return this.origin || new THREE.Vector3(0, 0, 0);
  }

  public hasOrigin(): boolean {
    return this.origin !== null;
  }
  
  public reset() {
      this.origin = null;
  }
}
