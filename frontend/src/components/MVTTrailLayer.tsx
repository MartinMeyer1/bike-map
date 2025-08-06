import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
// Import VectorGrid locally
import 'leaflet.vectorgrid';
import { Trail } from '../types';
import { userCache } from '../services/userCache';
import { mvtTrailExtractor } from '../services/mvtTrailExtractor';

// Extend Leaflet with VectorGrid types
declare global {
  namespace L {
    namespace vectorGrid {
      function protobuf(url: string, options?: any): any;
    }
  }
}

interface MVTTrailLayerProps {
  onTrailClick?: (trail: Trail | null) => void;
  selectedTrail?: Trail | null;
}

export default function MVTTrailLayer({ onTrailClick, selectedTrail }: MVTTrailLayerProps) {
  const map = useMap();
  const layerRef = useRef<any>(null);
  const popupRef = useRef<L.Popup | null>(null);

  useEffect(() => {
    // Initialize MVT layer directly since VectorGrid is imported
    initializeMVTLayer();

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
      }
    };
  }, [map]);

  const initializeMVTLayer = () => {
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8090';
    const mvtUrl = `${API_BASE_URL}/api/tiles/{z}/{x}/{y}.mvt`;

    // Trail difficulty colors matching the original frontend theme
    const levelColors = {
      'S0': '#22c55e', // Green - Easy
      'S1': '#eab308', // Yellow - Moderate  
      'S2': '#f97316', // Orange - Difficult
      'S3': '#ef4444', // Red - Very Difficult
      'S4': '#8b5cf6', // Purple - Extreme
      'S5': '#ec4899'  // Pink - Expert Only
    };

    const mvtLayer = L.vectorGrid.protobuf(mvtUrl, {
      vectorTileLayerStyles: {
        'trails': (properties: any, zoom: number) => {
          const isSelected = selectedTrail?.id === properties.id;
          
          return {
            weight: isSelected ? 6 : Math.max(3, 8 - zoom * 0.3),
            color: (levelColors as any)[properties.level] || '#3b82f6',
            opacity: isSelected ? 1.0 : 0.8,
            lineCap: 'round',
            lineJoin: 'round',
            // Add glow effect for selected trail
            ...(isSelected && {
              shadowColor: levelColors[properties.level as keyof typeof levelColors] || '#3b82f6',
              shadowOpacity: 0.5,
              shadowWeight: 10
            })
          };
        }
      },
      interactive: true,
      maxZoom: 18,
      getFeatureId: (feature: any) => feature.properties.id
    });

    // Handle trail clicks
    mvtLayer.on('click', async (e: any) => {
      if (e.layer && e.layer.properties && onTrailClick) {
        const props = e.layer.properties;
        
        // Create a Trail object from MVT properties to maintain compatibility
        const trail: Trail = {
          id: props.id,
          name: props.name,
          description: props.description || '',
          level: props.level,
          tags: props.tags || [],
          owner: props.owner_id || '', // MVT provides owner_id
          created: '', // Not available in MVT
          updated: '',  // Not available in MVT
          gpx_file: '', // Not needed for MVT rendering
          collectionId: '',
          collectionName: ''
        };

        // Fetch owner information if available
        if (props.owner_id) {
          const ownerInfo = await userCache.fetchUser(props.owner_id);
          if (ownerInfo) {
            (trail as any).ownerInfo = ownerInfo;
          }
        }

        onTrailClick(trail);

        // Create popup with trail information
        const ownerText = (trail as any).ownerInfo?.name || 'Unknown';
        const popupContent = `
          <div style="font-family: inherit; min-width: 200px;">
            <h4 style="margin: 0 0 10px 0; color: #2c3e50;">${props.name}</h4>
            <p style="margin: 0 0 8px 0;"><strong>Difficulty:</strong> 
              <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: bold; color: white; background: ${(levelColors as any)[props.level] || '#3b82f6'};">
                ${props.level}
              </span>
            </p>
            <p style="margin: 0 0 8px 0;"><strong>Owner:</strong> ${ownerText}</p>
            ${props.description ? `<p style="margin: 0; color: #666; font-size: 12px;">${props.description}</p>` : ''}
          </div>
        `;

        // Close existing popup
        if (popupRef.current) {
          map.closePopup(popupRef.current);
        }

        // Open new popup
        popupRef.current = L.popup()
          .setLatLng(e.latlng)
          .setContent(popupContent)
          .openOn(map);
      }
    });

    // Extract trail data from loaded tiles for sidebar
    mvtLayer.on('tileload', async (e: any) => {
      if (e.tile && e.tile._features) {
        const trailFeatures = e.tile._features['trails'] || [];
        
        // Extract each trail feature and add to trail extractor
        for (const feature of trailFeatures) {
          if (feature.properties) {
            await mvtTrailExtractor.addTrailFromMVT(feature.properties);
          }
        }
      }
    });

    // Clear extracted trails when map moves significantly
    mvtLayer.on('tileunload', (_e: any) => {
      // Note: We don't clear on every tile unload as that would be too aggressive
      // The extractor naturally accumulates trails as user explores
    });

    // Add hover effects
    mvtLayer.on('mouseover', (_e: any) => {
      map.getContainer().style.cursor = 'pointer';
    });

    mvtLayer.on('mouseout', (_e: any) => {
      map.getContainer().style.cursor = '';
    });

    layerRef.current = mvtLayer;
    map.addLayer(mvtLayer);
  };

  // Update layer styles when selectedTrail changes
  useEffect(() => {
    if (layerRef.current) {
      layerRef.current.redraw();
    }
  }, [selectedTrail]);

  return null; // This component doesn't render anything directly
}