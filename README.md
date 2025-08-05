# 🤘 BikeMap

A web application for sharing MTB trails among friends. Built with React, PocketBase, PostGIS, and BRouter.

## Features

### **Trail Management**
- GPX file upload with metadata (name, difficulty S0-S5, tags, description)
- Role-based access control (Viewer, Editor, Admin)
- Trail editing and deletion capabilities
- Vector Tile Rendering: MVT tiles generated from PostGIS
- Real-time Cache Invalidation: Automatic tile cache updates on data changes

### **Interactive Mapping**
- Swiss topographic maps (Swisstopo WMTS)
- Vector Tile Layers: Smooth rendering with zoom-level optimization
- Real-time route drawing with BRouter pathfinding
- Elevation profiles and distance tracking
- GPX export functionality
- Difficulty-based color coding with dynamic styling

### **Authentication & Security**
- Google OAuth 2.0 integration
- JWT session management
- ForwardAuth middleware for service protection
- CORS enabled for cross-origin requests (configurable for production)

## Architecture

### **Backend (PocketBase + Go + PostGIS)**
- **Dual Database**: PocketBase (SQLite) for app data + PostGIS for spatial operations
- **Vector Tiles**: MVT generation with automatic cache invalidation
- **Spatial Processing**: GPX to PostGIS sync with elevation profile calculation
- **Authentication**: Google OAuth 2.0 with role-based permissions
- **ForwardAuth**: Traefik middleware integration

### **Routing Engine (BRouter)**
- Java-based routing engine optimized for Swiss terrain
- Protected API requiring Editor/Admin roles
- Multiple routing profiles for different bike types

### **Frontend (React + TypeScript)**
- Modern React 18 with TypeScript for type safety
- Vector Tile Integration: Leaflet with MVT layer support
- Component library with CSS modules
- Custom hooks for business logic separation

## ⚙️ Configuration

### **Development**
- `VITE_POCKETBASE_URL`: Backend URL (default: http://localhost:8090)

### **Production**
```bash
# Domain & SSL
BASE_DOMAIN=bike-map.ch              # Your domain
ACME_EMAIL=admin@bike-map.ch         # Let's Encrypt email

# Authentication
GOOGLE_CLIENT_ID=your_client_id      # Google OAuth client ID
GOOGLE_CLIENT_SECRET=your_secret     # Google OAuth client secret
ADMIN_EMAIL=admin@bike-map.ch        # Admin account email
ADMIN_PASSWORD=secure_password       # Admin account password

# Frontend URLs
VITE_API_BASE_URL=https://bike-map.ch/api
VITE_BROUTER_BASE_URL=https://bike-map.ch/brouter

# Backend Configuration
BASE_URL=http://localhost:8090       # Backend base URL

# Database Configuration
POSTGRES_HOST=postgis                # PostgreSQL host (Docker service name)
POSTGRES_PORT=5432                   # PostgreSQL port
POSTGRES_DB=gis                      # Database name
POSTGRES_USER=gisuser                # Database user
POSTGRES_PASSWORD=gispass            # Database password
```

## Project Structure

```
bike-map/
├── backend/                          # Professional Go backend
│   ├── main.go                      # Application entry point
│   ├── internal/
│   │   ├── config/                  # Configuration management
│   │   ├── services/                # Business logic services
│   │   ├── handlers/                # HTTP request handlers
│   │   ├── models/                  # Data models
│   │   └── interfaces/              # Service interfaces
│   └── pb_data/                     # PocketBase data directory
├── frontend/                        # React TypeScript frontend
│   ├── src/
│   │   ├── components/              # React components
│   │   ├── hooks/                   # Custom hooks
│   │   ├── services/                # API services
│   │   ├── types/                   # TypeScript types
│   │   └── utils/                   # Utility functions
├── routing-server/                  # BRouter routing engine
├── mvt-server/                      # PostGIS database initialization
│   ├── initdb/init.sql             # Database schema
│   └── mvt-demo.html               # MVT testing page
├── scripts/                         # Build and deployment scripts
├── docker-compose.yml               # Production orchestration
├── docker-compose.dev.yml           # Development environment
├── .env.production.example          # Production environment template
└── .env.development.example         # Development environment template
```

## Difficulty Rating
- **S0**: Green - Easy flow trails
- **S1**: Blue - Beginner technical features  
- **S2**: Orange - Intermediate challenges
- **S3**: Red - Advanced technical terrain
- **S4**: Purple - Expert-level obstacles
- **S5**: Black - Extreme technical difficulty

## Development

### **Quick Start**
```bash
# Clone BRouter (first time only)
cd routing-server && git clone https://github.com/abrensch/brouter.git && cd ..

# Download Swiss routing data (first time only)
mkdir -p routing-server/segments
wget -O routing-server/segments/E5_N45.rd5 http://brouter.de/brouter/segments4/E5_N45.rd5

# Start development environment with PostGIS
docker-compose -f docker-compose.dev.yml up --build
```

### **Services Available**
- **Frontend**: http://localhost:3000 - React development server
- **Backend API**: http://localhost:8090 - PocketBase + Go API
- **PocketBase Admin**: http://localhost:8090/_/ - Database administration
- **BRouter**: http://localhost:17777 - Routing engine
- **PostGIS**: localhost:5432 - Spatial database

### **Development Features**
- **Hot Reload**: Frontend auto-reloads on changes
- **Live Sync**: Backend auto-syncs GPX files to PostGIS
- **Cache Invalidation**: Vector tiles update automatically

## Production Deployment

### **Quick Start**
```bash
./scripts/build.sh    # Build for production
./scripts/deploy.sh   # Deploy to VPS
```

### **Service Architecture**
- **Main App**: `https://bike-map.ch` - React frontend
- **API**: `https://bike-map.ch/api/*` - PocketBase backend with PostGIS
- **Vector Tiles**: `https://bike-map.ch/api/tiles/{z}/{x}/{y}.mvt` - MVT endpoints
- **Admin Panel**: `https://admin.bike-map.ch` - PocketBase admin interface  
- **Routing Service**: `https://bike-map.ch/brouter/*` - BRouter API
- **Proxy Dashboard**: `https://proxy.bike-map.ch` - Traefik dashboard

### **New Production Features**
- **PostGIS Integration**: Spatial database for vector tile generation
- **Automatic Cache Invalidation**: Real-time tile updates
- **Environment Configuration**: Comprehensive configuration management

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions.