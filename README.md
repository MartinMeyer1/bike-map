# 🤘 BikeMap

A lightweight social web app for sharing MTB singletracks among friends. Built with React frontend and PocketBase backend, featuring client-side GPX processing and Swiss topographic maps.

## ✅ Features

### 🔐 Authentication
- ✅ Google OAuth 2.0 authentication (primary)
- ✅ Role-based permissions (Viewer, Editor, Admin)
- ✅ Session management using PocketBase JWT (localStorage)
- ✅ User authentication state management
- ✅ Automatic admin account creation via environment variables

### 📤 GPX Upload
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
- **CORS enabled**: For frontend integration
- **Environment-based configuration**: Admin accounts and OAuth credentials

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
│   ├── main.go             # Main application with OAuth & permissions
│   ├── Dockerfile          # Multi-stage Go build
│   └── pb_data/            # PocketBase data (gitignored)
├── frontend/               # React TypeScript frontend
│   ├── src/
│   │   ├── components/     # React components (Map, Auth, etc.)
│   │   ├── services/       # PocketBase API client & trail cache
│   │   └── types/          # TypeScript definitions
│   ├── Dockerfile          # Multi-stage Node build
│   └── nginx.conf          # Production nginx config
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

## ✨ Future Enhancements
- [ ] Trail editing and deletion for owners
- [ ] Advanced trail filtering and search
- [ ] Trail details page with elevation profile
- [ ] User comments and ratings
- [ ] GPX route drawing tool
- [ ] Private trails and sharing controls
- [ ] User groups and invites
