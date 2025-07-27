# 🚵 BikeMap

A lightweight social web app for sharing MTB singletracks among friends. Built with React frontend and PocketBase backend, featuring client-side GPX processing and Swiss topographic maps.

## ✅ Features

### 🔐 Authentication
- ✅ Sign up / login with email & password (PocketBase native)
- ✅ Session management using PocketBase JWT (localStorage)
- ✅ User authentication state management

### 📤 GPX Upload
- ✅ Upload `.gpx` file via form
- ✅ Input fields:
  - ✅ Trail name
  - ✅ Difficulty rating (S0–S5) with color coding
  - ✅ Tags (Flow, Tech, Steep, etc.)
  - ✅ Description
- ✅ Save to PocketBase:
  - ✅ GPX file storage
  - ✅ Metadata in `trails` collection
  - ✅ Linked to authenticated user via `owner`

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
- ✅ Authentication status indicator
- ✅ Add trail button (authenticated users only)
- ✅ Difficulty level legend
- ✅ Trail click to focus on map

## 🏗️ Architecture

### Backend (PocketBase + Go)
- **PocketBase**: Modern backend-as-a-service with SQLite
- **Custom Go wrapper**: Collection management and authentication hooks
- **File storage**: GPX files with automatic URL generation
- **CORS enabled**: For frontend integration
- **Authentication**: JWT-based user sessions

### Frontend (React + TypeScript)
- **React 18**: Modern component-based UI
- **TypeScript**: Type-safe development
- **Leaflet**: Interactive mapping with Swiss topographic tiles
- **Client-side GPX**: Real-time trail processing with elevation data
- **Responsive design**: Full-screen map with overlay panels

## 🚀 Quick Start

### Using Docker Compose (Recommended)
```bash
# Clone and start both services
git clone <repository>
cd bike-map
docker compose up --build

# Access the application
# Frontend: http://localhost:3000
# Backend: http://localhost:8090
```

### Development Setup

#### Backend
```bash
cd backend
go mod download
go run . serve --http="0.0.0.0:8090"
```

#### Frontend
```bash
cd frontend
npm install
npm run dev
```

## 🔧 Configuration

### Environment Variables
- `VITE_POCKETBASE_URL`: Backend URL (default: http://localhost:8090)

### File Structure
```
bike-map/
├── backend/                 # PocketBase + Go backend
│   ├── main.go             # Main application with collections
│   ├── Dockerfile          # Multi-stage Go build
│   └── pb_data/            # PocketBase data (gitignored)
├── frontend/               # React TypeScript frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── services/       # PocketBase API client
│   │   └── types/          # TypeScript definitions
│   ├── Dockerfile          # Multi-stage Node build
│   └── nginx.conf          # Production nginx config
├── compose.yml             # Docker orchestration
└── .gitignore             # Excludes data, deps, config
```

## 🎨 Difficulty Color Scheme
- **S0**: Green - Easy flow trails
- **S1**: Blue - Beginner technical features  
- **S2**: Orange - Intermediate challenges
- **S3**: Red - Advanced technical terrain
- **S4**: Purple - Expert-level obstacles
- **S5**: Black - Extreme technical difficulty

## ✨ Future Enhancements

- [ ] Trail editing and deletion
- [ ] Advanced trail filtering
- [ ] Trail details page
- [ ] Comments
- [ ] GPX drawing

