# 🤘 BikeMap

A lightweight social web app for sharing MTB singletracks among friends. Built with React frontend and PocketBase backend, featuring client-side GPX processing and Swiss topographic maps.

## ✅ Features

### 🔐 Authentication
- ✅ Google OAuth 2.0 authentication (primary)
- ✅ Role-based permissions (Viewer, Editor, Admin)
- ✅ Session management using PocketBase JWT (localStorage)
- ✅ User authentication state management
- ✅ Automatic admin account creation via environment variables

### 📤 Trails management
- ✅ Upload `.gpx` file via form (Editor/Admin role required)
- ✅ Input fields:
  - ✅ Trail name
  - ✅ Difficulty rating (S0–S5) with color coding
  - ✅ Tags (Flow, Tech, Steep, etc.)
  - ✅ Description
- ✅ Save to PocketBase:
  - ✅ GPX file storage with automatic URL generation
  - ✅ Metadata in `trails` collection
  - ✅ Linked to authenticated user via `owner`
  - ✅ Permission-based access control
- ✅ Trail editing and deletion

### 🗺️ Interactive Map
- ✅ Leaflet integration with Swisstopo WMTS layer
- ✅ Load and display all stored trails
- ✅ Client-side GPX processing with leaflet-gpx
- ✅ Colored tracks by difficulty level (S0-Green → S5-Black)
- ✅ Trail popups with:
  - ✅ Trail name and description
  - ✅ Difficulty level with color coding
  - ✅ Tags display
  - ✅ Elevation gain/loss (D+, D-)
  - ✅ Start/end markers

### 🧭 Route Drawing & Navigation
- ✅ Interactive route drawing by clicking waypoints on the map
- ✅ Real-time pathfinding using BRouter engine
- ✅ Smart route calculation following existing paths (trails, roads, etc.)
- ✅ Incremental routing for optimal performance
- ✅ Elevation profile with denivellation (D+/D-) calculation
- ✅ Distance tracking and display
- ✅ GPX export with waypoints and detailed route tracks
- ✅ Route caching for improved performance
- ✅ Undo/redo waypoint functionality

### 📚 Trail Sidebar
- ✅ List of all trails with metadata
- ✅ Authentication status indicator with Google OAuth
- ✅ Add trail button (Editor/Admin roles only)
- ✅ Difficulty level legend
- ✅ Trail click to focus on map
- ✅ Performance-optimized trail caching and spatial filtering

## 🏗️ Architecture

### Backend (PocketBase + Go)
- **PocketBase**: Modern backend-as-a-service with SQLite database
- **Custom Go wrapper**: Collection management and authentication hooks
- **Google OAuth 2.0**: Secure authentication with role-based permissions
- **Role system**: Viewer (read-only), Editor (can upload), Admin (full access)
- **File storage**: GPX files with automatic URL generation and validation
- **ForwardAuth Middleware**: Traefik-compatible authentication for BRouter
- **CORS enabled**: For frontend integration
- **Environment-based configuration**: Admin accounts and OAuth credentials

### Routing Engine (BRouter)
- **BRouter**: High-performance Java-based routing engine
- **Swiss routing data**: Optimized for Swiss terrain and trails
- **Multiple routing profiles**: Configurable for different bike types and preferences  
- **Traefik integration**: Protected by ForwardAuth middleware requiring Editor/Admin roles
- **Docker containerized**: Easy deployment and scaling
- **API-based**: RESTful interface for route calculations

### Frontend (React + TypeScript)
- **React 18**: Modern component-based UI
- **TypeScript**: Type-safe development
- **Leaflet**: Interactive mapping with Swiss topographic tiles
- **Client-side GPX**: Real-time trail processing with elevation data
- **Trail caching**: Performance-optimized data management
- **Spatial filtering**: Efficient map bounds-based trail loading
- **Responsive design**: Full-screen map with overlay panels

## 🔧 Configuration

### Environment Variables

#### Development
- `VITE_POCKETBASE_URL`: Backend URL (default: http://localhost:8090)

#### Production
- `BASE_DOMAIN`: Your domain (e.g., bike-map.ch)
- `ACME_EMAIL`: Email for Let's Encrypt SSL certificates
- `GOOGLE_CLIENT_ID`: Google OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret
- `ADMIN_EMAIL`: Default admin account email
- `ADMIN_PASSWORD`: Default admin account password
- `VITE_API_BASE_URL`: Production API base URL

### File Structure
```
bike-map/
├── backend/                 # PocketBase + Go backend
│   ├── main.go             # Main application with OAuth & ForwardAuth
│   ├── Dockerfile          # Multi-stage Go build
│   └── pb_data/            # PocketBase data (gitignored)
├── frontend/               # React TypeScript frontend
│   ├── src/
│   │   ├── components/     # React components (Map, Auth, RouteDrawer, etc.)
│   │   ├── services/       # PocketBase API client & trail cache
│   │   ├── utils/          # GPX generation and pathfinding utilities
│   │   └── types/          # TypeScript definitions
│   ├── Dockerfile          # Multi-stage Node build
│   └── nginx.conf          # Production nginx config
├── routing-server/         # BRouter routing engine
│   ├── brouter/            # BRouter source code and Docker setup
│   ├── segments/           # Swiss routing data (E5_N45.rd5)
│   └── README.md          # BRouter setup and configuration guide
├── scripts/                # Build and deployment scripts
│   ├── build.sh           # Production build script
│   └── deploy.sh          # VPS deployment script
├── docker-compose.yml      # Production orchestration with Traefik
├── .env.production.example # Production environment template
└── DEPLOYMENT.md          # Production deployment guide
```

## 🎨 Difficulty Color Scheme
- **S0**: Green - Easy flow trails
- **S1**: Blue - Beginner technical features  
- **S2**: Orange - Intermediate challenges
- **S3**: Red - Advanced technical terrain
- **S4**: Purple - Expert-level obstacles
- **S5**: Black - Extreme technical difficulty

## 🚀 Production Deployment

BikeMap is production-ready with automated deployment:

```bash
# Build for production
./scripts/build.sh

# Deploy to VPS
./scripts/deploy.sh
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions.

## 🛠️ Service Architecture

### Production Deployment
BikeMap uses a subdomain-based architecture with Traefik as reverse proxy:

- **Main App**: `https://bike-map.ch` - React frontend
- **API**: `https://bike-map.ch/api/*` - PocketBase backend API
- **Admin Panel**: `https://admin.bike-map.ch` - PocketBase admin interface  
- **Routing Service**: `https://routing.bike-map.ch` - BRouter API
- **Proxy Dashboard**: `https://proxy.bike-map.ch` - Traefik dashboard

### Security & Authentication
- **Google OAuth 2.0**: Primary authentication method
- **Role-based access**: Viewer (read-only), Editor (can upload/route), Admin (full access)
- **ForwardAuth middleware**: Protects BRouter service using PocketBase JWT validation
- **SSL/HTTPS**: Automatic Let's Encrypt certificates via Traefik
