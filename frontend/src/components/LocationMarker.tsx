import React, { useRef, useEffect, useImperativeHandle, forwardRef, useCallback } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import controls from './mapControls.module.css';
import marker from './locationMarker.module.css';

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

  // Extract marker creation logic
  const createLocationMarker = useCallback((position: [number, number], currentHeading?: number) => {
    if (markerRef.current) {
      map.removeLayer(markerRef.current);
      markerRef.current = null;
    }

    // Create custom GPS location icon with directional pointer
    const gpsIcon = L.divIcon({
      className: marker.marker,
      html: `
        <div class="${marker.container}">
          <div class="${marker.directionCone}" style="transform: rotate(${currentHeading || 0}deg); opacity: ${typeof currentHeading === 'number' ? 1 : 0.4};"></div>
          <div class="${marker.outer}"></div>
          <div class="${marker.inner}"></div>
          <div class="${marker.dot}"></div>
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
  }), [map, createLocationMarker]);

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
    <div className={`${controls.controls} ${controls.locationControls}`}>
      <button
        className={[
          controls.controlButton,
          isTracking && controls.tracking,
          locationError && controls.hasError,
          isLoading && controls.isLoading,
        ].filter(Boolean).join(' ')}
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
        {/*
         * One crosshair in every state. The button's border and ink already say
         * which state it is in -- muted while locating, red on error, inverted
         * while tracking -- and the title spells it out; swapping in a different
         * glyph per state made the control read as three different buttons.
         */}
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="3.2" />
          <circle cx="12" cy="12" r="7.6" />
          <line x1="12" y1="1.4" x2="12" y2="4.4" />
          <line x1="12" y1="19.6" x2="12" y2="22.6" />
          <line x1="1.4" y1="12" x2="4.4" y2="12" />
          <line x1="19.6" y1="12" x2="22.6" y2="12" />
        </svg>
      </button>
      
    </div>
  );
};