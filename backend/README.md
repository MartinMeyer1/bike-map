# BikeMap Backend

A Go backend service for the BikeMap application, built with PocketBase and PostgreSQL/PostGIS for managing mountain bike trail data with vector tile generation capabilities. Features a Domain-Driven Design architecture with event-driven synchronization and comprehensive ratings/comments system.

## Architecture

The backend follows Domain-Driven Design principles with clean separation of concerns:

```
backend/
├── main.go                          # Application entry point
├── internal/
│   ├── config/
│   │   └── config.go               # Centralized configuration management
│   ├── domain/                     # Domain layer (business logic)
│   │   ├── entities/               # Core business entities
│   │   │   ├── trail.go           # Trail domain model
│   │   │   ├── engagement.go      # Ratings & comments models
│   │   │   ├── user.go            # User domain model
│   │   │   └── validation.go      # Domain validation types
│   │   ├── interfaces/             # All interface definitions
│   │   │   ├── repositories.go    # Repository interfaces
│   │   │   ├── services.go        # Service interfaces
│   │   │   ├── events.go          # Event interface
│   │   │   ├── auth.go            # AuthService interface
│   │   │   └── mvt.go             # MVTService interface
│   │   ├── events/                 # Event-driven architecture
│   │   │   ├── types/             # Domain event definitions
│   │   │   │   ├── base.go        # Base event implementation
│   │   │   │   ├── trail_events.go
│   │   │   │   ├── engagement_events.go
│   │   │   │   └── user_events.go
│   │   │   ├── handlers/          # Event handlers
│   │   │   │   ├── sync_handler.go
│   │   │   │   ├── cache_handler.go
│   │   │   │   └── audit_handler.go
│   │   │   ├── dispatcher.go      # Event dispatcher
│   │   │   └── registry.go        # Event handler registry
│   │   └── validation/             # Domain validation logic
│   ├── infrastructure/             # Infrastructure layer
│   │   └── repositories/           # PocketBase implementations
│   │       ├── pocketbase_trail_repository.go
│   │       ├── pocketbase_engagement_repository.go
│   │       └── pocketbase_user_repository.go
│   ├── services/                   # Application services
│   │   ├── app_service.go          # Main application coordinator
│   │   ├── auth_service.go         # Authentication & authorization
│   │   ├── collection_service.go   # PocketBase collection setup
│   │   ├── engagement_service.go   # Ratings & comments business logic
│   │   ├── sync_service.go         # PostGIS synchronization
│   │   ├── hook_manager_service.go # PocketBase event hooks
│   │   ├── gpx_service.go          # GPX processing (legacy)
│   │   └── mvt_service.go          # Vector tile generation
│   ├── handlers/
│   │   ├── auth_handler.go         # Authentication HTTP endpoints
│   │   └── mvt_handler.go          # MVT HTTP endpoints
│   └── models/                     # Legacy data models (GPX, tiles)
│       ├── gpx.go
│       ├── tile.go
│       └── trail.go
├── pb_data/                        # PocketBase data directory
└── README.md                       # This file
```

## Features

### Core Functionality
- **Trail Management**: CRUD operations for mountain bike trails with GPX file support
- **User Authentication**: Google OAuth2 integration with role-based access control
- **Ratings & Comments**: Full engagement system with real-time statistics
- **Vector Tiles**: High-performance MVT (Mapbox Vector Tiles) generation using PostGIS
- **Event-Driven Sync**: Automatic PostGIS synchronization via domain events
- **Cache Invalidation**: Smart cache invalidation for real-time updates
- **Spatial Processing**: GPX file parsing with elevation profile calculation

### Domain-Driven Architecture
- **Domain Entities**: Rich business models with validation and behavior
- **Repository Pattern**: Clean data access abstraction layer
- **Event System**: Decoupled components with async event handling
- **Service Layer**: Business logic orchestration with dependency injection

## Technology Stack

- **Runtime**: Go 1.23+
- **Database**: PocketBase (SQLite) + PostgreSQL with PostGIS extension
- **Architecture**: Domain-Driven Design with Repository Pattern
- **Events**: Custom event dispatcher with async handlers
- **Authentication**: Google OAuth2 via PocketBase
- **Vector Tiles**: PostGIS ST_AsMVT() function
- **File Processing**: Native Go XML parsing for GPX files
- **HTTP Framework**: PocketBase's built-in HTTP router

## ⚙️ Configuration

The application uses environment variables for configuration:

### Server Configuration
```bash
BASE_URL=http://localhost:8090  # Base URL for file downloads
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

## Getting Started

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

## API Endpoints

### Authentication
- `GET /api/auth/validate` - JWT token validation for ForwardAuth

### Vector Tiles
- `GET /api/tiles/{z}/{x}/{y}.mvt` - Standard MVT endpoint for trail data with engagement stats

### PocketBase Collections (Auto-generated REST API)
- `GET /api/collections/trails/records` - Trail CRUD operations
- `GET /api/collections/trail_ratings/records` - Rating CRUD operations
- `GET /api/collections/trail_comments/records` - Comment CRUD operations
- `GET /api/collections/rating_average/records` - Aggregate rating statistics
- `GET /api/collections/users/records` - User management

### PocketBase Admin
- `GET /_/` - PocketBase admin interface

## Security & Permissions

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

## Vector Tile Generation

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

### Architecture Principles
- **Domain Layer**: Core business logic and entities
- **Repository Pattern**: Clean data access abstraction
- **Event-Driven**: Decoupled components via domain events
- **Dependency Injection**: Services wired via interfaces
- **Clean Architecture**: Dependencies flow inward to domain

### Adding New Features
1. **Domain Entity**: Define business model in `internal/domain/entities/`
2. **Repository Interface**: Add data access contract in `internal/domain/interfaces/repositories.go`
3. **Repository Implementation**: Create PocketBase impl in `internal/infrastructure/repositories/`
4. **Domain Service**: Add business logic in `internal/services/`
5. **Event Types**: Add domain events in `internal/domain/events/types/`
6. **Event Handlers**: Wire events in `internal/domain/events/handlers/`
7. **Update App Service**: Configure dependencies in `app_service.go`

### Interface Organization
All interfaces are consolidated in `internal/domain/interfaces/`:
- **repositories.go**: Repository interfaces for data access
- **services.go**: Service interfaces (SyncService, CacheService, AuditService)  
- **events.go**: Event interface for domain events
- **auth.go**: Authentication service interface
- **mvt.go**: Vector tile service interface

### Database Migrations
The application automatically creates required collections and tables:
- PocketBase collections: `trails`, `trail_ratings`, `trail_comments`, `rating_average`, `users`
- PostGIS trails table with spatial indexes and engagement columns
- Proper relationships and constraints

## Monitoring & Logging

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

## Production Deployment

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