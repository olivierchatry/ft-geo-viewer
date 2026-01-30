# Copilot Instructions for FieldTwin Integrations

You are an AI assistant helping to develop an integration for **FieldTwin**. An integration is a web application embedded in FieldTwin via an iFrame.

## Architecture

FieldTwin communicates with integrations using `window.postMessage`.
- **Host -> Integration**: FieldTwin sends events (like `select`, `loaded`, `operationSearch`) to the integration iFrame.
- **Integration -> Host**: The integration sends requests (like `selectByTag`, `operationSearchResults`, `toast`) to the parent window.

FieldTwin identifies each integration via its `customTabId` (provided in the `loaded` event). All messages sent from the integration are automatically tagged with this ID by the host, which is used to group search results, manage progress indicators, and isolate visual filters.

## Core Events (Host -> Integration)

### loaded
Sent when the integration is initialized. Contains tokens, project IDs, and user info.
```javascript
{
  event: 'loaded',
  token: 'JWT_TOKEN',
  subProject: 'SUBPROJECT_ID',
  backendUrl: '...',
  canEdit: true,
  APIServerIsReady: true,
  customTabId: 'UNIQUE_INTEGRATION_ID',
  selection: [{ type: 'stagedAsset', id: '...' }]
}
```

### select
Sent whenever the user selects items in the 3D view.
```javascript
{
  event: 'select',
  data: [{ type: 'stagedAsset', id: '...', name: '...' }],
  cursorPosition: { x, y, z }
}
```

### operationSearch
Sent when the user presses **Enter** in the global search bar (FieldTwin Operation).
```javascript
{
  event: 'operationSearch',
  query: 'search-string'
}
```

### operationSearchProgress
Sent by the integration to update the host on search progress. Note: If no update is received for 30 seconds, the progress indicator will be automatically hidden.
```javascript
{
  event: 'operationSearchProgress',
  data: {
    status: 'Searching assets...',
    progress: 45, // Optional, 0-100
    isComplete: false // Set to true to hide the progress indicator
  }
}
```

## Common Requests (Integration -> Host)

Integrations send messages to `window.parent`:
```javascript
window.parent.postMessage(payload, '*');
```

### operationSearchResults
Reply to `operationSearch`. Supports hierarchical results and icons.
```javascript
{
  event: 'operationSearchResults',
  data: {
    results: [
      {
        category: 'My Category', // Foldable in the UI
        id: 'item-1',             // Required for sub-item state persistence
        html: '<b>Parent Item</b>',
        action: 'myAction',       // Optional: event sent back on click
        args: { id: 1 },          // Optional: data passed to action
        subItems: [               // Optional: nested items
          {
            id: 'sub-1',          // Optional unique ID
            html: 'Sub Asset A',
            icon: 'cube',         // 'file', 'cube', or 'circle' (default)
            action: 'focusSub',
            args: { id: 'a' }
          }
        ]
      }
    ]
  }
}
```

### visualFilteringUpdate
Send available visual filters to be displayed as buttons next to the search bar in Operation mode.
Filters are grouped by integration, sorted by integration ID, and styled as toggleable chips.
```javascript
{
  event: 'visualFilteringUpdate',
  data: {
    filters: [
      {
        id: 'annotation',
        label: 'Annotation',
        state: false,
        subFilters: [ // Optional: turns the button into a popup menu
          { id: 'danger', label: 'Danger', state: false },
          { id: 'warning', label: 'Warning', state: false }
        ]
      }
    ]
  }
}
```

### visualFilterToggle
Received by the integration when a user clicks a filter button or a sub-filter checkbox.
```javascript
{
  event: 'visualFilterToggle',
  data: {
    id: 'annotation',
    state: true,
    subFilterId: 'danger' // Present if a sub-filter was toggled
  }
}
```

### selectByTag
Select items in FieldTwin by their tags.
```javascript
{
  event: 'selectByTag',
  tags: ['tag1', 'tag2']
}
```

### toast
Show a notification in the main UI.
```javascript
{
  event: 'toast',
  data: {
    type: 'success', // 'success', 'info', 'warning', 'error'
    message: 'Hello World'
  }
}
```

### getResources / getVisibleResources / getResourcesByTags
Query resources from the graph.
- **getResources**: returns full resource attributes for specific IDs.
- **getVisibleResources**: returns resources currently visible in the 3D viewport.
- **getResourcesByTags**: returns resources matching specific tag paths.
```javascript
{
  event: 'getResourcesByTags',
  data: {
    tags: ['status::active', 'sector::A'],
    resourceTypes: ['stagedAsset'],
    queryId: 'optional-correlation-id'
  }
}
```

### Tag Annotations
Display status information or visual labels next to resources in the 3D viewport based on their tags.
```javascript
{
  event: 'updateTagsAnnotation',
  data: {
    annotations: [
      {
        pattern: 'status::alert',
        color: '#ff0000',
        text: 'Action Required',
        icon: 'warning'
      }
    ]
  }
}

// Clear annotations
{
  event: 'clearTagsAnnotation'
}
```

### displayDocument
Open a document in the host's file viewer.
```javascript
{
  event: 'displayDocument',
  data: {
    id: 'DOCUMENT_ID',
    revisionId: 'REVISION_ID'
  }
}
```

### getProjectData
Retrieve raw project configuration, metadata definitions, and CRS.
```javascript
{
  event: 'getProjectData'
}
```

### computeCostUsingServer
Trigger a cost calculation on the backend for the current project.
```javascript
{
  event: 'computeCostUsingServer'
}
```

### zoomAt / zoomOn
Control the camera.
```javascript
// zoomAt: focus on specific coordinates
{
  event: 'zoomAt',
  data: { x: 665000, y: 400000, z: 100 }
}

// zoomOn: focus on specific resources
{
  event: 'zoomOn',
  data: {
    resourceIds: ['ID1', 'ID2'],
    resourceTypes: ['stagedAsset']
  }
}
```

### Resource Management (CRUD)
FieldTwin allows integrations to manipulate project resources (staged assets, wells, connections, etc.). These messages can be sent individually (`createResource`) or in batch (`createResources`).

#### createResource / createResources
Creates new resources in the current subproject.
- **Attributes**: Properties for the resource (e.g., `x`, `y`, `z`, `name`).
- **Volatile**: If `true`, the resource is temporary and NOT saved to the database.
- **Draggable**: If `true`, users can drag the resource in the 3D scene.
```javascript
{
  event: 'createResources',
  data: [
    {
      resourceType: 'stagedAsset',
      attributes: {
        name: 'New Asset',
        x: 665000,
        y: 400000,
        z: 0,
        stagedAssetSymbolId: '...'
      },
      volatile: false,
      draggable: true,
      projectTreeViewCustomPath: ['My Integration', 'Assets']
    }
  ]
}
```

#### updateResource / updateResources
Updates existing resources.
- **resourceId**: The UUID of the resource to update.
- **attributes**: Object containing only the properties to change.
```javascript
{
  event: 'updateResources',
  data: [
    {
      resourceType: 'stagedAsset',
      resourceId: 'UUID-123',
      attributes: {
        name: 'Updated Name',
        z: 10
      }
    }
  ]
}
```

#### deleteResource / deleteResources
Removes resources from the project.
```javascript
{
  event: 'deleteResources',
  data: [
    {
      resourceType: 'stagedAsset',
      resourceId: 'UUID-123'
    }
  ]
}
```

### createChart / deleteChart
Display Chart.js billboards in the 3D scene.
```javascript
{
  event: 'createChart',
  data: {
    id: 'my-chart-id',
    type: 'bar',
    title: 'Sensor Data',
    datasets: [{ label: 'Temp', data: [10, 20, 30] }],
    labels: ['Jan', 'Feb', 'Mar'],
    position: { x: 100, y: 200, z: 0 }
  }
}
```

### Create / Update Resource Attributes

When using `createResources` or `updateResources`, the `attributes` object varies by resource type. Below are the most common attributes for core types:

#### Common Attributes (All Types)
- `name`: (String) Display name of the resource.
- `description`: (String) Text description.
- `tags`: (Array<String>) Custom tags for filtering/grouping.
- `visible`: (Boolean) Visibility in the 3D scene.
- `isInactive`: (Boolean) Whether the resource is considered "active" in calculations or operations.

#### StagedAsset (Equipment/Assets)
- `initialState`: (Object) Contains spatial data.
    - `x`, `y`, `z`: (Number) Global coordinates.
    - `rotation`: (Number) Heading/rotation in degrees.
- `status`: (String) Operational status (e.g., "Planned", "Installed").
- `vendorAttributes`: (Object) Custom data specific to the asset type.
- `operatorTags`, `supplierTags`: (Array<String>) Specialized tag arrays.

#### Well
- `x`, `y`: (Number) Global coordinates (Wells are often vertical, so `z` is derived).
- `radius`: (Number) Visual radius of the wellhead.
- `color`: (String) Hex color (e.g., "#FF0000").
- `kind`: (String) Relationship ID to a `WellType`.

#### Connection (Pipelines/Cables)
- `fromCoordinate`, `toCoordinate`: (Object) `{ x, y, z }` defining start and end.
- `intermediaryPoints`: (Array<Object>) Points between start/end: `[{ x, y, z, added: true }]`.
- `params`: (Object) Visual parameters, e.g., `{ width: 5 }`.
- `status`: (String) Operational status.

#### Shape (Zones/Areas)
- `x`, `y`, `z`: (Number) Anchor position.
- `rotation`: (Object) `{ x, y, z }` rotation in radians.
- `scale`: (Number) Uniform scale factor.
- `color`: (String) Hex color.
- `shapeType`: (String) One of: `Sphere`, `Box`, `Line`, `Polygon`, `Cylinder`.
- `linePoints`: (Array<Object>) For `Line` or `Polygon` types.

#### Overlay (Labels/Annotations)
- `x`, `y`, `z`: (Number) Coordinate position.
- `text`: (String) Content of the overlay.
- `width`, `height`: (Number) Dimensions of the overlay box.

---

### exportToGLTF / exportToGeoJSON
Trigger data exports. `exportToGLTF` returns a `Blob`.
```javascript
{
  event: 'exportToGLTF'
}
```

### updateTagStyles
Apply dynamic styling (colors/icons) to tags in the File Viewer or 3D view.
```javascript
{
  event: 'updateTagStyles',
  data: {
    tagStyles: [
      { pattern: 'status::active', color: '#00ff00' },
      { pattern: 'type::valve', icon: 'valve-icon.svg' }
    ]
  }
}
```

### clearSelection
Clear current selection in the host.
```javascript
{
  event: 'clearSelection'
}
```

## Security & API Access

- Use the `token` from the `loaded` event in the `Authorization: Bearer <token>` header for API requests.
- The `backendUrl` is the base for API calls.
- Typical API flow: `fetch(`${backendUrl}/api/v1/subProjects/${subProjectId}/stagedAssets`, { ... })`.

## API Reference

The FieldTwin API follows the OpenAPI 3.0 specification. You can find the full schema here:
- **OpenAPI 3.0 JSON**: [https://api-qa.fieldtwin.com/oas3.json](https://api-qa.fieldtwin.com/oas3.json)
- **Online Documentation**: [https://api.fieldtwin.com](https://api.fieldtwin.com)

## Guidelines

1. Always check `event.data.event` in your message listener.
2. Use `APIServerIsReady` from the `loaded` event or `apiPodIsReady` event before calling the API.
3. Keep the UI consistent with FieldTwin styles by using the `cssUrl` provided in the `loaded` event.
