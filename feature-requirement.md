🧭 Feature: Route Drawing on Map with Smart Pathfinding
🎯 Goal
Allow users to draw a route on a Swisstopo-based map by clicking on points. The route automatically follows existing paths (trails, roads, etc.) using official Swiss WMTS services. All pathfinding is computed client-side, with only the final GPX sent to the backend.

User interaction:
- Click to add waypoints on the map
- Auto-route between waypoints using simple pathfinding algorithm
- Real-time route display as user adds points
- Undo last point option
Computes routes entirely server side using Brouter:
- https://github.com/abrensch/brouter/blob/master/README.md
- Route processing api endpoint: https://github.com/abrensch/brouter/blob/master/brouter-server/src/main/java/btools/server/request/ServerHandler.java


## 🚀 Development Status & Roadmap

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
