# Bike Map Backend

PocketBase-based backend for bike trail mapping application.

## Quick Start

```bash
# Build
go build -tags "sqlite_fts5" -o app .

# Run
./app serve --dir /pb_data --http 0.0.0.0:8090
```

## Configuration

**Environment Variables:**

```bash
# OAuth Configuration (optional)
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret

# Admin Account (optional)
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=secure_password

# Server Configuration (optional)
PORT=8090                 # Server port (default: 8090)
HOST=0.0.0.0             # Server host (default: 0.0.0.0)  
PB_DATA_DIR=/pb_data     # Data directory (default: /pb_data)
```

## Features

- **User Management**: Role-based access (Viewer/Editor/Admin)
- **Trail Management**: GPX file uploads with metadata
- **Authentication**: Google OAuth integration
- **API**: RESTful API with PocketBase
- **Authorization**: JWT-based auth validation endpoint
- **Security**: CORS middleware with wildcard origin support

## API Endpoints

- `GET /api/collections/trails/records` - List trails
- `POST /api/collections/trails/records` - Create trail (Editor+)
- `GET /api/auth/validate` - Validate JWT token
- `/api/oauth2/*` - OAuth authentication

## Project Structure

```
backend/
├── main.go                    # Application entry point
├── internal/
│   ├── config/               # Configuration management
│   └── models/               # Data models and validation
└── pb_data/                  # PocketBase database and files
```

## Docker

```bash
docker build -t bikemap-backend .
docker run -p 8090:8090 -v ./pb_data:/pb_data bikemap-backend
```