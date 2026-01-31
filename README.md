# 3D Geo Viewer

[![Deploy to GitHub Pages](https://github.com/olivierchatry/ft-geo-viewer/actions/workflows/deploy.yml/badge.svg)](https://github.com/olivierchatry/ft-geo-viewer/actions/workflows/deploy.yml)

Live Demo: [https://olivierchatry.github.io/ft-geo-viewer/](https://olivierchatry.github.io/ft-geo-viewer/)

A high-performance web-based 3D viewer designed for offshore and subsea engineering data. This tool allows users to visualize complex geospatial datasets, including FieldTwin projects, GeoJSON files, and high-fidelity 3D models.

## Supported Data Types

- **FieldTwin API**: Connect directly to load full subprojects including:
  - Staged Assets (with associated 3D models)
  - Wells & Trajectories
  - Connections (Pipelines, Cables)
  - Shapes (Zones, Corridors)
  - XVB Terrain visualization
- **GeoJSON**: Import geospatial vectors (Polygons, Lines).
- **3D Models**: Drag-and-drop .glb/.gltf files (Draco compression supported).

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
