🧭 Feature: Route Drawing on Map with Smart Pathfinding
🎯 Goal
Allow users to draw a route on a Swisstopo-based map by clicking on points. The route automatically follows existing paths (trails, roads, etc.) using official Swiss WMTS services. All pathfinding is computed client-side, with only the final GPX sent to the backend.
🧱 Technical Architecture
🖥️ Frontend (React + Leaflet)

Overlays hiking paths using ch.swisstopo.swisstlm3d-wanderwege WMTS layer
User interaction:
- Click to add waypoints on the map
- Auto-route between waypoints using simple pathfinding algorithm
- Real-time route display as user adds points
- Undo last point option
Computes routes entirely client-side:
- Snaps points to nearest path segments from WMTS vector data
- Simple pathfinding algorithm (A* or similar) between waypoints
- Displays the computed route in real-time
- Generates final GPX with route points only (no elevation data initially)

- Sends only the GPX to backend via the existing api endpoint

Modify the existing add trail popup. Not only the gpx file upload option must be available but also the draw option.

Performance limits (configurable):
- Maximum waypoints: 50
- Maximum route distance: 100km
- Tile loading area limit for pathfinding

🧠 Backend (Go)

Nothing to change

🌐 WMTS Data Integration

Vector paths: https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swisstlm3d-strassen/default/current/3857/{z}/{x}/{y}.pbf
- Contains both hiking trails and roads for comprehensive routing
- Client-side tile loading: Frontend requests only tiles needed for actual view bounds
- PBF tile parsing for vector path data

Fallback behavior: Straight line if no path found or calculation area exceeded

## 🚀 Development Status & Roadmap

### ✅ **COMPLETED (Phase 1 - MVP)**

#### Core Infrastructure
- ✅ Added PBF parsing dependencies (`pbf`, `@types/pbf`)
- ✅ Created GPX generation utility (`/utils/gpxGenerator.ts`)
- ✅ Built pathfinding framework (`/utils/pathfinding.ts`)
- ✅ Configurable performance limits (easily adjustable)

#### User Interface
- ✅ Modified UploadPanel with upload method selection (File vs Draw)
- ✅ Created interactive RouteDrawer component
- ✅ Real-time route visualization with distance calculation
- ✅ Undo last waypoint functionality
- ✅ Route completion validation

#### Map Integration
- ✅ WMTS hiking paths overlay (shows during drawing mode)
- ✅ Click-to-add waypoints system
- ✅ Real-time route preview
- ✅ Seamless integration with existing Map component

#### Backend Integration
- ✅ GPX generation from drawn routes
- ✅ Integration with existing PocketBase API
- ✅ Trail creation workflow (drawn → GPX → backend)

### 🔄 **CURRENT LIMITATIONS (Mock Implementation)**
- ⚠️ **Path snapping**: Currently uses mock path data (not real WMTS vector data)
- ⚠️ **Pathfinding**: Simple point-to-point routing (not following actual trails)
- ⚠️ **PBF parsing**: Framework ready but needs proper vector tile decoding

### 🎯 **TODO (Phase 2 - Production Ready)**

#### High Priority
- [ ] **Implement proper PBF vector tile parsing**
  - Parse actual Swiss WMTS vector data from `.pbf` tiles
  - Extract real hiking trails and road networks
  - Build proper path network graph

- [ ] **Advanced pathfinding algorithm**
  - Implement A* or Dijkstra's algorithm
  - Use actual path network for routing
  - Proper snapping to nearest trail segments

- [ ] **Path network optimization**
  - Efficient spatial indexing for large datasets
  - Path segment caching and management
  - Performance optimization for real-time routing

#### Medium Priority
- [ ] **Enhanced user experience**
  - Show trail difficulty/type during drawing
  - Preview elevation profile for drawn routes
  - Better visual feedback for path snapping

- [ ] **Advanced features**
  - Route optimization (shortest vs most scenic)
  - Avoid certain trail types or difficulties
  - Import/export route variations

#### Low Priority
- [ ] **Performance improvements**
  - Web Workers for heavy pathfinding calculations
  - Progressive tile loading strategies
  - Route caching for popular segments

### 🔧 **Configuration Files**
All limits easily adjustable in `pathfinding.ts:PATHFINDING_CONFIG`:
```typescript
MAX_WAYPOINTS: 50           // Maximum points per route
MAX_ROUTE_DISTANCE_KM: 100  // Maximum route length
SNAP_DISTANCE_METERS: 100   // Point snapping tolerance
TILE_BUFFER_SIZE: 2         // Path data loading buffer
```

### 📝 **Notes for Fine-tuning**
- Current implementation provides full UI/UX workflow
- Mock pathfinding allows immediate testing and UI refinement
- PBF parsing framework ready for production data integration
- All performance limits configurable for easy optimization

### 🐛 **Known Issues & Workarounds**

#### Duplicate Waypoint Issue
**Issue**: Map click events are firing when the route drawer or on of its button is clicked, causing the addition of an unwanted waypoint.

**Root Cause**: Unknown

**Current Workaround**: 
- Undo button removes 2 waypoints instead of 1 to compensate for duplicates
- Implementation: `const waypointsToRemove = Math.min(2, prev.length);`
- Located in: `RouteDrawer.tsx:handleUndo()`

**Status**: Functional workaround implemented. Root cause investigation deferred to Phase 2.

**Future Resolution**: 
- Investigate React StrictMode impact
- Review Leaflet event handler registration
- Consider alternative map interaction libraries
