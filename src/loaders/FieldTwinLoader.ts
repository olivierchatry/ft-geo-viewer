import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { OriginManager } from '../utils/OriginManager';
import { GLTFLoader } from './GLTFLoader';

interface FieldTwinConnection {
  sampled: { x: number; y: number; z: number }[];
  color?: string;
  params?: { width?: number };
  name?: string;
  connectionType?: {
    color?: string;
  };
}

interface FieldTwinShape {
  x: number;
  y: number;
  z: number;
  shapeType: string;
  color?: string;
  name?: string;
  // Dimensions
  boxWidth?: number;
  boxHeight?: number;
  boxDepth?: number;
  cylinderHeight?: number;
  cylinderRadiusTop?: number;
  cylinderRadiusBottom?: number;
  rotation?: { x: number; y: number; z: number };
}

interface FieldTwinStagedAsset {
  initialState?: {
    x: number;
    y: number;
    z: number;
    rotation?: number;
  };
  initialSTate?: {
    x: number;
    y: number;
    z: number;
    rotation?: number;
  };
  asset?: {
    model3durl?: string;
    model3dUrl?: string;
  };
  x?: number;
  y?: number;
  z?: number;
  fileId?: string;
  name?: string;
  rotation?: any;
  scale?: { x: number; y: number; z: number };
  [key: string]: any;
}

interface FieldTwinLayer {
  url: string;
  name?: string;
  isXVB?: boolean;
  urlNormalMap?: string;
  color?: string;
  opacity?: number;
  // Add other potential properties
  [key: string]: any;
}

interface FieldTwinWell {
  path: { x: number; y: number; z: number }[];
  radius?: number;
  color?: string;
  name?: string;
  visible?: boolean;
}

interface FieldTwinData {
  connections: Record<string, FieldTwinConnection>;
  shapes: Record<string, FieldTwinShape>;
  stagedAssets?: Record<string, FieldTwinStagedAsset>;
  layers?: Record<string, FieldTwinLayer>;
  visualisationMaps?: Record<string, { url: string; name?: string }>;
  wells?: Record<string, FieldTwinWell>;
}

export class FieldTwinLoader {
  private originManager: OriginManager;
  private fileLoader: THREE.FileLoader;
  private gltfLoader: GLTFLoader;

  constructor() {
    this.originManager = OriginManager.getInstance();
    this.fileLoader = new THREE.FileLoader();
    this.fileLoader.setResponseType('arraybuffer');
    this.gltfLoader = new GLTFLoader();
  }

public async load(_url: string, payload: any, onProgress?: (message: string, percent: number) => void): Promise<THREE.Group> {
        return this.parse(payload, onProgress);
    }

    public async parse(data: any, onProgress?: (message: string, percent: number) => void): Promise<THREE.Group> {
        console.log("Parsing FieldTwin Data with Staged Assets", data);
        const group = new THREE.Group();
        group.name = 'FieldTwin Layer';
        
        const ftData = data as FieldTwinData;

        // Debug Log
        console.log(`FT Data Keys: ${Object.keys(ftData).join(', ')}`);
        if (ftData.shapes) console.log(`Shapes: ${Object.keys(ftData.shapes).length}`);
        if (ftData.wells) console.log(`Wells: ${Object.keys(ftData.wells).length}`);
        if (ftData.connections) console.log(`Connections: ${Object.keys(ftData.connections).length}`);
        if (ftData.layers) console.log(`Layers: ${Object.keys(ftData.layers).length}`);

        // Calculate total tasks for progress
        // Shapes/Connections/Wells are fast (sync), we treat them as initial setup (10%)
        // Layers and StagedAssets are async downloads.
        const layers = ftData.layers || ftData.visualisationMaps;
        const layerCount = layers ? Object.keys(layers).length : 0;
        const stagedAssets = ftData.stagedAssets;
        const assetCount = stagedAssets ? Object.keys(stagedAssets).length : 0;
        
        const totalAsyncTasks = layerCount + assetCount;
        let completedTasks = 0;
        
        const updateProgress = (itemName: string) => {
            if (onProgress && totalAsyncTasks > 0) {
               completedTasks++;
               // Base 10% + remaining 90% distributed among async tasks
               const percent = 10 + (completedTasks / totalAsyncTasks) * 90;
               onProgress(`Loading ${itemName}...`, Math.min(percent, 100));
            }
        };

        if (onProgress) onProgress("Parsing Shapes, Wells & Connections...", 5);

        // 1. Shapes
        if (ftData.shapes) {
            const shapeGroup = new THREE.Group();
            shapeGroup.name = 'Shapes';
            Object.values(ftData.shapes).forEach((shape: any) => {
                try {
                    const mesh = this.createShape(shape);
                    if (mesh) shapeGroup.add(mesh);
                } catch (e) {
                    console.warn("Error creating shape", e);
                }
            });
            group.add(shapeGroup);
        }

        // 2. Wells
        if (ftData.wells) {
            const wellGroup = new THREE.Group();
            wellGroup.name = 'Wells';
            let loadedWells = 0;
            Object.values(ftData.wells).forEach((well: any) => {
                try {
                    const mesh = this.createWell(well);
                    if (mesh) {
                         wellGroup.add(mesh);
                         loadedWells++;
                    }
                } catch (e) {
                    console.warn("Error creating well", well, e);
                }
            });
            console.log(`Loaded ${loadedWells} wells.`);
            group.add(wellGroup);
        }
        
        // 3. Connections
        if (ftData.connections) {
            const connGroup = new THREE.Group();
            connGroup.name = 'Connections';
            Object.values(ftData.connections).forEach((conn: any) => {
                try {
                    const mesh = this.createConnection(conn);
                    if (mesh) connGroup.add(mesh);
                } catch (e) {
                    console.warn("Error creating connection", e);
                }
            });
            group.add(connGroup);
        }

        if (onProgress) onProgress("Starting Downloads...", 10);

        // 4. Layers (XVB)
        if (layers && Object.keys(layers).length > 0) {
            const mapGroup = new THREE.Group();
            mapGroup.name = 'Terrain Layers';
            // Load in parallel
            const promises = Object.values(layers).map(async (layer) => {
                console.log(`Processing Layer: ${layer.name}, URL: ${layer.url}, isXVB: ${layer.isXVB}`);
                console.log(`Layer full properties:`, Object.keys(layer), layer.urlNormalMap ? `urlNormalMap: ${layer.urlNormalMap}` : 'No urlNormalMap');
                if (layer.url && layer.isXVB) {
                    try {
                        const mesh = await this.loadXvbLayer(layer);
                        if (mesh) {
                             mapGroup.add(mesh);
                             console.log(`Layer ${layer.name} added.`);
                        }
                    } catch (e) {
                        console.error(`Failed to load Layer ${layer.name}`, e);
                    } finally {
                        updateProgress(layer.name || 'Layer');
                    }
                } else {
                    // Add a placeholder for non-XVB layers so they appear in the scene graph (and UI)
                    const placeholder = new THREE.Group();
                    placeholder.name = layer.name || 'Unnamed Layer';
                    placeholder.userData = { ...layer, type: 'Placeholder/Overlay' };
                    mapGroup.add(placeholder);

                    console.log(`Skipping Layer Content ${layer.name || 'Unnamed'} (Not XVB or no URL), added placeholder.`);
                    updateProgress(layer.name || 'Skipped Layer');
                }
            });
            await Promise.all(promises);
            
            if (mapGroup.children.length > 0) {
                group.add(mapGroup);
            }
        }

        // 5. Staged Assets
        if (ftData.stagedAssets && Object.keys(ftData.stagedAssets).length > 0) {
            const assetGroup = new THREE.Group();
            assetGroup.name = 'Staged Assets';
             // Load in parallel
             const promises = Object.values(ftData.stagedAssets).map(async (asset) => {
                // Check inner asset model3dUrl or model3durl
                if (asset.asset && (asset.asset.model3dUrl || asset.asset.model3durl)) {
                    try {
                        const model = await this.createStagedAsset(asset);
                        if (model) assetGroup.add(model);
                    } catch (e) {
                         console.error(`Failed to load Staged Asset ${asset.name}`, e);
                    } finally {
                        updateProgress(asset.name || 'Asset');
                    }
                } else {
                    updateProgress(asset.name || 'Skipped Asset');
                }
            });
            await Promise.all(promises);

            if (assetGroup.children.length > 0) {
                group.add(assetGroup);
            }
        }

    console.log(`FieldTwin parse complete. Returning group with ${group.children.length} children.`);
    return group;
  }

  private async loadXvbLayer(layer: FieldTwinLayer): Promise<THREE.Object3D | null> {
    const url = layer.url;
    const name = layer.name;
    const normalMapUrl = layer.urlNormalMap;
    
    try {
      const downloadedData = await this.fileLoader.loadAsync(url) as ArrayBuffer;

      // Header Check
      const multipleOf4 = (downloadedData.byteLength + 3) & ~3;
      if (downloadedData.byteLength <= 32 || multipleOf4 !== downloadedData.byteLength) {
        console.warn("Invalid XVB data length");
        return null;
      }

      // Parse Dimensions
      const intData = new Int32Array(downloadedData);
      const width = intData[0];
      const height = intData[1];

      if (width <= 0 || height <= 0 || width > 16384 || height > 16384) {
        console.warn("Invalid XVB dimensions", width, height);
        return null;
      }

      const floatData = new Float32Array(downloadedData, 8); // Starts at byte 8
      // floatData[0..2] is min, [3..5] is max
      const minX = floatData[0];
      const minY = floatData[1];
      const minZ = floatData[2]; // Elev
      const maxX = floatData[3];
      const maxY = floatData[4];
      const maxZ = floatData[5];

      const heights = new Float32Array(downloadedData, 32);

      if (heights.length !== width * height) {
        console.warn("Height data length mismatch");
        return null;
      }

      const customGeo = new THREE.BufferGeometry();
      const vertices = new Float32Array(width * height * 3);
      const uvs = new Float32Array(width * height * 2);

      const rangeX = maxX - minX;
      const rangeY = maxY - minY;

      const stepX = rangeX / (width - 1);
      const stepY = rangeY / (height - 1);

      // Center the grid for precision
      const centerX = minX + rangeX * 0.5;
      const centerY = minY + rangeY * 0.5;
      
      console.log(`XVB Loading: Size ${width}x${height}, Range X: ${rangeX}, Y: ${rangeY}, Center: ${centerX}, ${centerY}`);
      
      // Calculate mesh position (World Position)
      const meshPos = this.normalizeCoordinate(centerX, centerY, 0);
      console.log(`XVB Mesh Position:`, meshPos);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = y * width + x;
          const h = heights[i]; // Elevation

          // Data coords (Local to center)
          const vx = (minX + x * stepX) - centerX;
          const vy = (minY + y * stepY) - centerY;
          const vz = h;

          // Our coordinate system mapping in normalizeCoordinate is: X, Z, -Y
          // Since vz (elevation) corresponds to Y in Three.js and -vy corresponds to Z in Three.js (backwards)
          // Actually check normalizeCoordinate: raw = (x, z + bias, -y).
          // Local vertex:
          // x -> vx
          // y (up) -> vz
          // z (back) -> -vy

          vertices[i * 3 + 0] = vx;
          vertices[i * 3 + 1] = vz;
          vertices[i * 3 + 2] = -vy;
          
          // UV coordinates (0-1 range)
          uvs[i * 2 + 0] = x / (width - 1);
          uvs[i * 2 + 1] = y / (height - 1);
        }
      }

      customGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      customGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

      const indices = [];
      for (let y = 0; y < height - 1; y++) {
        for (let x = 0; x < width - 1; x++) {
          const a = y * width + x;
          const b = y * width + x + 1;
          const c = (y + 1) * width + x;
          const d = (y + 1) * width + x + 1;

          indices.push(a, b, d);
          indices.push(d, c, a);
        }
      }
      customGeo.setIndex(indices);
      customGeo.computeVertexNormals();
      
      // Speed up raycasting for large terrain
      // @ts-ignore
      if (customGeo.computeBoundsTree) customGeo.computeBoundsTree();

      // Create seabed-style material
      const material = await this.createSeabedMaterial(normalMapUrl, minZ, maxZ);

      const mesh = new THREE.Mesh(customGeo, material);
      mesh.name = name || 'XVB Terrain';
      mesh.position.copy(meshPos);
      
      // Ensure the mesh is not frustrated by frustum culling if the bounding box is not updated or large
      mesh.frustumCulled = false; 

      // Debug Bounding Box
      customGeo.computeBoundingBox();
      if (customGeo.boundingBox) {
          const min = customGeo.boundingBox.min.clone().add(mesh.position);
          const max = customGeo.boundingBox.max.clone().add(mesh.position);
          console.log(`XVB Layer World Bounds: Min(${min.x.toFixed(0)}, ${min.y.toFixed(0)}, ${min.z.toFixed(0)}) Max(${max.x.toFixed(0)}, ${max.y.toFixed(0)}, ${max.z.toFixed(0)})`);
      }

      return mesh;

    } catch (e) {
      console.error("Error loading XVB", e);
      return null;
    }
  }


  /**
   * Creates a seabed-style material with optional normal map
   */
  private async createSeabedMaterial(normalMapUrl?: string, minElev?: number, maxElev?: number): Promise<THREE.Material> {
    const textureLoader = new THREE.TextureLoader();
    
    // Generate procedural seabed diffuse texture
    const diffuseTexture = this.generateSeabedTexture(512);
    diffuseTexture.wrapS = THREE.RepeatWrapping;
    diffuseTexture.wrapT = THREE.RepeatWrapping;
    const repeatScale = 4; // Lower repeat = less moire
    diffuseTexture.repeat.set(repeatScale, repeatScale);
    
    // Enable anisotropic filtering to prevent moire at sharp angles
    diffuseTexture.anisotropy = 16;
    diffuseTexture.minFilter = THREE.LinearMipmapLinearFilter;
    
    const materialParams: THREE.MeshStandardMaterialParameters = {
      map: diffuseTexture,
      roughness: 0.95,
      metalness: 0.0,
      side: THREE.DoubleSide,
    };
    
    // Load normal map if URL provided
    if (normalMapUrl) {
      try {
        console.log(`Loading normal map: ${normalMapUrl}`);
        const normalMap = await textureLoader.loadAsync(normalMapUrl);
        normalMap.wrapS = THREE.RepeatWrapping;
        normalMap.wrapT = THREE.RepeatWrapping;
        normalMap.repeat.set(repeatScale, repeatScale); // Must match diffuse repeat
        normalMap.anisotropy = 16; // CRITICAL for reducing moire in lighting
        materialParams.normalMap = normalMap;
        materialParams.normalScale = new THREE.Vector2(1, 1);
        console.log(`Normal map loaded successfully`);
      } catch (e) {
        console.warn(`Failed to load normal map: ${e}`);
      }
    }
    
    return new THREE.MeshStandardMaterial(materialParams);
  }
  
  /**
   * Generates a procedural seabed texture (sandy/muddy seafloor appearance)
   * Designed to be organic, sandy, and tileable without visible moire patterns.
   */
  private generateSeabedTexture(size: number): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    
    // Base color - organic seabed (invert R and B per user feedback)
    const baseR = 48, baseG = 55, baseB = 52;
    
    // Fill with base color
    ctx.fillStyle = `rgb(${baseR}, ${baseG}, ${baseB})`;
    ctx.fillRect(0, 0, size, size);
    
    const imageData = ctx.getImageData(0, 0, size, size);
    const data = imageData.data;
    
    /**
     * Organic noise generator that avoids axis-aligned artifacts (the "cross" pattern)
     * uses integer-based sums/differences to ensure perfect tileability over 2PI.
     */
    const getNoise = (nx: number, ny: number) => {
      let n = 0;
      // Layer 1: Large organic waves at an angle
      n += Math.sin(nx * 1 + ny * 1) * Math.cos(nx * 1 - ny * 2) * 1.0;
      // Layer 2: Medium details with prime-ish frequency mixing
      n += Math.sin(nx * 3 - ny * 2) * Math.cos(nx * 2 + ny * 5) * 0.5;
      // Layer 3: Finer variation
      n += Math.sin(nx * 7 + ny * 3) * Math.cos(nx * 4 - ny * 7) * 0.25;
      // Layer 4: High frequency ripples
      n += Math.sin(nx * 13 - ny * 5) * Math.cos(nx * 8 + ny * 11) * 0.125;
      return n;
    };

    for (let i = 0; i < data.length; i += 4) {
      const x = (i / 4) % size;
      const y = Math.floor((i / 4) / size);
      
      const nx = (x / size) * Math.PI * 2;
      const ny = (y / size) * Math.PI * 2;
      
      // Multi-scale organic noise
      const noise = getNoise(nx, ny);
      
      // High-frequency sand grain (randomness per pixel)
      const grain = (Math.random() - 0.5) * 5;
      
      // Total noise influence
      const totalNoise = (noise * 18) + grain;
      
      // RGBA order - inverting R and B here too just in case it's a systemic texture interpretation issue
      data[i] = Math.max(0, Math.min(255, baseB + totalNoise * 0.9));
      data[i + 1] = Math.max(0, Math.min(255, baseG + totalNoise * 0.98));
      data[i + 2] = Math.max(0, Math.min(255, baseR + totalNoise));
      data[i + 3] = 255;
    }
    
    // Add subtle procedural "clump" variation but much softer
    for (let spot = 0; spot < 40; spot++) {
      const sx = Math.random() * size;
      const sy = Math.random() * size;
      const radius = 2 + Math.random() * 6;
      const darkness = 0.05 + Math.random() * 0.1;
      
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < radius) {
            const px = (Math.floor(sx + dx) + size) % size;
            const py = (Math.floor(sy + dy) + size) % size;
            const idx = (py * size + px) * 4;
            
            const factor = 1.0 - (darkness * (1.0 - dist / radius));
            data[idx] *= factor;
            data[idx + 1] *= factor;
            data[idx + 2] *= factor;
          }
        }
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    // Final soften/blur to eliminate any pixel-level aliasing (main cause of moire)
    ctx.globalAlpha = 0.4;
    ctx.drawImage(canvas, 1, 0);
    ctx.drawImage(canvas, -1, 0);
    ctx.drawImage(canvas, 0, 1);
    ctx.drawImage(canvas, 0, -1);
    ctx.globalAlpha = 1.0;
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  private normalizeCoordinate(x: number, y: number, z: number): THREE.Vector3 {
    // Data: X=East, Y=North, Z=Elevation
    // Three: X=Right, Y=Up, Z=Back

    // Construction Vector: Input X -> Three X, Input Z -> Three Y, Input Y -> Three -Z
    const zBias = 0.1;
    const raw = new THREE.Vector3(x, z + zBias, -y);

    if (!this.originManager.hasOrigin()) {
      // Ignore (0,0) coordinates for origin setting as they are likely invalid/default
      if (Math.abs(x) > 1 && Math.abs(y) > 1) {
        this.originManager.setOrigin(raw);
      }
    }

    const origin = this.originManager.getOrigin();
    return raw.clone().sub(origin);
  }

  private async createStagedAsset(asset: FieldTwinStagedAsset): Promise<THREE.Group | null> {
    const url = asset.asset?.model3durl || asset.asset?.model3dUrl;
    if (!url) return null;

    // Use initialState / initialSTate if available, otherwise fallback to top level x,y,z
    const st = asset.initialState || asset.initialSTate;
    const state = st ? {
        x: st.x,
        y: st.y,
        z: st.z,
        rotation: st.rotation
    } : { 
        x: asset.x || 0, 
        y: asset.y || 0, 
        z: asset.z || 0, 
        rotation: typeof asset.rotation === 'number' ? asset.rotation : (asset.rotation?.z || 0)
    };

    // Skip artifacts at 0,0,0
    if (Math.abs(state.x) < 0.01 && Math.abs(state.y) < 0.01) {
      return null;
    }

    // Position
    const position = this.normalizeCoordinate(state.x, state.y, state.z);

    // Rotation
    // FT rotation usually degrees (0=North, 90=East) - heading.
    const rotation = new THREE.Euler(0, 0, 0);
    const heading = state.rotation ?? 0;
    
    // Mapping FT Heading to Three.js Y-rotation
    // FT: Clockwise. Three.js: Counter-clockwise.
    rotation.y = THREE.MathUtils.degToRad(-heading);

    // Apply tilt/roll if present in asset.rotation object
    if (typeof asset.rotation === 'object') {
        if (asset.rotation.x) rotation.x = THREE.MathUtils.degToRad(asset.rotation.x);
        if (asset.rotation.y) rotation.z = THREE.MathUtils.degToRad(asset.rotation.y);
    }

    // Scale
    const scale = new THREE.Vector3(1, 1, 1);
    if (asset.scale) {
      scale.set(asset.scale.x ?? 1, asset.scale.y ?? 1, asset.scale.z ?? 1);
    }

    const model = await this.gltfLoader.load(url, position, scale, rotation);
    if (model) {
      model.name = asset.name || 'Staged Asset';
      // Store metadata
      model.userData = { ...asset };
    }
    return model;
  }

  /**
   * Helper to fix FieldTwin colors that might have inverted R and B (BGR format)
   */
  private fixColor(hex?: string): string {
    if (!hex || !hex.startsWith('#') || hex.length !== 7) return hex || '#cccccc';
    // Swap R and B: #RRGGBB -> #BBGGRR
    const r = hex.substring(1, 3);
    const g = hex.substring(3, 5);
    const b = hex.substring(5, 7);
    return `#${b}${g}${r}`;
  }

  private createShape(shape: FieldTwinShape): THREE.Object3D | null {
    // Skip artifacts at 0,0,0
    if (Math.abs(shape.x) < 0.01 && Math.abs(shape.y) < 0.01) {
      return null;
    }

    let geometry: THREE.BufferGeometry | undefined;
    // Default color white if missing
    const colorVal = this.fixColor(shape.color);
    let material = new THREE.MeshStandardMaterial({
      color: colorVal,
      roughness: 0.7,
      metalness: 0.1
    });

    // Parse Dimensions (defaulting to 10 if missing/zero as seen in data)
    const width = shape.boxWidth || 10;
    const height = shape.boxHeight || 10;
    const depth = shape.boxDepth || 10;

    switch (shape.shapeType) {
      case 'Rectangle':
      case 'Cube':
        geometry = new THREE.BoxGeometry(width, height, depth);
        break;
      case 'Cylinder':
      case 'Tube':
        const radiusTop = shape.cylinderRadiusTop || 5;
        const radiusBottom = shape.cylinderRadiusBottom || 5;
        const cylHeight = shape.cylinderHeight || height;
        geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, cylHeight, 16);
        break;
      default:
        geometry = new THREE.BoxGeometry(5, 5, 5);
        break;
    }

    if (geometry) {
      const mesh = new THREE.Mesh(geometry, material);
      const pos = this.normalizeCoordinate(shape.x, shape.y, shape.z);
      mesh.position.copy(pos);

      if (shape.rotation) {
        if (shape.rotation.z) {
          mesh.rotation.y = THREE.MathUtils.degToRad(-shape.rotation.z);
        }
      }

      mesh.userData = shape;
      mesh.name = shape.name || 'Shape';
      return mesh;
    }
    return null;
  }

  private createWell(well: FieldTwinWell): THREE.Object3D | null {
    if (!well.path || well.path.length === 0) {
        // Log keys for the first few errors to debug data structure
        console.warn("Well missing path. Available keys:", Object.keys(well));
        return null;
    }

    const points: THREE.Vector3[] = [];
    well.path.forEach(p => {
      points.push(this.normalizeCoordinate(p.x, p.y, p.z));
    });

    if (points.length < 2) return null;

    // Create curve
    const curve = new THREE.CatmullRomCurve3(points);
    const radius = well.radius !== undefined ? well.radius : 1;
    const tubularSegments = Math.max(64, points.length * 2);
    
    const geometry = new THREE.TubeGeometry(curve, tubularSegments, radius, 8, false);

    const colorVal = this.fixColor(well.color) || '#ff0000';
    const material = new THREE.MeshStandardMaterial({ 
        color: colorVal, 
        roughness: 0.6,
        metalness: 0.2
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = well.name || 'Well';
    mesh.userData = well;

    return mesh;
  }

  private createConnection(conn: FieldTwinConnection): THREE.Object3D | null {
    if (!conn.sampled || conn.sampled.length === 0) return null;

    const points: THREE.Vector3[] = [];
    conn.sampled.forEach(p => {
      points.push(this.normalizeCoordinate(p.x, p.y, p.z + 0.1));
    });

    if (points.length < 2) return null;

    const typeColor = this.fixColor(conn.connectionType?.color);
    let colorVal = typeColor !== '#cccccc' ? typeColor : (this.fixColor(conn.color) || '#ffff00');

    // Use Line2 for thick lines (LineBasicMaterial linewidth doesn't work in WebGL)
    const positions: number[] = [];
    points.forEach(p => {
      positions.push(p.x, p.y, p.z);
    });

    const geometry = new LineGeometry();
    geometry.setPositions(positions);

    const material = new LineMaterial({
      color: new THREE.Color(colorVal).getHex(),
      linewidth: 3, // Width in pixels
      worldUnits: false, // Use screen-space width
      resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
    });

    const line = new Line2(geometry, material);
    line.computeLineDistances();
    line.name = conn.name || 'Connection';
    line.userData = conn;

    return line;
  }
}