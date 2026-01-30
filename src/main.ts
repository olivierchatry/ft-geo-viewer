import './style.css';
import { World } from './World';
import { GLTFLoader } from './loaders/GLTFLoader';
import { GeoJSONLoader } from './loaders/GeoJSONLoader';
import { FieldTwinLoader } from './loaders/FieldTwinLoader';
import { OriginManager } from './utils/OriginManager';
import * as THREE from 'three';
import GUI from 'lil-gui';

const world = new World(document.body);
const gltfLoader = new GLTFLoader();
const geoJsonLoader = new GeoJSONLoader();
const fieldTwinLoader = new FieldTwinLoader();

// --- Loading Helper ---
const loaderOverlay = document.getElementById('loading-overlay');
const loaderText = document.getElementById('loader-text');
const loaderBar = document.getElementById('loader-bar');

function setLoader(msg: string, percent?: number) {
  if (!loaderOverlay) return;
  loaderOverlay.classList.remove('fade-out');
  if (loaderText) {
    loaderText.innerText = msg;
    loaderText.title = msg; // Show full text on hover if truncated
  }
  if (loaderBar && percent !== undefined) loaderBar.style.width = `${percent}%`;
}

function hideLoader() {
  if (loaderOverlay) loaderOverlay.classList.add('fade-out');
}

// Initial hide (engine only)
setTimeout(hideLoader, 1000); 

// --- Coordinate Display ---
const coordsDiv = document.createElement('div');
coordsDiv.style.position = 'absolute';
coordsDiv.style.bottom = '10px';
coordsDiv.style.left = '10px';
coordsDiv.style.color = '#eee';
coordsDiv.style.backgroundColor = 'rgba(26, 28, 30, 0.7)';
coordsDiv.style.padding = '5px 10px';
coordsDiv.style.border = '1px solid rgba(255, 255, 255, 0.1)';
coordsDiv.style.borderRadius = '4px';
coordsDiv.style.fontFamily = 'monospace';
coordsDiv.style.fontSize = '12px';
coordsDiv.style.userSelect = 'none';
coordsDiv.style.pointerEvents = 'none'; // Click through
coordsDiv.innerText = 'E: 0.00, N: 0.00, H: 0.00';
document.body.appendChild(coordsDiv);

// Raycaster for coordinates
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

window.addEventListener('mousemove', (event) => {
  // Calculate mouse position in normalized device coordinates
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  // Raycast
  raycaster.setFromCamera(mouse, world.camera);

  // Intersect objects
  // Note: Intersecting everything might be heavy. 
  // We ideally want to intersect "Ground" or specific layers.
  // For now, let's intersect the scene children (excluding helpers if possible, but raycaster might hit them)
  // To properly support Lines (GeoJSON), we need near threshold.
  raycaster.params.Line.threshold = 1;

  const intersects = raycaster.intersectObjects(world.scene.children, true);

  let point: THREE.Vector3 | null = null;

  // Find first valid intersection (ignore grid helpers etc if possible, but they are meshes/line segments)
  // Actually GridHelper is LineSegments.

  for (const intersect of intersects) {
    // Ignore lines if we want only surfaces, but GeoJSON lines are lines.
    // Let's ignore GridHelper and AxesHelper
    if (intersect.object instanceof THREE.GridHelper || intersect.object instanceof THREE.AxesHelper) continue;
    if (intersect.object.name === 'Sky') continue; // if we had a skybox

    point = intersect.point;
    break;
  }

  // If no intersection (e.g. looking at sky), maybe project to ground plane (y=0)?
  if (!point) {
    // Raycast to plane y=0
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const target = new THREE.Vector3();
    point = raycaster.ray.intersectPlane(plane, target);
  }

  if (point) {
    const originManager = OriginManager.getInstance();
    const origin = originManager.getOrigin();

    if (origin) {
      // Three JS: X (East), Y (Up), Z (South).
      // Geo Mapping: X -> X, Y -> -Z.

      // Reconstruct Real World Coords:
      const realX = point.x + origin.x;
      const realY = -(point.z + origin.z); // Z is inverted Y
      const realZ = point.y + origin.y;

      coordsDiv.innerText = `E: ${realX.toFixed(2)}, N: ${realY.toFixed(2)}, H: ${realZ.toFixed(2)}`;
    } else {
      // Local coords if no origin set
      coordsDiv.innerText = `X: ${point.x.toFixed(2)}, Y: ${point.y.toFixed(2)}, Z: ${point.z.toFixed(2)}`;
    }
  }
});

// --- UI Setup with lil-gui ---
const gui = new GUI({ title: '3D Geo Viewer' });
const layersFolder = gui.addFolder('Layers');

const params = {
  loadGLB: () => document.getElementById('glbInput')?.click(),
  loadGeoJSON: () => document.getElementById('geojsonInput')?.click(),
  loadFieldTwin: () => { ftModal.style.display = 'flex'; },
  resetCamera: () => {
    world.setView(new THREE.Vector3(0, 500, 500), new THREE.Vector3(0, 0, 0), true);
  },
  clearScene: () => {
    location.reload();
  }
};

gui.add(params, 'loadGeoJSON').name('Load GeoJSON');
gui.add(params, 'loadGLB').name('Load Model');
gui.add(params, 'loadFieldTwin').name('Load from FieldTwin API');
gui.add(params, 'resetCamera').name('Reset Camera');
gui.add(params, 'clearScene').name('Clear / Reload');

// Helper folder
const displayFolder = gui.addFolder('Environment');
// displayFolder.add(world.scene.fog as THREE.Fog, 'near', 0, 1000).name('Fog Near');
// displayFolder.add(world.scene.fog as THREE.Fog, 'far', 1000, 50000).name('Fog Far');
displayFolder.addColor(world.scene, 'background').name('Background');
displayFolder.close();


// Hidden Inputs
const createInput = (id: string, accept: string, callback: (e: Event) => void) => {
  const input = document.createElement('input');
  input.type = 'file';
  input.id = id;
  input.accept = accept;
  input.style.display = 'none';
  input.addEventListener('change', callback);
  document.body.appendChild(input);
};

createInput('glbInput', '.glb,.gltf', loadGLB);
createInput('geojsonInput', '.json,.geojson', loadGeoJSON);


// --- FieldTwin Modal ---
const ftModal = document.createElement('div');
ftModal.style.position = 'fixed';
ftModal.style.top = '50%';
ftModal.style.left = '50%';
ftModal.style.transform = 'translate(-50%, -50%)';
ftModal.style.backgroundColor = '#1a1c1e'; // space-gray-dark
ftModal.style.padding = '20px';
ftModal.style.border = '1px solid #ff8c00'; // accent-orange
ftModal.style.borderRadius = '8px';
ftModal.style.zIndex = '1000';
ftModal.style.display = 'none';
ftModal.style.flexDirection = 'column';
ftModal.style.gap = '15px';
ftModal.style.width = '80%';
ftModal.style.maxWidth = '600px';
ftModal.style.maxHeight = '90vh';
ftModal.style.overflowY = 'auto';
ftModal.style.boxSizing = 'border-box';
ftModal.style.boxShadow = '0 20px 50px rgba(0,0,0,0.5)';

const ftLabel = document.createElement('label');
ftLabel.innerText = 'FieldTwin API cURL Command:';
ftLabel.style.color = '#ff8c00';
ftLabel.style.fontWeight = '600';
ftLabel.style.fontSize = '12px';
ftLabel.style.textTransform = 'uppercase';
ftLabel.style.letterSpacing = '1px';
ftModal.appendChild(ftLabel);

const ftTextarea = document.createElement('textarea');
ftTextarea.rows = 8;
ftTextarea.style.width = '100%';
ftTextarea.style.backgroundColor = '#111';
ftTextarea.style.color = '#ccc';
ftTextarea.style.border = '1px solid #333';
ftTextarea.style.padding = '10px';
ftTextarea.style.borderRadius = '4px';
ftTextarea.style.fontFamily = 'monospace';
ftTextarea.style.fontSize = '12px';
ftTextarea.style.outline = 'none';
ftTextarea.style.resize = 'vertical';
ftTextarea.style.boxSizing = 'border-box';
ftTextarea.placeholder = "curl 'https://...' -H 'authorization: Bearer ...'";
ftModal.appendChild(ftTextarea);

const ftButtons = document.createElement('div');
ftButtons.style.display = 'flex';
ftButtons.style.justifyContent = 'flex-end';
ftButtons.style.gap = '10px';

const ftCancel = document.createElement('button');
ftCancel.innerText = 'CANCEL';
ftCancel.className = 'ft-button-secondary';
ftCancel.onclick = () => { ftModal.style.display = 'none'; ftTextarea.value = ''; };

const ftLoad = document.createElement('button');
ftLoad.innerText = 'LOAD DATA';
ftLoad.className = 'ft-button-primary';
ftLoad.onclick = async () => {
  const cmd = ftTextarea.value;
  ftModal.style.display = 'none';
  ftTextarea.value = '';

  // Parse cURL
  // Extract URL (between single quotes after curl)
  const urlMatch = cmd.match(/curl\s+'([^']+)'/) || cmd.match(/curl\s+"([^"]+)"/);
  // Extract Token (Authorization header)
  const tokenMatch = cmd.match(/-H\s+['"]authorization:\s*Bearer\s+([^'"]+)['"]/i);

  if (urlMatch && tokenMatch) {
    let url = urlMatch[1];
    
    // Cleanup URL: only keep up to subProject/{id}
    const subProjectMatch = url.match(/(.*\/subProjects?\/[^/]+)/i);
    if (subProjectMatch) {
      url = subProjectMatch[1];
    }

    const token = tokenMatch[1];
    try {
      console.log(`Fetching FieldTwin Data...`);
      
      setLoader("Connecting to FieldTwin API...", 10);

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'simplify': "true",
          "sample-every": "1"
        }
      });

      if (!response.ok) throw new Error(`API Error: ${response.status}`);

      const json = await response.json();
    
      const group = await fieldTwinLoader.load(url, json, (msg, percent) => {
           setLoader(msg, percent);
      });

      console.log('FieldTwin Loader returned group:', group);
      console.log('Group children count:', group?.children?.length);
      if (group && group.children) {
        group.children.forEach((child, i) => {
          console.log(`  Child ${i}: ${child.name} (${child.type}) - ${child.children?.length || 0} sub-children`);
        });
      }

      if (group) {
        world.add(group);
        console.log('Group added to world.scene. Total scene children:', world.scene.children.length);
        fitCameraToObject(group);
        addLayerToGUI('FieldTwin Layer', group);
        console.log('Layer added to GUI.');
      } else {
        console.error('FieldTwin Loader returned null/undefined group!');
      }
    } catch (e) {
      console.error(e);
      alert('Failed to load FieldTwin data check console');
    } finally {
       hideLoader();
    }
  } else {
    alert('Could not parse cURL command. Ensure it has URL and Authorization header.');
  }
};

ftButtons.appendChild(ftCancel);
ftButtons.appendChild(ftLoad);
ftModal.appendChild(ftButtons);
document.body.appendChild(ftModal);

// --- Layer Management ---

function addLayerToGUI(name: string, object: THREE.Object3D) {
  const folder = layersFolder.addFolder(name);

  // Visibility toggle for the whole layer
  folder.add(object, 'visible').name('Show Layer').onChange(() => {
    world.requestRender();
  });

  // Remove button
  const layerControls = {
    remove: () => {
      world.scene.remove(object);
      folder.destroy();
    },
    fitCamera: () => {
      fitCameraToObject(object);
    },
    wireframe: false,
    lineSize: 1
  };
  folder.add(layerControls, 'fitCamera').name('Focus Camera');
  folder.add(layerControls, 'remove').name('Remove Layer');

  folder.add(layerControls, 'wireframe').name('Wireframe').onChange((val: boolean) => {
    object.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(m => {
            if ('wireframe' in m) {
              (m as any).wireframe = val;
              m.needsUpdate = true;
            }
          });
        } else {
          const m = mesh.material as THREE.Material;
          if ('wireframe' in m) {
            (m as any).wireframe = val;
            m.needsUpdate = true;
          }
        }
      }
    });
    world.requestRender();
  });

  folder.add(layerControls, 'lineSize', 1, 20).name('Line Size').onChange((val: number) => {
    object.traverse((child) => {
      // For Lines
      if ((child as THREE.Line).isLine) {
        const line = child as THREE.Line;
        const mat = line.material as THREE.LineBasicMaterial;
        mat.linewidth = val;
        mat.needsUpdate = true;
      }
      // For Meshes (Wireframe thickness)
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(m => {
            // @ts-ignore
            if (m.wireframeLinewidth !== undefined) m.wireframeLinewidth = val;
          });
        } else {
          // @ts-ignore
          if (mesh.material.wireframeLinewidth !== undefined) mesh.material.wireframeLinewidth = val;
        }
      }
    });
    world.requestRender();
  });


  // Sub-elements visibility
  // If it's a Group with children, we can add toggles for them.
  if (object.children.length > 0) {
    const childrenFolder = folder.addFolder('Elements');
    childrenFolder.close(); // Closed by default

    let count = 0;
    object.traverse((child) => {
      // Only add top-level children of the layer group to avoid deeply nested mess
      if (child.parent === object) {
        if (count < 50) { // Limit to 50 items to prevent UI lag
          const childName = child.name || `Element ${count + 1}`;
          childrenFolder.add(child, 'visible').name(childName).onChange(() => {
            world.requestRender();
          });
        }
        count++;
      }
    });

    if (count > 50) {
      childrenFolder.add({ msg: `+ ${count - 50} more items...` }, 'msg').name('Info');
    }
  }
}


// --- Load Handlers ---

async function loadGLB(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) processFile(file);
  (e.target as HTMLInputElement).value = ''; // Reset
}

async function loadGeoJSON(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) processFile(file);
  (e.target as HTMLInputElement).value = ''; // Reset
}

async function processFile(file: File) {
  const filename = file.name;
  const url = URL.createObjectURL(file);

  try {
    let object: THREE.Object3D | null = null;
    setLoader(`Loading ${filename}...`, 20);

    if (filename.toLowerCase().endsWith('.glb') || filename.toLowerCase().endsWith('.gltf')) {
      object = await gltfLoader.load(url);
      setLoader(`Processing ${filename}...`, 80);
      console.log('Loaded GLB:', filename);
    }
    else if (filename.toLowerCase().endsWith('.json') || filename.endsWith('.geojson')) {
      // Read text for GeoJSON
      const text = await file.text();
      const json = JSON.parse(text);
      setLoader(`Parsing ${filename}...`, 50);
      object = geoJsonLoader.parse(json);
      setLoader(`Generating Geometry...`, 80);
      console.log('Loaded GeoJSON:', filename);
    } else {
      console.warn('Unknown file type:', filename);
      alert('Unknown file type: ' + filename);
      hideLoader();
      return;
    }

    if (object) {
      object.name = filename; // Set name for the layer
      world.add(object);
      fitCameraToObject(object);
      addLayerToGUI(filename, object);
    }

  } catch (err) {
    console.error('Error processing file:', err);
    alert('Error loading file: ' + filename);
  } finally {
    hideLoader();
  }
}


function fitCameraToObject(object: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(object);
  if (!box.isEmpty()) {
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    // If it's the first object or ground, maybe we want to look at it from top
    // With MapControls, usually we look at target.

    const camPos = new THREE.Vector3(center.x, center.y + maxDim, center.z + maxDim);
    world.setView(camPos, center, true);
  }
}

// --- Drag and Drop ---

document.body.addEventListener('dragover', (e) => {
  e.preventDefault();
  document.body.style.opacity = '0.8';
});

document.body.addEventListener('dragleave', (e) => {
  e.preventDefault();
  document.body.style.opacity = '1';
});

document.body.addEventListener('drop', (e) => {
  e.preventDefault();
  document.body.style.opacity = '1';

  if (e.dataTransfer?.files) {
    // Handle multiple files
    Array.from(e.dataTransfer.files).forEach(file => {
      processFile(file);
    });
  }
});
