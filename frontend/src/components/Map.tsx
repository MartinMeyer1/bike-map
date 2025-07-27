import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Trail, MapBounds } from '../types';
import GPXTrail from './GPXTrail';

// Fix for default markers in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});


interface MapProps {
  trails: Trail[];
  onBoundsChange: (bounds: MapBounds) => void;
  onTrailClick: (trail: Trail) => void;
}

// Component to handle map events
function MapEvents({ onBoundsChange }: { onBoundsChange: (bounds: MapBounds) => void }) {
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

    map.on('moveend', handleMoveEnd);
    
    // Initial bounds
    handleMoveEnd();

    return () => {
      map.off('moveend', handleMoveEnd);
    };
  }, [map, onBoundsChange]);

  return null;
}



export default function Map({ trails, onBoundsChange, onTrailClick }: MapProps) {
  const [selectedTrail, setSelectedTrail] = useState<Trail | null>(null);

  console.log('Map component rendering with trails:', trails.length);

  const handleTrailClick = (trail: Trail) => {
    setSelectedTrail(trail);
    onTrailClick(trail);
  };

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
      <MapEvents onBoundsChange={onBoundsChange} />

      {/* Render GPX trails */}
      {trails.map((trail) => (
        <GPXTrail
          key={trail.id}
          trail={trail}
          onTrailClick={handleTrailClick}
        />
      ))}
    </MapContainer>
  );
}