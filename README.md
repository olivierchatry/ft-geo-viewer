# 3D Geo Viewer

A high-performance web-based 3D viewer designed for offshore and subsea engineering data. This tool allows users to visualize complex geospatial datasets, including FieldTwin projects, GeoJSON files, and high-fidelity 3D models.

## Key Features

### 🌐 FieldTwin Integration
- **Direct API Loading**: Import entire subprojects directly using the FieldTwin API.
- **Resource Support**: Renders Connections, Wells, Shapes, and Staged Assets.
- **Equipment Visualization**: Automatically fetches and positions 3D models for staged assets using `model3durl` and `initialState` metadata.
- **XVB Terrain**: High-performance loading of FieldTwin XVB bathymetry files with organic, tile-free procedural seabed textures.

### 🗺️ Geospatial Data Support
- **GeoJSON**: Full support for Polygons, MultiPolygons, LineStrings, and MultiLineStrings.
- **Coordinate Precision**: Implements a dynamic **Origin Management** system. This shifts the 3D world to a local origin, allowing for millimeter-level precision even when working with massive UTM/Global coordinates (millions of meters).
- **Coordinate Display**: Real-time HUD showing World Coordinates (Easting, Northing, Height) based on mouse intersection.

### 📦 3D Model Loading
- **GLB/GLTF Support**: Load standalone models via file picker or drag-and-drop.
- **Draco Compression**: Full support for compressed GLB files via `DRACOLoader`.
- **Intelligent Caching**: Duplicate assets (e.g., many identical valves in a field) are downloaded once and efficiently cloned in memory.

### ⚡ Performance & Interaction
- **BVH Acceleration**: Uses `three-mesh-bvh` for spatial indexing. This makes raycasting and mouse interaction nearly instantaneous, even on massive terrain meshes or complex equipment.
- **Layer Management**: intuitive UI to toggle visibility, focus the camera, or remove specific datasets and individual sub-elements.
- **Camera Controls**: Map-style navigation with damping and smooth zooming.

## Getting Started

### Prerequisites
- Node.js (v18+)
- npm

### Setup
1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open your browser to the local URL (usually `http://localhost:5173`).

## Loading Data from FieldTwin

To visualize a project from FieldTwin Designer:

1.  Open your project in **FieldTwin Designer**.
2.  Ensure no specific item is selected (click on the empty background).
3.  In the top toolbar, click the **Tools** icon (represented by a wrench or extra options menu).
4.  Select **"Copy cUrl FieldTwin API command to clipboard"**.
5.  In the 3D Geo Viewer, click **"Load from FieldTwin API"**.
6.  Paste the cURL command into the modal and click **Load**.

## Keyboard & Mouse Shortcuts
- **W/A/S/D / Arrows**: Move the camera.
- **Left Mouse Click + Drag**: Pan the view.
- **Right Mouse Click + Drag / Shift + Drag**: Rotate the camera.
- **Scroll Wheel**: Zoom in/out.
- **ESC**: Exit control mode or close modals.

## Technical Details
This project is built with:
- [Three.js](https://threejs.org/) for the 3D engine.
- [Vite](https://vitejs.dev/) for ultra-fast development and bundling.
- [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) for spatial acceleration.
- [lil-gui](https://github.com/georgealways/lil-gui) for the lightweight control interface.
