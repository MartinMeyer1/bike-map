# BikeMap Frontend

React + TypeScript frontend for the BikeMap trail sharing application.

## Project Structure

```
src/
├── components/           # React components
│   ├── ui/              # Reusable UI components (Button, Modal, Badge)
│   ├── Map.tsx          # Leaflet map component
│   ├── TrailSidebar.tsx # Trail list and filters
│   ├── TrailCard.tsx    # Individual trail display
│   ├── UploadPanel.tsx  # Trail upload form
│   ├── MobileHeader.tsx # Mobile navigation header
│   ├── MobileTrailPopup.tsx # Mobile trail details popup
│   ├── LocationMarker.tsx # GPS location marker with compass
│   └── *.module.css     # Component-specific styles
├── hooks/               # Custom React hooks
│   ├── useAppContext.ts # App context hook
│   ├── useGeolocation.ts # GPS location tracking
│   ├── useDeviceOrientation.ts # Device compass orientation
│   └── useMediaQuery.ts # Mobile/touch device detection
├── context/             # React Context providers
│   └── AppContext.tsx   # Global app state
├── services/            # API and data services
│   ├── pocketbase.ts    # Backend API client
│   ├── trailCache.ts    # Trail data caching
│   ├── mvtTrails.ts     # MVT trail rendering with zoom-responsive markers
│   └── brouter.ts       # BRouter routing service
├── styles/              # Shared CSS modules
│   └── common.module.css # Common styles (modals, forms, buttons)
├── types/               # TypeScript interfaces
│   └── index.ts         # Shared type definitions
└── utils/               # Utility functions
    ├── colors.ts        # Trail difficulty colors
    ├── constants.ts     # Shared constants
    ├── errorHandling.ts # Centralized error handling
    ├── gpxGenerator.ts  # GPX file generation
    ├── pathfinding.ts   # Route calculation
    └── shareUtils.ts    # Trail sharing utilities
```

## Key Features

- **Component Library**: Reusable UI components with CSS modules and Toast notifications
- **MVT Tile System**: High-performance vector tile rendering with cache management
- **Zoom-Responsive Markers**: Trail start/end markers scale with zoom level (hidden at Z≤10, 15-38px)
- **Trail Sharing**: Web Share API with clipboard fallback, URL parameters, and social media previews
- **Mobile Responsive Design**: Touch-optimized interface with mobile-specific components
- **Location Tracking**: Real-time GPS positioning with compass direction indicator
- **Type Safety**: Strict TypeScript with proper interfaces
- **Centralized State**: React Context with useReducer for global state
- **Performance Optimized**: Debounced map events, memoized components, throttled tile loading
- **Smart Caching**: Browser cache with version-based invalidation
- **Error Boundary**: Comprehensive error handling and user feedback

## Development

```bash
npm install
npm run dev       # Start development server
npm run build     # Build for production
npm run lint      # Run ESLint
```

## Dependencies

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Leaflet** - Interactive maps with MVT support
- **PocketBase** - Backend client
- **Chart.js** - Elevation charts
- **Device APIs** - Geolocation and DeviceOrientationEvent for location tracking