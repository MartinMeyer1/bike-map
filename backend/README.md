# BikeMap Backend

A Go backend service for the BikeMap application, built with PocketBase and PostgreSQL/PostGIS for managing mountain bike trail data with vector tile generation capabilities.

## 🏗️ Architecture

The backend follows a clean architecture pattern with clear separation of concerns:

```
backend/
├── main.go                          # Application entry point
├── internal/
│   ├── config/
│   │   └── config.go               # Centralized configuration management
│   ├── services/
│   │   ├── app_service.go          # Main application coordinator
│   │   ├── auth_service.go         # Authentication & authorization logic
│   │   ├── collection_service.go   # PocketBase collection management
│   │   ├── gpx_service.go          # GPX file processing & PostGIS sync
│   │   └── mvt_service.go          # Vector tile generation
│   ├── handlers/
│   │   ├── auth_handler.go         # Authentication HTTP endpoints
│   │   └── mvt_handler.go          # MVT HTTP endpoints
│   ├── models/
│   │   └── trail.go                # Data models and business logic
│   └── interfaces/
│       ├── auth.go                 # Authentication interfaces
│       └── mvt.go                  # MVT service interfaces
├── pb_data/                        # PocketBase data directory
└── README.md                       # This file
```

## 🚀 Features

### Core Functionality
- **Trail Management**: CRUD operations for mountain bike trails with GPX file support
- **User Authentication**: Google OAuth2 integration with role-based access control
- **Vector Tiles**: High-performance MVT (Mapbox Vector Tiles) generation using PostGIS
- **Cache Invalidation**: Automatic cache invalidation system for real-time updates
- **Spatial Processing**: GPX file parsing with elevation profile calculation

## 🛠️ Technology Stack

- **Runtime**: Go 1.23+
- **Database**: PocketBase (SQLite) + PostgreSQL with PostGIS extension
- **Authentication**: Google OAuth2 via PocketBase
- **Vector Tiles**: PostGIS ST_AsMVT() function
- **File Processing**: Native Go XML parsing for GPX files
- **HTTP Framework**: PocketBase's built-in HTTP router

## ⚙️ Configuration

The application uses environment variables for configuration:

### Server Configuration
```bash
PORT=8090                    # Server port (default: 8090)
BASE_URL=http://localhost:8090  # Base URL for file downloads
HOST=localhost               # Server host (default: localhost)
```

### Database Configuration
```bash
POSTGRES_HOST=localhost      # PostgreSQL host
POSTGRES_PORT=5432          # PostgreSQL port
POSTGRES_DB=gis             # Database name
POSTGRES_USER=gisuser       # Database user
POSTGRES_PASSWORD=gispass   # Database password
```

### OAuth Configuration
```bash
GOOGLE_CLIENT_ID=your_client_id        # Google OAuth client ID
GOOGLE_CLIENT_SECRET=your_secret       # Google OAuth client secret
```

### Admin Configuration
```bash
ADMIN_EMAIL=admin@example.com          # Admin account email
ADMIN_PASSWORD=secure_password         # Admin account password
```

## 🚀 Getting Started

### Prerequisites
- Go 1.23 or later
- PostgreSQL with PostGIS extension
- Google OAuth2 credentials (optional)

### Installation

1. **Clone and build**:
   ```bash
   go build -o bike-map-backend
   ```

2. **Set up PostgreSQL with PostGIS**:
   ```bash
   # Using Docker
   docker run -d \
     --name postgis \
     -e POSTGRES_DB=gis \
     -e POSTGRES_USER=gisuser \
     -e POSTGRES_PASSWORD=gispass \
     -p 5432:5432 \
     postgis/postgis:15-3.4
   ```

3. **Configure environment variables**:
   ```bash
   export POSTGRES_HOST=localhost
   export POSTGRES_PORT=5432
   export POSTGRES_DB=gis
   export POSTGRES_USER=gisuser
   export POSTGRES_PASSWORD=gispass
   
   # Optional OAuth setup
   export GOOGLE_CLIENT_ID=your_client_id
   export GOOGLE_CLIENT_SECRET=your_client_secret
   
   # Optional admin account
   export ADMIN_EMAIL=admin@example.com
   export ADMIN_PASSWORD=secure_password
   ```

4. **Run the server**:
   ```bash
   ./bike-map-backend serve
   ```

The server will start on port 8090 and automatically:
- Create required database tables
- Set up PocketBase collections
- Configure OAuth providers
- Sync existing trails to PostGIS
- Start serving MVT endpoints

## 📋 API Endpoints

### Authentication
- `GET /api/auth/validate` - JWT token validation for ForwardAuth

### Vector Tiles
- `GET /api/tiles/{z}/{x}/{y}.mvt` - Standard MVT endpoint for trail data

### PocketBase Admin
- `GET /_/` - PocketBase admin interface
- `GET /api/collections/trails/records` - Trail CRUD operations
- `GET /api/collections/users/records` - User management

## 🔒 Security & Permissions

### User Roles
- **Viewer**: Can view trails (default for new users)
- **Editor**: Can create and edit own trails
- **Admin**: Full access to all trails and user management

### Trail Permissions
- **Public Read**: All trails are publicly readable
- **Authenticated Create**: Only Editors and Admins can create trails
- **Owner/Admin Update**: Users can edit their own trails, Admins can edit any
- **Owner/Admin Delete**: Users can delete their own trails, Admins can delete any

### Authentication Flow
1. Users authenticate via Google OAuth2
2. JWT tokens are issued by PocketBase
3. Token validation happens on protected endpoints
4. Role-based permissions are enforced automatically

## 🗺️ Vector Tile Generation

### MVT Process
1. **Spatial Query**: PostGIS filters trails within tile bounds
2. **Geometry Simplification**: Zoom-level appropriate simplification
3. **MVT Generation**: ST_AsMVT() produces binary vector tiles
4. **Cache Headers**: ETags and cache-control for performance

### Cache Invalidation
- **Automatic**: Cache invalidates on any trail CRUD operation
- **Version-Based**: Random version strings prevent stale caches
- **Thread-Safe**: Concurrent cache operations are protected
- **HTTP Compliant**: Standard 304 Not Modified responses

### Zoom Level Optimization
- **Z ≤ 8**: Heavy simplification for overview
- **Z 9-10**: Moderate simplification for regional view
- **Z 11-12**: Light simplification for city view  
- **Z 13-14**: Minimal simplification for neighborhood
- **Z ≥ 15**: No simplification for detailed view

## 🔧 Development

### Project Structure Principles
- **Interfaces**: Abstract dependencies for testability
- **Services**: Business logic encapsulation
- **Handlers**: HTTP request/response handling
- **Models**: Data structures and validation
- **Config**: Centralized configuration management

### Adding New Features
1. **Define Interface**: Create interface in `internal/interfaces/`
2. **Implement Service**: Add business logic in `internal/services/`
3. **Add Handler**: Create HTTP endpoints in `internal/handlers/`
4. **Update App Service**: Wire dependencies in `app_service.go`
5. **Test**: Ensure all functionality works end-to-end

### Database Migrations
The application automatically creates required tables on startup:
- PostGIS trails table with spatial indexes
- PocketBase collections for users and trails
- Proper foreign key relationships

## 📊 Monitoring & Logging

### Logging Levels
- **Info**: Startup events, successful operations
- **Warning**: Missing configuration, non-critical errors  
- **Error**: Service failures, database connection issues
- **Debug**: Cache invalidation, tile generation details

### Key Metrics to Monitor
- **Trail Sync Success Rate**: GPX import success/failure ratio
- **MVT Generation Time**: Vector tile generation performance
- **Cache Hit Rate**: ETags effectiveness  
- **Database Connection Health**: PostGIS connectivity

## 🚀 Production Deployment

### Environment Setup
1. **PostgreSQL**: Use managed PostgreSQL with PostGIS extension
2. **File Storage**: Ensure persistent storage for PocketBase data
3. **Load Balancing**: Configure proper health checks
4. **SSL/TLS**: Enable HTTPS for production traffic
5. **Monitoring**: Set up logging and monitoring solutions

### Performance Considerations
- **Database Indexing**: Spatial indexes are automatically created
- **Connection Pooling**: PostgreSQL connection pooling recommended
- **Cache Headers**: 24-hour cache TTL for vector tiles
- **File Storage**: Consider CDN for GPX file serving

### Security Checklist
- [ ] Environment variables properly configured
- [ ] OAuth2 credentials secured
- [ ] Database access restricted
- [ ] Admin credentials strong and unique
- [ ] CORS properly configured for your domain
- [ ] HTTPS enabled in production