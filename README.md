# 🤘 BikeMap

A social web application for sharing MTB trails among friends. Built with React, PocketBase, and BRouter for optimal performance and user experience.

## Features

**Trail Management**
- GPX file upload with metadata (name, difficulty S0-S5, tags, description)
- Role-based access control (Viewer, Editor, Admin)
- Trail editing and deletion capabilities

**Interactive Mapping**
- Swiss topographic maps (Swisstopo WMTS)
- Real-time route drawing with BRouter pathfinding
- Elevation profiles and distance tracking
- GPX export functionality
- Difficulty-based color coding

**Authentication & Security**
- Google OAuth 2.0 integration
- JWT session management
- ForwardAuth middleware for service protection
- CORS enabled for cross-origin requests (configurable for production)

## Architecture

**Backend (PocketBase + Go)**
- SQLite database with PocketBase admin interface
- Custom Go wrapper for authentication hooks and collection management
- Google OAuth 2.0 with role-based permissions (Viewer/Editor/Admin)
- ForwardAuth middleware for Traefik integration

**Routing Engine (BRouter)**
- Java-based routing engine optimized for Swiss terrain
- Protected API requiring Editor/Admin roles
- Multiple routing profiles for different bike types

**Frontend (React + TypeScript)**
- Modern React 18 with TypeScript for type safety
- Leaflet integration with Swiss topographic tiles
- Component library with CSS modules
- Custom hooks for business logic separation

## Configuration

**Development**
- `VITE_POCKETBASE_URL`: Backend URL (default: http://localhost:8090)

**Production**
- `BASE_DOMAIN`: Your domain (e.g., bike-map.ch)
- `ACME_EMAIL`: Email for Let's Encrypt SSL certificates
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: Google OAuth credentials
- `ADMIN_EMAIL` / `ADMIN_PASSWORD`: Default admin account
- `VITE_API_BASE_URL`: Production API base URL
- `VITE_BROUTER_BASE_URL`: BRouter service URL

**Backend Options**
- `PORT`: Server port (default: 8090)
- `HOST`: Server host (default: 0.0.0.0)
- `PB_DATA_DIR`: PocketBase data directory (default: /pb_data)

## Project Structure

```
bike-map/
├── backend/                 # PocketBase + Go backend
├── frontend/               # React TypeScript frontend
├── routing-server/         # BRouter routing engine
├── scripts/                # Build and deployment scripts
├── docker-compose.yml      # Production orchestration
├── docker-compose.dev.yml  # Development environment
└── .env.development.example # Development environment template
```

## Difficulty Rating
- **S0**: Green - Easy flow trails
- **S1**: Blue - Beginner technical features  
- **S2**: Orange - Intermediate challenges
- **S3**: Red - Advanced technical terrain
- **S4**: Purple - Expert-level obstacles
- **S5**: Black - Extreme technical difficulty

## Development

**Quick Start**
```bash
# Clone BRouter (first time only)
cd routing-server && git clone https://github.com/abrensch/brouter.git && cd ..

# Download Swiss routing data (first time only)
mkdir -p routing-server/segments
wget -O routing-server/segments/E5_N45.rd5 http://brouter.de/brouter/segments4/E5_N45.rd5

# Start development environment
docker-compose -f docker-compose.dev.yml up --build
```

**Services will be available at:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8090
- BRouter: http://localhost:17777
- PocketBase Admin: http://localhost:8090/_/

## Production Deployment

**Quick Start**
```bash
./scripts/build.sh    # Build for production
./scripts/deploy.sh   # Deploy to VPS
```

**Service Architecture**
- **Main App**: `https://bike-map.ch` - React frontend
- **API**: `https://bike-map.ch/api/*` - PocketBase backend
- **Admin Panel**: `https://admin.bike-map.ch` - PocketBase admin interface  
- **Routing Service**: `https://bike-map.ch/brouter/*` - BRouter API
- **Proxy Dashboard**: `https://proxy.bike-map.ch` - Traefik dashboard

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions.
