// src/utils/OriginManager.ts
import { Vector3 } from 'three';

export class OriginManager {
  private static instance: OriginManager;
  public origin: Vector3 | null = null;

  private constructor() {}

  public static getInstance(): OriginManager {
    if (!OriginManager.instance) {
      OriginManager.instance = new OriginManager();
    }
    return OriginManager.instance;
  }

  public setOrigin(point: Vector3) {
    if (!this.origin) {
      this.origin = point.clone();
      console.log('World Origin set to:', this.origin);
    }
  }

  public getOrigin(): Vector3 {
    return this.origin || new Vector3(0, 0, 0);
  }

  public hasOrigin(): boolean {
    return this.origin !== null;
  }
  
  public reset() {
      this.origin = null;
  }
}
