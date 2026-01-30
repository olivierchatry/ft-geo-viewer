# 3D Geo Viewer

A tool to load GLTF/GLB models and GeoJSON files with support for large coordinates, visualized in a 3D environment with FPS controls.

## Features

- **Load GLB**: Supports drag-and-drop or file selection for GLB/GLTF models.
- **Load GeoJSON**: Supports GeoJSON Polygons and MultiPolygons. auto-centers the geometry to handle large coordinate values (UTM, etc.) to avoid floating point precision issues.
- **FPS Controls**: Navigate the scene using WASD and Mouse (after clicking "Click to Control").

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run development server:
   ```bash
   npm run dev
   ```

3. Open the link (usually http://localhost:5173).

## Usage

1. Use the UI on the top-left to select files.
2. Load a GeoJSON file first to set the world center (recommended if using huge coordinates).
3. Load GLB files.
4. Click "Click to Control" to enter navigation mode.
    - **W/A/S/D**: Move
    - **Mouse**: Look around
    - **ESC**: Exit navigation mode
