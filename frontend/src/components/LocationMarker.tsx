import React, { useRef, useEffect, useImperativeHandle, forwardRef, useCallback } from 'react';
import { Marker } from 'maplibre-gl';
import type { GeoJSONSource } from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import { useMap } from '../map/useMap';
import {
  LAYER_ACCURACY_FILL,
  LAYER_ACCURACY_LINE,
  SOURCE_ACCURACY,
} from '../map/ids';
import { circlePolygon } from '../utils/geo';
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

/** How long the camera takes to reach the user's position, in milliseconds. */
const CENTER_DURATION_MS = 1000;

/** Ignore jitter below roughly a metre. */
const MIN_MOVE_DEGREES = 0.00001;

const EMPTY_ACCURACY: FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};

function accuracyFeature(
  latitude: number,
  longitude: number,
  accuracy: number,
): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [circlePolygon(latitude, longitude, accuracy)],
        },
      },
    ],
  };
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
  const markerRef = useRef<Marker | null>(null);
  const coneRef = useRef<HTMLDivElement | null>(null);
  const positionRef = useRef<[number, number] | null>(null);

  // The marker's element, built once and then only ever updated. Leaflet's
  // divIcon baked the heading into an HTML string, so every compass reading
  // meant tearing the marker down and building a new one; here the cone is a
  // node we keep hold of and restyle, which is also what lets its CSS
  // transition smooth out a jittery compass.
  const createMarker = useCallback(() => {
    const element = document.createElement('div');
    element.className = marker.container;

    const cone = document.createElement('div');
    cone.className = marker.directionCone;

    const outer = document.createElement('div');
    outer.className = marker.outer;

    const inner = document.createElement('div');
    inner.className = marker.inner;

    const dot = document.createElement('div');
    dot.className = marker.dot;

    element.append(cone, outer, inner, dot);
    coneRef.current = cone;

    // The old icon was a 60x60 box anchored at (30, 45) -- the dot near its
    // bottom, not the middle of the box. Centring the element and lifting it by
    // the difference puts that same point on the coordinate.
    return new Marker({ element, anchor: 'center', offset: [0, -15] });
  }, []);

  useImperativeHandle(ref, () => ({
    centerOnLocation: (zoomLevel: number = 16) => {
      const position = positionRef.current;

      if (!position) {
        return;
      }

      // Nothing to guard against here any more: a camera move does not touch
      // markers, so the marker cannot be destroyed mid-flight the way Leaflet's
      // was -- which is what the old zoom flag and its 1.5s timeout existed for.
      map.easeTo({
        center: [position[1], position[0]],
        zoom: zoomLevel,
        duration: CENTER_DURATION_MS,
      });
    },
    getPosition: () => positionRef.current
  }), [map]);

  // The accuracy disc, as a real polygon so its radius stays in metres.
  useEffect(() => {
    map.addSource(SOURCE_ACCURACY, { type: 'geojson', data: EMPTY_ACCURACY });

    map.addLayer({
      id: LAYER_ACCURACY_FILL,
      type: 'fill',
      source: SOURCE_ACCURACY,
      paint: { 'fill-color': '#007AFF', 'fill-opacity': 0.1 },
    });

    map.addLayer({
      id: LAYER_ACCURACY_LINE,
      type: 'line',
      source: SOURCE_ACCURACY,
      paint: { 'line-color': '#007AFF', 'line-opacity': 0.3, 'line-width': 1 },
    });

    return () => {
      for (const id of [LAYER_ACCURACY_LINE, LAYER_ACCURACY_FILL]) {
        if (map.getLayer(id)) {
          map.removeLayer(id);
        }
      }

      if (map.getSource(SOURCE_ACCURACY)) {
        map.removeSource(SOURCE_ACCURACY);
      }
    };
  }, [map]);

  useEffect(() => {
    const previous = positionRef.current;

    const hasMoved =
      !previous ||
      Math.abs(previous[0] - latitude) > MIN_MOVE_DEGREES ||
      Math.abs(previous[1] - longitude) > MIN_MOVE_DEGREES;

    if (hasMoved) {
      positionRef.current = [latitude, longitude];

      if (!markerRef.current) {
        markerRef.current = createMarker().setLngLat([longitude, latitude]).addTo(map);
      } else {
        markerRef.current.setLngLat([longitude, latitude]);
      }

      if (autoCenter) {
        map.setCenter([longitude, latitude]);
      }
    }

    // Heading changes on its own cadence, so it is applied whether or not the
    // position moved.
    if (coneRef.current) {
      coneRef.current.style.transform = `rotate(${heading ?? 0}deg)`;
      coneRef.current.style.opacity = typeof heading === 'number' ? '1' : '0.4';
    }

    const source = map.getSource(SOURCE_ACCURACY) as GeoJSONSource | undefined;

    if (source) {
      source.setData(
        accuracy && accuracy > 0 && showAccuracyCircle
          ? accuracyFeature(latitude, longitude, accuracy)
          : EMPTY_ACCURACY,
      );
    }
  }, [map, latitude, longitude, accuracy, heading, showAccuracyCircle, autoCenter, createMarker]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
      coneRef.current = null;
    };
  }, []);

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
