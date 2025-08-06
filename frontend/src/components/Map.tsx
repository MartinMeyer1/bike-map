import { useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapBounds, Trail } from '../types';
import { setupLeafletCompatibility } from '../utils/browserCompat';
import MVTTrailLayer from './MVTTrailLayer';
import RouteDrawer from './RouteDrawer';

// Set up browser compatibility once
setupLeafletCompatibility();

// Fix for default markers in react-leaflet
delete (L.Icon.Default.prototype as L.Icon.Default & { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface MapProps {
  selectedTrail: Trail | null;
  onBoundsChange: (bounds: MapBounds) => void;
  onTrailClick: (trail: Trail | null) => void;
  onMapMoveEnd?: () => void;
  isDrawingActive?: boolean;
  onRouteComplete?: (gpxContent: string) => void;
  onDrawingCancel?: () => void;
  initialGpxContent?: string;
}

// Component to handle map events and trail zoom
function MapEvents({ 
  onBoundsChange, 
  onMapClick,
  onMapMoveEnd
}: { 
  onBoundsChange: (bounds: MapBounds) => void;
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
    map.on('click', handleMapClick);
    
    // Initial bounds
    handleMoveEnd();

    return () => {
      map.off('moveend', handleMoveEnd);
      map.off('click', handleMapClick);
    };
  }, [map, onBoundsChange, onMapClick, onMapMoveEnd]);

  // Note: Trail zoom functionality removed since MVT doesn't provide bounds directly
  // TODO: Could be re-implemented by querying trail geometry API if needed

  return null;
}

export default function Map({ 
  selectedTrail, 
  onBoundsChange, 
  onTrailClick, 
  onMapMoveEnd,
  isDrawingActive = false,
  onRouteComplete,
  onDrawingCancel,
  initialGpxContent
}: MapProps) {
  const handleTrailClick = useCallback((trail: Trail | null) => {
    onTrailClick(trail);
  }, [onTrailClick]);

  const handleMapClick = useCallback(() => {
    // Clear selection when clicking on empty map area
    if (selectedTrail) {
      onTrailClick(null);
    }
  }, [selectedTrail, onTrailClick]);

  return (
    <MapContainer
      center={[46.2, 7.65]} // Center on Valais, Switzerland
      zoom={10}
      style={{ height: '100vh', width: '100%' }}
    >
      {/* Swisstopo base layer */}
      <TileLayer
        url="https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg"
        attribution='&copy; <a href="https://www.swisstopo.admin.ch/">Swisstopo</a>'
        maxZoom={18}
      />


      {/* Map event handler */}
      <MapEvents onBoundsChange={onBoundsChange} onMapClick={handleMapClick} onMapMoveEnd={onMapMoveEnd} />

      {/* MVT Trail Layer - replaces individual GPX trail rendering */}
      <MVTTrailLayer 
        onTrailClick={handleTrailClick}
        selectedTrail={selectedTrail}
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