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
  const headingLineRef = useRef<L.Polyline | null>(null);
  const positionRef = useRef<[number, number] | null>(null);
  const isZoomingRef = useRef<boolean>(false);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    centerOnLocation: (zoomLevel: number = 16) => {
      const currentPosition = positionRef.current;
      console.log('centerOnLocation called with position:', currentPosition, 'zoom:', zoomLevel);
      
      if (currentPosition) {
        isZoomingRef.current = true;
        
        map.setView(currentPosition, zoomLevel, {
          animate: true,
          duration: 1
        });
        
        // Reset zooming flag after zoom completes
        setTimeout(() => {
          isZoomingRef.current = false;
          console.log('Zoom completed, creating/updating marker if needed');
          
          // Recreate marker after zoom if it was removed
          if (!markerRef.current && positionRef.current) {
            createLocationMarker(positionRef.current);
          }
        }, 1500); // Wait for zoom animation to complete
        
        console.log('Map centered on location:', currentPosition);
      } else {
        console.warn('No position available for centering');
      }
    },
    getPosition: () => positionRef.current
  }), [map]);

  // Extract marker creation logic
  const createLocationMarker = useCallback((position: [number, number]) => {
    if (markerRef.current) {
      map.removeLayer(markerRef.current);
      markerRef.current = null;
    }
    
    console.log('Creating location marker at:', position);
    
    markerRef.current = L.marker(position, { 
      zIndexOffset: 1000
    }).addTo(map);
    
    console.log('Location marker created successfully');
  }, [map]);

  useEffect(() => {
    const position: [number, number] = [latitude, longitude];
    
    // Check if this is the first location
    const isFirstLocation = !positionRef.current;
    
    // Reduce sensitivity - only update if position changes by more than ~10 meters
    const hasPositionChanged = isFirstLocation || 
      (positionRef.current && (
        Math.abs(positionRef.current[0] - latitude) > 0.0001 || 
        Math.abs(positionRef.current[1] - longitude) > 0.0001
      ));

    // Only proceed if position changed significantly
    if (!hasPositionChanged) return;
    
    // Update position reference
    positionRef.current = position;

    // Don't create marker if we're in the middle of zooming
    if (isZoomingRef.current) {
      console.log('Skipping marker creation during zoom animation');
      return;
    }

    // Create or update the main location marker
    if (!markerRef.current) {
      createLocationMarker(position);
    } else {
      markerRef.current.setLatLng(position);
      console.log('Location marker updated to:', position);
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

    // Create or update heading line
    if (typeof heading === 'number') {
      // Calculate end point for heading line (50 meters in the heading direction)
      const distance = 0.0005; // Approximate degrees for ~50 meters
      const headingRadians = (heading * Math.PI) / 180;
      
      const endLat = latitude + (distance * Math.cos(headingRadians));
      const endLng = longitude + (distance * Math.sin(headingRadians));
      
      const headingLine: [number, number][] = [
        [latitude, longitude],
        [endLat, endLng]
      ];

      if (!headingLineRef.current) {
        headingLineRef.current = L.polyline(headingLine, {
          color: '#007AFF',
          weight: 3,
          opacity: 0.8
        }).addTo(map);
      } else {
        headingLineRef.current.setLatLngs(headingLine);
      }
    } else if (headingLineRef.current) {
      // Remove heading line if not available
      map.removeLayer(headingLineRef.current);
      headingLineRef.current = null;
    }

    // Auto center map if requested
    if (autoCenter) {
      map.setView(position, map.getZoom());
    }

  }, [map, latitude, longitude, accuracy, heading, showAccuracyCircle, autoCenter]);

  // Log when component mounts/unmounts
  useEffect(() => {
    console.log('LocationMarker component mounted');
    return () => {
      console.log('LocationMarker component unmounting');
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    console.log('LocationMarker cleanup effect registered');
    return () => {
      console.log('LocationMarker cleanup executing - removing markers');
      if (markerRef.current) {
        console.log('Removing location marker from map');
        map.removeLayer(markerRef.current);
        markerRef.current = null;
      }
      if (accuracyCircleRef.current) {
        console.log('Removing accuracy circle from map');
        map.removeLayer(accuracyCircleRef.current);
        accuracyCircleRef.current = null;
      }
      if (headingLineRef.current) {
        console.log('Removing heading line from map');
        map.removeLayer(headingLineRef.current);
        headingLineRef.current = null;
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
    console.log('LocationControls clicked', { 
      hasLocation, 
      isTracking, 
      locationError,
      isLoading 
    });
    
    if (isLoading) {
      return; // Do nothing while loading
    }
    
    if (locationError) {
      console.log('Retrying location request due to error');
      onLocationRequest(); // Retry on error
    } else if (hasLocation) {
      console.log('Zooming to existing location');
      onZoomToLocation(); // Zoom to location if we have one
    } else {
      console.log('Requesting new location and will auto-zoom when received');
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
        {isLoading ? '⏳' : locationError ? '⚠️' : isTracking ? '🔵' : hasLocation ? '📍' : '📍'}
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