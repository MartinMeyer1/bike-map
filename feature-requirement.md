🧭 Feature: Route Drawing on Map with Smart Pathfinding
🎯 Goal
Allow users to draw a route on a Swisstopo-based map by clicking on points. The route automatically follows existing paths (trails, roads, etc.) using official Swiss WMTS services. All pathfinding is computed client-side, with only the final GPX sent to the backend.

User interaction:
- Click to add waypoints on the map
- Real-time route display as user adds points
- Undo last point option
Computes routes entirely server side using Brouter:
- https://github.com/abrensch/brouter/blob/master/README.md
- Route processing api endpoint: https://github.com/abrensch/brouter/blob/master/brouter-server/src/main/java/btools/server/request/ServerHandler.java


## 🚀 Development Status & Roadmap

### ✅ **CURRENT IMPLEMENTATION**
- ✅ **Waypoint Management**: Click-to-add waypoints with visual feedback
- ✅ **BRouter Integration**: Routes computed by BRouter server with incremental segment calculation
- ✅ **Route Caching**: Existing routes load from cached GPX data without BRouter calls
- ✅ **Elevation Data**: Denivellation (D+/D-) calculation and display from BRouter elevation data
- ✅ **Distance Display**: Real-time distance calculation shown in RouteDrawer panel
- ✅ **GPX Generation**: Proper GPX export with waypoints and detailed route tracks

- BRouter is running at https://localhost:17777


### 📝 **Implementation Notes**
- Incremental routing: Only calculates route segments between adjacent waypoints for optimal performance
- Route segment caching: Splits cached routes back into individual segments for proper editing
- Proper waypoint vs route point separation: GPX stores original waypoints as `<wpt>` elements and computed route as `<trkpt>` elements


## PocketBase ForwardAuth Middleware - Technical Spec
Objective
Protect an existing web service (Brouter) using PocketBase authentication via Traefik ForwardAuth middleware. Only users with "Editor" or "Admin" roles should have access.

Requirements
PocketBase Extension

Endpoint: GET /api/auth/validate
Input: Authorization: Bearer <token> header
Logic:

Validate JWT token
Check user role is "Editor" or "Admin"


Output:

200 OK if authorized
401 Unauthorized if not authorized or invalid token



Traefik Configuration

Configure ForwardAuth middleware pointing to PocketBase validation endpoint
Forward Authorization header to validation endpoint
Block requests on 401 response, allow on 200 response

Protected Service

No code changes required
Receives only authenticated requests with valid roles

User Flow

Request → Traefik
Traefik → PocketBase validation endpoint
PocketBase validates token + role
If "Editor"/"Admin": Allow request to service
If other role/invalid: Return 401

Acceptance Criteria

✅ Editor/Admin users can access service
✅ Other roles get 401 Unauthorized
✅ Invalid/missing tokens get 401
✅ No changes needed to existing service
✅ All auth handled at infrastructure level