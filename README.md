# 🤘 BikeMap

A web application for sharing MTB trails among friends. Built with React, PocketBase, PostGIS, and BRouter.

Check it out on [bike-map.ch](https://bike-map.ch).

## Features

### **Trail Management**
- GPX file upload with metadata (name, difficulty S0-S5, tags, description)
- Role-based access control (Viewer, Editor, Admin)
- Trail editing and deletion capabilities
- **Ratings & Comments**: 5-star rating system with threaded comments
- **Real-time Statistics**: Aggregate rating averages and comment counts
- Vector Tile Rendering: Efficient MVT tiles with engagement data
- Event-driven PostGIS sync: Automatic updates via domain events

### **Interactive Mapping**
- Swiss topographic maps (Swisstopo WMTS)
- Vector Tile Layers: Smooth rendering with zoom-level optimization
- Trail selection highlighting with filtered MVT layers
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
- **Event-Driven Sync**: Automatic PostGIS updates via domain events with detailed audit trails
- **Engagement System**: Ratings, comments, and statistics with real-time updates
- **Vector Tiles**: MVT generation with engagement data and smart cache invalidation
- **Repository Pattern**: Clean data access abstraction with PocketBase implementations

### **Routing Engine (BRouter)**
- Java-based routing engine optimized for Swiss terrain
- Protected API requiring Editor/Admin roles
- Multiple routing profiles for different bike types

### **Frontend (React + TypeScript)**
- Modern React 18 with TypeScript for type safety
- Vector Tile Integration: Leaflet with efficient MVT layer support
- Trail selection highlighting using filtered MVT layers
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
├── backend/                          # Simplified Go backend architecture
│   ├── main.go                      # Application entry point
│   ├── config/                      # Configuration management
│   ├── entities/                    # Domain entities & validation
│   │   ├── trail.go                # Trail domain model
│   │   ├── engagement.go           # Ratings & comments models
│   │   ├── user.go                 # User domain model
│   │   ├── validation.go           # Consolidated validation logic
│   │   ├── gpx.go                  # GPX processing model
│   │   └── tile.go                 # Tile model
│   ├── interfaces/                  # All interface definitions
│   ├── events/                      # Event-driven architecture
│   │   ├── types/                  # Domain event definitions
│   │   └── handlers/               # Event handlers
│   ├── repositories/                # Data access implementations
│   ├── services/                    # Application services
│   ├── apiHandlers/                 # HTTP request handlers
│   └── pb_data/                    # PocketBase data directory
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


See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions.