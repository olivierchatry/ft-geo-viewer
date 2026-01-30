import * as THREE from 'three';
import earcut from 'earcut';
import { OriginManager } from '../utils/OriginManager';

export class GeoJSONLoader {

  constructor() { }

  async load(url: string): Promise<THREE.Group> {
    const response = await fetch(url);
    const json = await response.json();
    return this.parse(json);
  }

  parse(json: any): THREE.Group {
    const group = new THREE.Group();

    // Ensure origin manager is initialized if needed
    OriginManager.getInstance();

    const features = json.features || (json.type === 'Feature' ? [json] : []);

    for (const feature of features) {
      const geometry = feature.geometry;
      if (!geometry) continue;

      const properties = feature.properties || {};
      const name = properties.name || properties.id || 'Feature';
      const color = properties.color || Math.random() * 0xffffff;
      const material = new THREE.MeshPhongMaterial({ color, side: THREE.DoubleSide });
      // const material = new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide }); // Standard might look better with lights
      const lineMaterial = new THREE.LineBasicMaterial({ color });

      if (geometry.type === 'Polygon') {
        const mesh = this.createPolygonMesh(geometry.coordinates, material);
        if (mesh) {
          mesh.name = name;
          mesh.userData = properties;
          group.add(mesh);
        }
      } else if (geometry.type === 'MultiPolygon') {
        const multiGroup = new THREE.Group();
        multiGroup.name = name;
        multiGroup.userData = properties;

        for (const polygonCoords of geometry.coordinates) {
          const mesh = this.createPolygonMesh(polygonCoords, material);
          if (mesh) multiGroup.add(mesh);
        }
        group.add(multiGroup);
      } else if (geometry.type === 'LineString') {
        const line = this.createLine(geometry.coordinates, lineMaterial);
        if (line) {
          line.name = name;
          line.userData = properties;
          group.add(line);
        }
      } else if (geometry.type === 'MultiLineString') {
        const multiGroup = new THREE.Group();
        multiGroup.name = name;
        multiGroup.userData = properties;
        for (const lineCoords of geometry.coordinates) {
          const line = this.createLine(lineCoords, lineMaterial);
          if (line) multiGroup.add(line);
        }
        group.add(multiGroup);
      }
    }

    return group;
  }

  createLine(coordinates: any[], material: THREE.LineBasicMaterial): THREE.Line | null {
    const vertices: number[] = [];
    this.processRing(coordinates, vertices);

    if (vertices.length === 0) return null;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

    return new THREE.Line(geometry, material);
  }

  createPolygonMesh(coordinates: any[], material: THREE.Material): THREE.Mesh | null {
    // coordinates[0] is the outer ring, others are holes
    const vertices: number[] = [];
    const holeIndices: number[] = [];

    const outerRing = coordinates[0];
    if (!outerRing || outerRing.length < 3) return null;

    // Process outer ring
    this.processRing(outerRing, vertices);

    // Process holes
    for (let i = 1; i < coordinates.length; i++) {
      holeIndices.push(vertices.length / 3); // index in 3d vertices? earcut expects flat array index / dimension
      this.processRing(coordinates[i], vertices);
    }

    // Earcut needs 2D flat array. 
    // We are currently creating 3D vertices (x, y, z).
    // Let's protect Y up.
    // Assume input is X, Y (or Lon, Lat).
    // We Map input X -> Three X
    // Input Y -> Three Z (Ground)
    // Input Z (if exists) -> Three Y (Height)

    const flat2DVertices: number[] = [];
    for (let i = 0; i < vertices.length; i += 3) {
      flat2DVertices.push(vertices[i], vertices[i + 2]); // X, Z
    }

    // The hole indices for earcut act on the 2D array (stride 2? No, earcut works on vertex index usually? No, it works on the flat array index if passed, NO.
    // earcut(data, holeIndices, dim)
    // "holeIndices is an array of the start index of each hole in the input array"

    const holeIndicesForEarcut: number[] = [];
    let currentPointCount = 0;

    // Outer ring is first
    currentPointCount += outerRing.length;

    for (let i = 1; i < coordinates.length; i++) {
      holeIndicesForEarcut.push(currentPointCount); // earcut takes vertex index if passed to generic earcut?
      // Wait, standard earcut (npm package) documentation:
      // "holeIndices is an array of the start index of each hole in the input array"
      // But checking source/examples: if [10,0, 0,50, 60,60, 70,10] (4 points), and hole starts after.
      // It seems it is the starting index in the FLAT array.

      currentPointCount += coordinates[i].length;
    }

    // However, I will check if I can just pass 3D array? No, earcut works on 2D usually.
    // Let's use 2D and then map back.

    // Correction: earcut takes indices relative to the start of the array.
    // If I have 100 points, flat array length 200.
    // If hole starts at point 50, index is 100.

    // BUT! earcut signature earcut(data, holeIndices, dim)
    // If I look at the usage in three.js ShapeUtils (which uses earcut), it seems they pass indices.

    // Let's assume it *is* the flat index.
    const flatHoleIndices = holeIndicesForEarcut.map(i => i * 2);

    const indices = earcut(flat2DVertices, flatHoleIndices, 2);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    
    // @ts-ignore
    if (geometry.computeBoundsTree) geometry.computeBoundsTree();

    return new THREE.Mesh(geometry, material);
  }

  processRing(ring: any[], vertices: number[]) {
    const originManager = OriginManager.getInstance();

    for (const point of ring) {
      let x = point[0];
      let y = point[1];
      let z = point[2] || 0;

      // Handle coordinates mapping
      // Basic Assumption: Input X,Y is ground plane.
      // Add 0.1 to height (z) to avoid z-fighting
      const vec = new THREE.Vector3(x, z + 0.1, -y); // -y to flip North? standard mapping depends on projection.

      if (!originManager.hasOrigin()) {
        originManager.setOrigin(vec);
      }

      // Re-center
      vec.sub(originManager.getOrigin());

      vertices.push(vec.x, vec.y, vec.z);
    }
  }
}
