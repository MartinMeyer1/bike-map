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
│   └── *.module.css     # Component-specific styles
├── hooks/               # Custom React hooks
│   └── useAppContext.ts # App context hook
├── context/             # React Context providers
│   └── AppContext.tsx   # Global app state
├── services/            # API and data services
│   ├── pocketbase.ts    # Backend API client
│   ├── trailCache.ts    # Trail data caching
│   ├── mvtTrails.ts     # MVT trail rendering service
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
    └── pathfinding.ts   # Route calculation
```

## Key Features

- **Component Library**: Reusable UI components with CSS modules
- **MVT Tile System**: High-performance vector tile rendering with cache management
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