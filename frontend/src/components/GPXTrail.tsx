import { useEffect, useState } from 'react';
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

// Convert hex color to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

// Darken a hex color by a percentage (0-1)
function darkenColor(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  const r = Math.round(rgb.r * (1 - amount));
  const g = Math.round(rgb.g * (1 - amount));
  const b = Math.round(rgb.b * (1 - amount));
  
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export default function GPXTrail({ trail, isSelected, onTrailClick }: GPXTrailProps) {
  const map = useMap();
  const [trailLayer, setTrailLayer] = useState<L.LayerGroup | null>(null);
  const [, setPolylineRef] = useState<L.Polyline | null>(null);

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
        
        // Create gradient trail to show direction (from start to end)
        const segmentLength = Math.max(1, Math.floor(latLngs.length / 20)); // Create ~20 segments
        
        for (let i = 0; i < latLngs.length - 1; i += segmentLength) {
          const endIndex = Math.min(i + segmentLength, latLngs.length - 1);
          const segmentPoints = latLngs.slice(i, endIndex + 1);
          
          if (segmentPoints.length < 2) continue;
          
          // Calculate progress along trail (0 to 1)
          const progress = i / (latLngs.length - 1);
          
          // Create gradient from start color to end color
          const startColor = darkenColor(trackColor, 0.3); // Darker version of trail difficulty color
          const endColor = '#ffffff'; // White at the end
          
          // Interpolate between colors
          const startRGB = hexToRgb(startColor);
          const endRGB = hexToRgb(endColor);
          
          const r = Math.round(startRGB.r + (endRGB.r - startRGB.r) * progress);
          const g = Math.round(startRGB.g + (endRGB.g - startRGB.g) * progress);
          const b = Math.round(startRGB.b + (endRGB.b - startRGB.b) * progress);
          
          const segmentColor = `rgb(${r}, ${g}, ${b})`;
          
          const segmentLine = L.polyline(segmentPoints, {
            color: segmentColor,
            weight: 6,
            opacity: 0.9
          });
          
          layerGroup.addLayer(segmentLine);
        }
        
        // Don't create the normal polyline since we have gradient segments
        polyline = null as any;
      } else {
        // Normal line for non-selected trails
        polyline = L.polyline(latLngs, {
          color: trackColor,
          weight: 6,
          opacity: 0.8
        });
      }

      // Add end marker first so start marker appears on top when overlapping
      if (latLngs.length > 1) {
        const endIcon = L.divIcon({
          html: '<div style="font-size: 24px;">🍺</div>',
          className: 'emoji-marker',
          iconSize: [30, 30],
          iconAnchor: [15, 15],
          popupAnchor: [0, -15]
        });

        const endMarker = L.marker(latLngs[latLngs.length - 1], { icon: endIcon });
        layerGroup.addLayer(endMarker);
      }

      // Add start marker
      if (latLngs.length > 0) {
        const startIcon = L.divIcon({
          html: '<div style="font-size: 24px;">🤘</div>',
          className: 'emoji-marker',
          iconSize: [30, 30],
          iconAnchor: [15, 15],
          popupAnchor: [0, -15]
        });

        const startMarker = L.marker(latLngs[0], { icon: startIcon });
        layerGroup.addLayer(startMarker);
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

      // Handle popup and click events
      if (polyline) {
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
      } else if (isSelected) {
        // For gradient trails, add popup and click to the background line
        const backgroundLine = layerGroup.getLayers().find(layer => layer instanceof L.Polyline) as L.Polyline;
        if (backgroundLine) {
          backgroundLine.bindPopup(popupContent);
          backgroundLine.on('click', (e) => {
            e.originalEvent?.stopPropagation();
            onTrailClick(trail);
          });
        }
      }

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