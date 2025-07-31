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
│   ├── useAuth.ts       # Authentication state
│   ├── useTrails.ts     # Trail data management
│   └── useDrawing.ts    # Route drawing state
├── context/             # React Context providers
│   └── AppContext.tsx   # Global app state
├── services/            # API and data services
│   ├── pocketbase.ts    # Backend API client
│   ├── trailCache.ts    # Trail data caching
│   └── brouter.ts       # BRouter routing service
├── types/               # TypeScript interfaces
│   └── index.ts         # Shared type definitions
└── utils/               # Utility functions
    ├── gpxGenerator.ts  # GPX file generation
    └── pathfinding.ts   # Route calculation
```

## Key Features

- **Component Library**: Reusable UI components with CSS modules
- **Custom Hooks**: Business logic separated into composable hooks
- **Type Safety**: Strict TypeScript with proper interfaces
- **Error Boundaries**: Graceful error handling
- **Performance**: Memoized components and optimized re-renders
- **State Management**: React Context with useReducer

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
- **Leaflet** - Interactive maps
- **PocketBase** - Backend client
- **Chart.js** - Elevation charts