import React, { useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapBounds } from '../types';
import { CachedTrail } from '../services/trailCache';
import GPXTrail from './GPXTrail';

// Fix for default markers in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Configure Leaflet to avoid deprecated Mozilla properties
if (typeof window !== 'undefined') {
  // Override the deprecated property access in MouseEvent prototype
  // This prevents Leaflet from accessing mozPressure and mozInputSource
  const originalMouseEvent = window.MouseEvent;
  if (originalMouseEvent && originalMouseEvent.prototype) {
    // Define getters that return undefined instead of throwing deprecation warnings
    Object.defineProperty(originalMouseEvent.prototype, 'mozPressure', {
      get: function() { return undefined; },
      configurable: true
    });
    Object.defineProperty(originalMouseEvent.prototype, 'mozInputSource', {
      get: function() { return undefined; },
      configurable: true
    });
  }
}

interface MapProps {
  trails: CachedTrail[];
  selectedTrail: CachedTrail | null;
  onBoundsChange: (bounds: MapBounds) => void;
  onTrailClick: (trail: CachedTrail | null) => void;
}

// Component to handle map events and trail zoom
function MapEvents({ 
  onBoundsChange, 
  selectedTrail,
  onMapClick
}: { 
  onBoundsChange: (bounds: MapBounds) => void;
  selectedTrail: CachedTrail | null;
  onMapClick: () => void;
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
  }, [map, onBoundsChange, onMapClick]);

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
      let openPopup: any = null;
      map.eachLayer((layer: any) => {
        if (layer.isPopupOpen && layer.isPopupOpen()) {
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
          if (openPopup && map.hasLayer(openPopup)) {
            openPopup.openPopup();
          }
        }, 500);
      }
    }
  }, [map, selectedTrail]);

  return null;
}

export default function Map({ trails, selectedTrail, onBoundsChange, onTrailClick }: MapProps) {
  const handleTrailClick = useCallback((trail: CachedTrail) => {
    onTrailClick(trail);
  }, [onTrailClick]);

  const handleMapClick = useCallback(() => {
    // Clear selection when clicking on empty map area
    if (selectedTrail) {
      onTrailClick(null as any);
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
      <MapEvents onBoundsChange={onBoundsChange} selectedTrail={selectedTrail} onMapClick={handleMapClick} />

      {/* Render GPX trails */}
      {trails.map((trail) => (
        <GPXTrail
          key={trail.id}
          trail={trail}
          isSelected={selectedTrail?.id === trail.id}
          onTrailClick={handleTrailClick}
        />
      ))}
    </MapContainer>
  );
}