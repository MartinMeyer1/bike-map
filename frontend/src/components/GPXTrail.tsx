import React, { useEffect, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-gpx';
import { Trail } from '../types';
import { PocketBaseService } from '../services/pocketbase';

interface GPXTrailProps {
  trail: Trail;
  onTrailClick: (trail: Trail) => void;
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

export default function GPXTrail({ trail, onTrailClick }: GPXTrailProps) {
  const map = useMap();
  const [gpxLayer, setGpxLayer] = useState<any>(null);

  useEffect(() => {
    if (!trail.file) {
      console.log('No file for trail:', trail.name);
      return;
    }

    // Get the GPX file URL from PocketBase
    const gpxUrl = PocketBaseService.getTrailFileUrl(trail);
    const trackColor = getLevelColor(trail.level);
    
    console.log('Loading GPX for trail:', trail.name, 'URL:', gpxUrl);

    // Create start and end icons (same as your friend's approach)
    const startIcon = L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });

    const endIcon = L.icon({
      iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Finish_flag_icon.svg/32px-Finish_flag_icon.svg.png',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -30]
    });

    // Create GPX layer (same approach as your friend)
    const gpx = new (L as any).GPX(gpxUrl, {
      async: true,
      marker_options: {
        startIconUrl: startIcon.options.iconUrl,
        endIconUrl: endIcon.options.iconUrl,
        shadowUrl: null
      },
      polyline_options: {
        color: trackColor,
        weight: 6
      }
    }).on('loaded', function(e: any) {
      console.log('GPX loaded successfully for:', trail.name);
      const gain = e.target.get_elevation_gain();
      const loss = e.target.get_elevation_loss();
      
      const popupContent = `
        <div style="min-width: 280px;">
          <h4 style="margin: 0 0 8px 0; color: ${trackColor};">${trail.name}</h4>
          <p style="margin: 4px 0; font-size: 14px; color: #666;">
            <strong>Level:</strong> ${trail.level}
          </p>
          ${trail.tags && trail.tags.length > 0 ? `
            <p style="margin: 4px 0; font-size: 14px; color: #666;">
              <strong>Tags:</strong> ${trail.tags.join(', ')}
            </p>
          ` : ''}
          <p>
            <strong>D+:</strong> ${Math.round(gain || 0)}m<br/>
            <strong>D-:</strong> ${Math.round(loss || 0)}m
          </p>
          ${trail.description ? `
            <p><strong>Description:</strong> ${trail.description}</p>
          ` : ''}
        </div>
      `;

      e.target.bindPopup(popupContent);
      
      // Add click handler
      e.target.on('click', () => {
        onTrailClick(trail);
      });
    }).on('error', function(e: any) {
      console.error('Error loading GPX for trail:', trail.name, e);
    });

    // Add to map
    gpx.addTo(map);
    setGpxLayer(gpx);

    // Cleanup function
    return () => {
      if (gpx && map) {
        map.removeLayer(gpx);
      }
    };
  }, [trail, map, onTrailClick]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (gpxLayer && map) {
        map.removeLayer(gpxLayer);
      }
    };
  }, [gpxLayer, map]);

  return null; // This component doesn't render anything directly
}