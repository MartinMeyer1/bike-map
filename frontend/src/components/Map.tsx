import { useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapBounds, MVTTrail } from '../types';
import { setupLeafletCompatibility } from '../utils/browserCompat';
import { MVTTrailService } from '../services/mvtTrails';
import RouteDrawer from './RouteDrawer';

// Set up browser compatibility once
setupLeafletCompatibility();

// Fix for default markers in react-leaflet
delete ((L as any).Icon.Default.prototype as any)._getIconUrl;
(L as any).Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface MapProps {
  selectedTrail: MVTTrail | null;
  onBoundsChange: (bounds: MapBounds) => void;
  onTrailClick: (trail: MVTTrail | null) => void;
  onTrailsLoaded?: (trails: MVTTrail[]) => void;
  onMapMoveEnd?: () => void;
  refreshTrigger?: number; // Increment this to trigger MVT refresh
  isDrawingActive?: boolean;
  onRouteComplete?: (gpxContent: string) => void;
  onDrawingCancel?: () => void;
  initialGpxContent?: string;
}

// Component to handle map events and trail zoom
function MapEvents({ 
  onBoundsChange, 
  selectedTrail,
  onMapClick,
  onMapMoveEnd
}: { 
  onBoundsChange: (bounds: MapBounds) => void;
  selectedTrail: MVTTrail | null;
  onMapClick: () => void;
  onMapMoveEnd?: () => void;
}) {
  const map = useMap();

  useEffect(() => {
    const handleMoveEnd = () => {
      const bounds = map.getBounds();
      onBoundsChange({
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
      });
      
      // Notify that map movement has ended
      if (onMapMoveEnd) {
        onMapMoveEnd();
      }
    };

    const handleMapClick = () => {
      onMapClick();
    };

    map.on('moveend', handleMoveEnd);
    map.on('zoomend', handleMoveEnd);  // Also listen to zoom events
    map.on('click', handleMapClick);
    
    // Initial bounds
    handleMoveEnd();

    return () => {
      map.off('moveend', handleMoveEnd);
      map.off('zoomend', handleMoveEnd);
      map.off('click', handleMapClick);
    };
  }, [map, onBoundsChange, onMapClick, onMapMoveEnd]);

  // Handle trail zoom when selectedTrail changes
  useEffect(() => {
    if (selectedTrail && selectedTrail.bounds) {
      const bounds = selectedTrail.bounds;
      
      // Create Leaflet bounds object
      const leafletBounds = (L as any).latLngBounds(
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

export default function Map({ 
  selectedTrail, 
  onBoundsChange, 
  onTrailClick, 
  onTrailsLoaded,
  onMapMoveEnd,
  refreshTrigger,
  isDrawingActive = false,
  onRouteComplete,
  onDrawingCancel,
  initialGpxContent
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
      {...{ center: [46.2, 7.65], zoom: 10 } as any} // Center on Valais, Switzerland
      style={{ height: '100vh', width: '100%' }}
    >
      {/* Swisstopo base layer */}
      <TileLayer
        {...{
          url: "https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg",
          attribution: '&copy; <a href="https://www.swisstopo.admin.ch/">Swisstopo</a>',
          maxZoom: 18
        } as any}
      />


      {/* Map event handler */}
      <MapEvents onBoundsChange={onBoundsChange} selectedTrail={selectedTrail} onMapClick={handleMapClick} onMapMoveEnd={onMapMoveEnd} />

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
    </MapContainer>
  );
}