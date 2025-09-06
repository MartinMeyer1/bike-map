import React, { useRef, useEffect, useImperativeHandle, forwardRef, useCallback } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

interface LocationMarkerProps {
  latitude: number;
  longitude: number;
  accuracy?: number;
  heading?: number;
  showAccuracyCircle?: boolean;
  autoCenter?: boolean;
}

export interface LocationMarkerRef {
  centerOnLocation: (zoomLevel?: number) => void;
  getPosition: () => [number, number] | null;
}

export const LocationMarker = forwardRef<LocationMarkerRef, LocationMarkerProps>(({
  latitude,
  longitude,
  accuracy,
  heading,
  showAccuracyCircle = true,
  autoCenter = false
}, ref) => {
  const map = useMap();
  const markerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const positionRef = useRef<[number, number] | null>(null);
  const isZoomingRef = useRef<boolean>(false);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    centerOnLocation: (zoomLevel: number = 16) => {
      const currentPosition = positionRef.current;
      
      if (currentPosition) {
        isZoomingRef.current = true;
        
        map.setView(currentPosition, zoomLevel, {
          animate: true,
          duration: 1
        });
        
        // Reset zooming flag after zoom completes
        setTimeout(() => {
          isZoomingRef.current = false;
          
          // Recreate marker after zoom if it was removed
          if (!markerRef.current && positionRef.current) {
            createLocationMarker(positionRef.current);
          }
        }, 1500); // Wait for zoom animation to complete
      }
    },
    getPosition: () => positionRef.current
  }), [map]);

  // Extract marker creation logic
  const createLocationMarker = useCallback((position: [number, number], currentHeading?: number) => {
    if (markerRef.current) {
      map.removeLayer(markerRef.current);
      markerRef.current = null;
    }
    
    // Create custom GPS location icon with directional pointer
    const gpsIcon = L.divIcon({
      className: 'gps-location-marker',
      html: `
        <div class="gps-marker-container">
          <div class="gps-direction-cone" style="transform: rotate(${currentHeading || 0}deg); opacity: ${typeof currentHeading === 'number' ? 1 : 0.4};"></div>
          <div class="gps-marker-outer"></div>
          <div class="gps-marker-inner"></div>
          <div class="gps-marker-dot"></div>
        </div>
      `,
      iconSize: [60, 60],
      iconAnchor: [30, 45]
    });
    
    markerRef.current = L.marker(position, { 
      icon: gpsIcon,
      zIndexOffset: 1000
    }).addTo(map);
  }, [map]);

  useEffect(() => {
    const position: [number, number] = [latitude, longitude];
    
    // Check if this is the first location
    const isFirstLocation = !positionRef.current;
    
    // Reduce sensitivity - only update if position changes by more than ~1 meters
    const hasPositionChanged = isFirstLocation || 
      (positionRef.current && (
        Math.abs(positionRef.current[0] - latitude) > 0.00001 || 
        Math.abs(positionRef.current[1] - longitude) > 0.00001
      ));

    // Only proceed if position changed significantly
    if (!hasPositionChanged) return;
    
    // Update position reference
    positionRef.current = position;

    // Don't create marker if we're in the middle of zooming
    if (isZoomingRef.current) {
      return;
    }

    // Create or update the main location marker
    if (!markerRef.current) {
      createLocationMarker(position, heading);
    } else {
      // Update position
      markerRef.current.setLatLng(position);
      // Always recreate marker to update heading (even if undefined)
      createLocationMarker(position, heading);
    }

    // Create or update accuracy circle
    if (accuracy && accuracy > 0 && showAccuracyCircle) {
      if (!accuracyCircleRef.current) {
        accuracyCircleRef.current = L.circle(position, {
          radius: accuracy,
          fillColor: '#007AFF',
          fillOpacity: 0.1,
          color: '#007AFF',
          opacity: 0.3,
          weight: 1
        }).addTo(map);
      } else {
        accuracyCircleRef.current
          .setLatLng(position)
          .setRadius(accuracy);
      }
    } else if (accuracyCircleRef.current) {
      // Remove accuracy circle if not needed
      map.removeLayer(accuracyCircleRef.current);
      accuracyCircleRef.current = null;
    }


    // Auto center map if requested
    if (autoCenter) {
      map.setView(position, map.getZoom());
    }

  }, [map, latitude, longitude, accuracy, heading, showAccuracyCircle, autoCenter, createLocationMarker]);


  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (markerRef.current) {
        map.removeLayer(markerRef.current);
        markerRef.current = null;
      }
      if (accuracyCircleRef.current) {
        map.removeLayer(accuracyCircleRef.current);
        accuracyCircleRef.current = null;
      }
    };
  }, [map]);

  return null; // This component doesn't render anything directly
});

LocationMarker.displayName = 'LocationMarker';

// Component for location controls
export const LocationControls: React.FC<{
  onLocationRequest: () => void;
  onToggleTracking: () => void;
  onZoomToLocation: () => void;
  isTracking: boolean;
  hasLocation: boolean;
  isLoading?: boolean;
  locationError?: string | null;
}> = ({
  onLocationRequest,
  onToggleTracking,
  onZoomToLocation,
  isTracking,
  hasLocation,
  isLoading = false,
  locationError
}) => {
  const handleClick = () => {
    if (isLoading) {
      return; // Do nothing while loading
    }
    
    if (locationError) {
      onLocationRequest(); // Retry on error
    } else if (hasLocation) {
      onZoomToLocation(); // Zoom to location if we have one
    } else {
      onLocationRequest(); // Get location if we don't have one
    }
  };

  const handleDoubleClick = () => {
    if (hasLocation) {
      onToggleTracking(); // Toggle tracking on double click
    }
  };

  return (
    <div className="location-controls">
      <button
        className={`location-button ${isTracking ? 'tracking' : ''} ${locationError ? 'error' : ''} ${isLoading ? 'loading' : ''}`}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        disabled={isLoading}
        title={
          isLoading
            ? 'Getting location...'
            : locationError 
              ? `Location error: ${locationError} (click to retry)`
              : hasLocation
                ? isTracking
                  ? 'Click to zoom to location, double-click to stop tracking'
                  : 'Click to zoom to location, double-click to start tracking'
                : 'Click to get current location'
        }
      >
        {isLoading ? '⏳' : locationError ? '⚠️' : isTracking ? '📍' : hasLocation ? '📍' : '📍'}
      </button>
      
      <style>{`
        .location-controls {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 1000;
        }
        
        .location-button {
          width: 48px;
          height: 48px;
          background: white;
          border: 2px solid #007AFF;
          border-radius: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
          transition: all 0.2s ease;
        }
        
        .location-button:hover {
          background: #f0f8ff;
          transform: scale(1.05);
        }
        
        .location-button.tracking {
          background: #007AFF;
          color: white;
          animation: pulse 2s infinite;
        }
        
        .location-button.error {
          border-color: #FF3B30;
          background: #fff5f5;
        }
        
        .location-button.loading {
          border-color: #FF9500;
          background: #fff8f0;
        }
        
        .location-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        
        /* GPS Location Marker Styles */
        .gps-location-marker {
          background: none !important;
          border: none !important;
        }
        
        .gps-marker-container {
          position: relative;
          width: 60px;
          height: 60px;
        }
        
        .gps-marker-outer {
          position: absolute;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 28px;
          height: 28px;
          background: rgba(0, 122, 255, 0.2);
          border: 2px solid #007AFF;
          border-radius: 50%;
          animation: gps-pulse 2s ease-out infinite;
        }
        
        .gps-marker-inner {
          position: absolute;
          bottom: 6px;
          left: 50%;
          transform: translateX(-50%);
          width: 16px;
          height: 16px;
          background: #007AFF;
          border: 2px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
        
        .gps-marker-dot {
          position: absolute;
          bottom: 11px;
          left: 50%;
          transform: translateX(-50%);
          width: 6px;
          height: 6px;
          background: white;
          border-radius: 50%;
        }
        
        .gps-direction-cone {
          position: absolute;
          bottom: 14px; /* Position from bottom edge, centering on the dot */
          left: 50%;
          transform-origin: 50% 100%; /* Rotate around bottom center */
          width: 40px;
          height: 40px;
          background: linear-gradient(to top, rgba(0, 122, 255, 0.8) 0%, rgba(0, 122, 255, 0.5) 50%, rgba(0, 122, 255, 0.2) 100%);
          clip-path: polygon(50% 100%, 20% 20%, 80% 20%);
          pointer-events: none;
          transition: transform 0.3s ease-out;
          margin-left: -20px; /* Center the 40px width */
          z-index: -1; /* Behind the circular marker */
        }
        
        
        @keyframes gps-pulse {
          0% {
            transform: translateX(-50%) scale(0.8);
            opacity: 1;
          }
          100% {
            transform: translateX(-50%) scale(1.5);
            opacity: 0;
          }
        }
        
        @media (max-width: 768px) {
          .location-controls {
            top: 60px;
            right: 16px;
          }
          
          .location-button {
            width: 44px;
            height: 44px;
            font-size: 18px;
          }
        }
      `}</style>
    </div>
  );
};