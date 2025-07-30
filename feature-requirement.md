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

### 🔄 **CURRENT IMPLEMENTATION**
- ✅ **Waypoint Management**: Click-to-add waypoints with visual feedback
- ✅ **Client-side UI**: Real-time waypoint visualization with temporary straight-line preview
- 🔄 **Server-side Routing**: Routes computed by BRouter server (external routing service)

### 🎯 **TODO (Phase 2 - Production Ready)**

#### High Priority
- [ ] **BRouter Server Integration**
  - Implement server-side routing requests to BRouter API
  - Handle waypoint-to-lonlats conversion for BRouter format
  - Process returned GPX from BRouter server
  - Add error handling for routing failures

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
Waypoint limits in `pathfinding.ts:PATHFINDING_CONFIG`:
```typescript
MAX_WAYPOINTS: 50           // Maximum waypoints per route
```

### 📝 **Notes for Implementation**
- Current implementation provides complete waypoint management UI/UX
- Straight-line preview allows immediate visual feedback during route drawing
- Server-side routing via BRouter ensures accurate trail following
- Waypoint limits easily configurable for performance optimization
