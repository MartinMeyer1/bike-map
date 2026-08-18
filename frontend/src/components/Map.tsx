import React, { useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapBounds, MVTTrail } from '../types';
import { MVTTrailService } from '../services/mvtTrails';
import RouteDrawer from './RouteDrawer';
import { LocationMarker, LocationMarkerRef } from './LocationMarker';
import { UserPosition } from '../hooks/useGeolocation';

// Fix for default markers in react-leaflet. The bundler-mangled icon paths
// are cached on the prototype, so drop them before pointing Leaflet at a CDN.
delete (L.Icon.Default.prototype as { _getIconUrl?: string })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

import { BaseMapType } from './BaseMapSelector';

interface MapProps {
  selectedTrail: MVTTrail | null;
  onTrailClick: (trail: MVTTrail | null) => void;
  onTrailsLoaded?: (trails: MVTTrail[]) => void;
  refreshTrigger?: number; // Increment this to trigger MVT refresh
  fitBoundsTarget?: MapBounds | null; // Bounds to fit the map to
  isDrawingActive?: boolean;
  onRouteComplete?: (gpxContent: string) => void;
  onDrawingCancel?: () => void;
  initialGpxContent?: string;
  activeBaseMap?: BaseMapType;
  // Location features
  userLocation?: UserPosition | null;
  showUserLocation?: boolean;
  userHeading?: number;
  locationMarkerRef?: React.RefObject<LocationMarkerRef | null>;
  /**
   * The Leaflet map itself. The mobile sheet resizes the map's container as it
   * moves, and Leaflet only re-measures when told to, so App needs the instance
   * to call invalidateSize and refit bounds.
   */
  mapRef?: React.RefObject<L.Map | null>;
}

// Component to handle map bounds fitting
function FitBoundsHandler({ fitBoundsTarget }: { fitBoundsTarget?: MapBounds | null }) {
  const map = useMap();

  useEffect(() => {
    if (fitBoundsTarget && fitBoundsTarget.north !== 0) {
      const bounds = L.latLngBounds(
        [fitBoundsTarget.south, fitBoundsTarget.west],
        [fitBoundsTarget.north, fitBoundsTarget.east]
      );
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [fitBoundsTarget, map]);

  return null;
}

// Component to handle map events and trail zoom
function MapEvents({
  selectedTrail,
  onMapClick
}: {
  selectedTrail: MVTTrail | null;
  onMapClick: () => void;
}) {
  const map = useMap();

  useEffect(() => {
    const handleMapClick = () => {
      onMapClick();
    };

    map.on('click', handleMapClick);

    return () => {
      map.off('click', handleMapClick);
    };
  }, [map, onMapClick]);

  // Handle trail zoom when selectedTrail changes
  useEffect(() => {
    if (selectedTrail && selectedTrail.bounds) {
      const bounds = selectedTrail.bounds;
      
      // Create Leaflet bounds object
      const leafletBounds = L.latLngBounds(
        [bounds.south, bounds.west],
        [bounds.north, bounds.east]
      );
      
      // Store reference to any open popup to reopen it after zoom
      let openPopup: L.Layer | null = null;
      map.eachLayer((layer: L.Layer) => {
        if ('isPopupOpen' in layer && typeof layer.isPopupOpen === 'function' && layer.isPopupOpen()) {
          openPopup = layer;
        }
      });
      
      // Always zoom to trail bounds for consistent behavior
      map.fitBounds(leafletBounds, { 
        padding: [20, 20],
        maxZoom: 16 
      });
      
      // Reopen popup after zoom animation
      if (openPopup) {
        setTimeout(() => {
          if (openPopup && map.hasLayer(openPopup) && 'openPopup' in openPopup && typeof openPopup.openPopup === 'function') {
            openPopup.openPopup();
          }
        }, 500);
      }
    }
  }, [map, selectedTrail]);

  return null;
}

// Component to manage MVT trail layer
function MVTTrailLayer({
  selectedTrail,
  onTrailClick,
  onTrailsLoaded,
  isDrawingActive,
  refreshTrigger
}: {
  selectedTrail: MVTTrail | null;
  onTrailClick: (trail: MVTTrail | null) => void;
  onTrailsLoaded?: (trails: MVTTrail[]) => void;
  isDrawingActive?: boolean;
  refreshTrigger?: number;
}) {
  const map = useMap();
  const mvtServiceRef = useRef<MVTTrailService | null>(null);

  useEffect(() => {
    // Initialize MVT service
    if (!mvtServiceRef.current) {
      mvtServiceRef.current = new MVTTrailService(map);
      mvtServiceRef.current.setEvents({
        onTrailClick: onTrailClick,
        onTrailsLoaded: onTrailsLoaded,
      });
    }

    // Add MVT layer to map (unless drawing is active)
    if (!isDrawingActive) {
      mvtServiceRef.current.addToMap();
    } else {
      mvtServiceRef.current.removeFromMap();
    }

    return () => {
      if (mvtServiceRef.current) {
        mvtServiceRef.current.removeFromMap();
      }
    };
  }, [map, onTrailClick, onTrailsLoaded, isDrawingActive]);

  // Update selected trail
  useEffect(() => {
    if (mvtServiceRef.current) {
      mvtServiceRef.current.selectTrail(selectedTrail?.id || null);
    }
  }, [selectedTrail]);

  // Refresh MVT layer when trigger changes
  useEffect(() => {
    if (refreshTrigger && mvtServiceRef.current) {
      mvtServiceRef.current.refreshMVTLayer();
    }
  }, [refreshTrigger]);

  return null;
}

const tileConfigs = {
  swisstopo: {
    url: 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg',
    attribution: '&copy; <a href="https://www.swisstopo.admin.ch/">Swisstopo</a>',
    maxZoom: 18,
  },
  osm: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 18,
  },
} as const;

function Map({
  selectedTrail,
  onTrailClick,
  onTrailsLoaded,
  refreshTrigger,
  fitBoundsTarget,
  isDrawingActive = false,
  onRouteComplete,
  onDrawingCancel,
  initialGpxContent,
  activeBaseMap = 'swisstopo',
  userLocation,
  showUserLocation = false,
  userHeading,
  locationMarkerRef,
  mapRef
}: MapProps) {
  const trailClickedRef = useRef(false);

  const handleTrailClick = useCallback((trail: MVTTrail | null) => {
    trailClickedRef.current = true;
    onTrailClick(trail);
    // Reset flag after a short delay
    setTimeout(() => {
      trailClickedRef.current = false;
    }, 50);
  }, [onTrailClick]);

  const handleMapClick = useCallback(() => {
    // Only clear selection if no trail was clicked recently
    if (!trailClickedRef.current && selectedTrail) {
      onTrailClick(null);
    }
  }, [selectedTrail, onTrailClick]);
  
  return (
    <MapContainer
      ref={mapRef}
      center={[46.2, 7.65]} // Center on Valais, Switzerland
      zoom={10}
      zoomControl={false}
      tapTolerance={44} // Increase touch tolerance on mobile
      // Fills whatever the shell gives it: the full viewport on desktop, the
      // space above the sheet on mobile.
      style={{ height: '100%', width: '100%' }}
    >
      {/* Base map tile layer */}
      <TileLayer
        key={activeBaseMap}
        url={tileConfigs[activeBaseMap].url}
        attribution={tileConfigs[activeBaseMap].attribution}
        maxZoom={tileConfigs[activeBaseMap].maxZoom}
      />


      {/* Map event handler */}
      <MapEvents selectedTrail={selectedTrail} onMapClick={handleMapClick} />

      {/* Fit bounds handler */}
      <FitBoundsHandler fitBoundsTarget={fitBoundsTarget} />

      {/* MVT Trail Layer */}
      <MVTTrailLayer
        selectedTrail={selectedTrail}
        onTrailClick={handleTrailClick}
        onTrailsLoaded={onTrailsLoaded}
        isDrawingActive={isDrawingActive}
        refreshTrigger={refreshTrigger}
      />

      {/* Route drawer */}
      <RouteDrawer
        isActive={isDrawingActive}
        onRouteComplete={onRouteComplete || (() => {})}
        onCancel={onDrawingCancel || (() => {})}
        initialGpxContent={initialGpxContent}
      />

      {/* User location marker */}
      {showUserLocation && userLocation && (
        <LocationMarker
          ref={locationMarkerRef}
          latitude={userLocation.latitude}
          longitude={userLocation.longitude}
          accuracy={userLocation.accuracy}
          heading={userHeading}
          showAccuracyCircle={true}
          autoCenter={false}
        />
      )}

    </MapContainer>
  );
}

// Memoized because every prop it takes is already referentially stable (context
// callbacks are useCallback'd, refs are refs). Without this, any state change in
// AppContent re-reconciles the whole Leaflet subtree on every render.
export default React.memo(Map);