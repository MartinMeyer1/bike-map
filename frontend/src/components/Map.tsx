import React, { useEffect, useRef, useState } from 'react';
import { Map as MapLibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapBounds, MVTTrail } from '../types';
import { MapContext } from '../map/MapContext';
import { useMap } from '../map/useMap';
import { buildStyle } from '../map/style';
import { BASE_MAPS, BASE_MAP_TYPES, BaseMapType, MAX_ZOOM } from '../map/basemaps';
import { registerEndpointImages } from '../map/markerImages';
import { isWebGL2Available } from '../map/webgl';
import { TrailsLayer } from './TrailsLayer';
import RouteDrawer from './RouteDrawer';
import { LocationMarker, LocationMarkerRef } from './LocationMarker';
import { UserPosition } from '../hooks/useGeolocation';

/** Valais, Switzerland. MapLibre takes a centre as [lng, lat]. */
const INITIAL_CENTER: [number, number] = [7.65, 46.2];
const INITIAL_ZOOM = 10;

interface MapProps {
  selectedTrail: MVTTrail | null;
  onTrailClick: (trail: MVTTrail | null) => void;
  onTrailsLoaded?: (trails: MVTTrail[]) => void;
  refreshTrigger?: number; // Increment this to trigger MVT refresh
  fitBoundsTarget?: MapBounds | null; // Bounds to fit the map to
  isDrawingActive?: boolean;
  onRouteComplete?: (gpxContent: string) => void;
  onDrawingCancel?: () => void;
  initialGpxContent?: string;
  activeBaseMap?: BaseMapType;
  // Location features
  userLocation?: UserPosition | null;
  showUserLocation?: boolean;
  userHeading?: number;
  locationMarkerRef?: React.RefObject<LocationMarkerRef | null>;
  /**
   * The map itself, for App's own camera work. It no longer needs it to keep
   * the map's size honest: MapLibre watches its container with a ResizeObserver
   * and re-measures on its own, so the invalidateSize call the mobile sheet used
   * to make after every drag is gone.
   */
  mapRef?: React.RefObject<MapLibreMap | null>;
}

/** Pans and zooms to an explicit bounding box, e.g. from a shared link. */
function FitBoundsHandler({ fitBoundsTarget }: { fitBoundsTarget?: MapBounds | null }) {
  const map = useMap();

  useEffect(() => {
    if (fitBoundsTarget && fitBoundsTarget.north !== 0) {
      map.fitBounds(
        [
          [fitBoundsTarget.west, fitBoundsTarget.south],
          [fitBoundsTarget.east, fitBoundsTarget.north],
        ],
        { padding: 50, maxZoom: 14 },
      );
    }
  }, [fitBoundsTarget, map]);

  return null;
}

/** Frames the selected trail. */
function SelectedTrailHandler({ selectedTrail }: { selectedTrail: MVTTrail | null }) {
  const map = useMap();

  useEffect(() => {
    if (!selectedTrail?.bounds) {
      return;
    }

    const { south, west, north, east } = selectedTrail.bounds;

    map.fitBounds(
      [
        [west, south],
        [east, north],
      ],
      { padding: 20, maxZoom: 16 },
    );
  }, [map, selectedTrail]);

  return null;
}

/** Swaps base maps by visibility, so neither source is torn down. */
function BaseMapHandler({ activeBaseMap }: { activeBaseMap: BaseMapType }) {
  const map = useMap();

  useEffect(() => {
    for (const type of BASE_MAP_TYPES) {
      const { layerId } = BASE_MAPS[type];

      if (map.getLayer(layerId)) {
        map.setLayoutProperty(
          layerId,
          'visibility',
          type === activeBaseMap ? 'visible' : 'none',
        );
      }
    }
  }, [map, activeBaseMap]);

  return null;
}

function Map({
  selectedTrail,
  onTrailClick,
  onTrailsLoaded,
  refreshTrigger,
  fitBoundsTarget,
  isDrawingActive = false,
  onRouteComplete,
  onDrawingCancel,
  initialGpxContent,
  activeBaseMap = 'swisstopo',
  userLocation,
  showUserLocation = false,
  userHeading,
  locationMarkerRef,
  mapRef
}: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Held as state rather than a ref so that children mount once the style is
  // ready; every one of them adds a source or a layer in its first effect.
  const [map, setMap] = useState<MapLibreMap | null>(null);
  // A capability of the browser, not something that changes: read once as lazy
  // initial state rather than discovered inside an effect.
  const [isSupported] = useState(isWebGL2Available);

  // The base map the map is built with. Read once: later changes are a
  // visibility toggle, not a reason to rebuild the map.
  const initialBaseMapRef = useRef(activeBaseMap);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    if (!isSupported) {
      return;
    }

    const instance = new MapLibreMap({
      container,
      style: buildStyle(initialBaseMapRef.current),
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
      maxZoom: MAX_ZOOM,
      // Leaflet could not rotate or tilt, and there is no compass control here
      // to undo either, so a stray two-finger twist would leave the map askew
      // with no way back.
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      attributionControl: { compact: true },
    });

    instance.touchZoomRotate.disableRotation();

    if (mapRef) {
      mapRef.current = instance;
    }

    let cancelled = false;

    instance.on('load', () => {
      // The markers are sprite images, so they have to exist before the symbol
      // layer asks for them by name.
      registerEndpointImages(instance)
        .catch((error) => console.error('Failed to register trail markers:', error))
        .finally(() => {
          if (!cancelled) {
            setMap(instance);
          }
        });
    });

    return () => {
      cancelled = true;
      setMap(null);

      if (mapRef) {
        mapRef.current = null;
      }

      instance.remove();
    };
  }, [isSupported, mapRef]);

  if (!isSupported) {
    return (
      <div className="mapUnsupported">
        <p>This map needs WebGL 2, which this browser has turned off or does not support.</p>
        <p>Try a different browser, or enable hardware acceleration in its settings.</p>
      </div>
    );
  }

  return (
    <>
      {/* Fills whatever the shell gives it: the full viewport on desktop, the
          space above the sheet on mobile. */}
      <div ref={containerRef} className="mapCanvas" />

      {/*
        * Everything below draws on the map, so none of it mounts until the
        * style has loaded. The route drawer's panel is a sibling of the map's
        * container rather than a child of it, which is why it no longer has to
        * filter its own clicks back out of the map's click handler.
        */}
      {map && (
        <MapContext.Provider value={map}>
          <BaseMapHandler activeBaseMap={activeBaseMap} />

          <FitBoundsHandler fitBoundsTarget={fitBoundsTarget} />

          <SelectedTrailHandler selectedTrail={selectedTrail} />

          {!isDrawingActive && (
            <TrailsLayer
              selectedTrail={selectedTrail}
              onTrailClick={onTrailClick}
              onTrailsLoaded={onTrailsLoaded}
              refreshTrigger={refreshTrigger}
            />
          )}

          <RouteDrawer
            isActive={isDrawingActive}
            onRouteComplete={onRouteComplete || (() => {})}
            onCancel={onDrawingCancel || (() => {})}
            initialGpxContent={initialGpxContent}
          />

          {showUserLocation && userLocation && (
            <LocationMarker
              ref={locationMarkerRef}
              latitude={userLocation.latitude}
              longitude={userLocation.longitude}
              accuracy={userLocation.accuracy}
              heading={userHeading}
              showAccuracyCircle={true}
              autoCenter={false}
            />
          )}
        </MapContext.Provider>
      )}
    </>
  );
}

// Memoized because every prop it takes is already referentially stable (context
// callbacks are useCallback'd, refs are refs). Without this, any state change in
// AppContent re-reconciles the whole map subtree on every render.
export default React.memo(Map);
