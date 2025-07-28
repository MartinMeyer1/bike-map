import React, { useEffect, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { CachedTrail } from '../services/trailCache';

interface GPXTrailProps {
  trail: CachedTrail;
  isSelected: boolean;
  onTrailClick: (trail: CachedTrail) => void;
}

// Get color by difficulty level
function getLevelColor(level: string): string {
  switch (level) {
    case 'S0': return '#28a745'; // Green
    case 'S1': return '#007bff'; // Blue
    case 'S2': return '#fd7e14'; // Orange
    case 'S3': return '#dc3545'; // Red
    case 'S4': return '#6f42c1'; // Purple
    case 'S5': return '#343a40'; // Black
    default: return '#6c757d'; // Gray
  }
}

export default function GPXTrail({ trail, isSelected, onTrailClick }: GPXTrailProps) {
  const map = useMap();
  const [trailLayer, setTrailLayer] = useState<L.LayerGroup | null>(null);
  const [polylineRef, setPolylineRef] = useState<L.Polyline | null>(null);

  useEffect(() => {
    if (!trail.geoJson) {
      return;
    }
    
    const trackColor = getLevelColor(trail.level);
    const layerGroup = L.layerGroup();

    try {
      // Create line from GeoJSON coordinates
      const coordinates = trail.geoJson.geometry.coordinates;
      const latLngs = coordinates.map((coord: number[]) => [coord[1], coord[0]] as [number, number]);
      
      // Create polyline(s) - add background line if selected
      let polyline: L.Polyline;
      
      if (isSelected) {
        // Create wider background line with 50% opacity
        const backgroundLine = L.polyline(latLngs, {
          color: trackColor,
          weight: 12,
          opacity: 0.5
        });
        layerGroup.addLayer(backgroundLine);
        
        // Create normal foreground line on top
        polyline = L.polyline(latLngs, {
          color: trackColor,
          weight: 6,
          opacity: 0.9
        });
      } else {
        // Normal line for non-selected trails
        polyline = L.polyline(latLngs, {
          color: trackColor,
          weight: 6,
          opacity: 0.8
        });
      }

      // Add start marker
      if (latLngs.length > 0) {
        const startIcon = L.icon({
          iconUrl: '/icons/start-marker.svg',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34]
        });

        const startMarker = L.marker(latLngs[0], { icon: startIcon });
        layerGroup.addLayer(startMarker);
      }

      // Add end marker
      if (latLngs.length > 1) {
        const endIcon = L.icon({
          iconUrl: '/icons/finish-marker.svg',
          iconSize: [32, 32],
          iconAnchor: [16, 32],
          popupAnchor: [0, -30]
        });

        const endMarker = L.marker(latLngs[latLngs.length - 1], { icon: endIcon });
        layerGroup.addLayer(endMarker);
      }

      // Create popup content
      const elevation = trail.elevation;
      const popupContent = `
        <div style="min-width: 260px;">
          <h4 style="margin: 0 0 8px 0; color: ${trackColor};">${trail.name}</h4>
          <p style="margin: 4px 0; font-size: 14px; color: #666;">
            <strong>Level:</strong> ${trail.level}
          </p>
          ${trail.tags && trail.tags.length > 0 ? `
            <p style="margin: 4px 0; font-size: 14px; color: #666;">
              <strong>Tags:</strong> ${trail.tags.join(', ')}
            </p>
          ` : ''}
          ${elevation ? `
            <p style="margin: 4px 0;">
              <strong>D+:</strong> ${Math.round(elevation.gain)}m | 
              <strong>D-:</strong> ${Math.round(elevation.loss)}m
            </p>
          ` : ''}
          ${trail.description ? `
            <p style="margin: 4px 0;"><strong>Description:</strong> ${trail.description}</p>
          ` : ''}
        </div>
      `;

      // Bind popup to polyline
      polyline.bindPopup(popupContent);

      // Store polyline reference
      setPolylineRef(polyline);

      // Add click handler
      polyline.on('click', (e) => {
        e.originalEvent?.stopPropagation(); // Prevent map click event
        onTrailClick(trail);
      });

      // Add polyline to layer group
      layerGroup.addLayer(polyline);

      // Add to map
      layerGroup.addTo(map);
      setTrailLayer(layerGroup);

    } catch (error) {
      console.error(`Error rendering cached trail ${trail.name}:`, error);
    }

    // Cleanup function
    return () => {
      if (layerGroup && map) {
        map.removeLayer(layerGroup);
      }
    };
  }, [trail, map, onTrailClick, isSelected]);


  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (trailLayer && map) {
        map.removeLayer(trailLayer);
      }
    };
  }, [trailLayer, map]);

  return null; // This component doesn't render anything directly
}