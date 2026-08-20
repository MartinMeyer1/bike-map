import React, { Fragment, useEffect, useRef, useState } from 'react';
import { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapBounds, MVTTrail } from '../types';
import { MapContext } from '../map/MapContext';
import { useMap } from '../map/useMap';
import { loadBaseStyle } from '../map/vectorStyle';
import { BASE_MAPS, BaseMapId, MAX_ZOOM } from '../map/basemaps';
import { registerEndpointImages } from '../map/markerImages';
import { configureMapWorker } from '../map/worker';
import { isWebGL2Available } from '../map/webgl';
import { clampInset, hasLeftInset, readSidebarWidth } from '../map/insets';
import { TrailsLayer } from './TrailsLayer';
import RouteDrawer from './RouteDrawer';
import { LocationMarker, LocationMarkerRef } from './LocationMarker';
import { UserPosition } from '../hooks/useGeolocation';

/** Valais, Switzerland. MapLibre takes a centre as [lng, lat]. */
const INITIAL_CENTER: [number, number] = [7.65, 46.2];
const INITIAL_ZOOM = 10;

interface MapProps {
  selectedTrail: MVTTrail | null;
  /**
   * Bumped by the context each time a trail is deliberately selected. The map
   * frames the selection when this changes -- not when `selectedTrail` changes
   * identity, which happens whenever the same trail is republished with a fuller
   * record and would otherwise fly the camera back off whatever the reader was
   * looking at.
   */
  trailFocusRequest: number;
  onTrailClick: (trail: MVTTrail | null) => void;
  onTrailsLoaded?: (trails: MVTTrail[]) => void;
  refreshTrigger?: number; // Increment this to trigger MVT refresh
  fitBoundsTarget?: MapBounds | null; // Bounds to fit the map to
  isDrawingActive?: boolean;
  onRouteComplete?: (gpxContent: string) => void;
  onDrawingCancel?: () => void;
  initialGpxContent?: string;
  activeBaseMap?: BaseMapId;
  // Location features
  userLocation?: UserPosition | null;
  showUserLocation?: boolean;
  userHeading?: number;
  locationMarkerRef?: React.RefObject<LocationMarkerRef | null>;
  /**
   * Whether the sidebar is currently drawn over the map's left edge. The map
   * insets its camera by the panel's width so that what it frames stays in the
   * open rather than under the panel.
   */
  hasSidebar?: boolean;
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

/**
 * Frames the selected trail, once per selection.
 *
 * Keyed on the focus request rather than on the trail, so that the camera moves
 * when a trail is chosen and at no other time: the reader is then free to pan
 * away from it and stay away. The trail itself is read through a ref, which is
 * what keeps a re-render with a fresher record from re-arming the effect.
 */
function SelectedTrailHandler({
  selectedTrail,
  trailFocusRequest,
}: {
  selectedTrail: MVTTrail | null;
  trailFocusRequest: number;
}) {
  const map = useMap();
  const trailRef = useRef(selectedTrail);

  // Kept current in an effect rather than during render. This one is declared
  // first, so by the time the effect below runs the ref already holds whatever
  // the render it belongs to was given.
  useEffect(() => {
    trailRef.current = selectedTrail;
  });

  useEffect(() => {
    const bounds = trailRef.current?.bounds;

    // A trail restored from a link that carried no bbox has no real one either;
    // fitting those zeros would fly the map to the Atlantic. FitBoundsHandler
    // guards the same way.
    if (!bounds || bounds.north === 0) {
      return;
    }

    const { south, west, north, east } = bounds;

    map.fitBounds(
      [
        [west, south],
        [east, north],
      ],
      { padding: 20, maxZoom: 16 },
    );
  }, [map, trailFocusRequest]);

  return null;
}

/**
 * Tells the map how much of it the sidebar hides, as viewport padding. With it
 * the camera's centre is the centre of the visible map, so a selected trail is
 * framed in the open instead of half under the panel; without it a fit is
 * measured against a container the panel is sitting on top of.
 */
function ViewportInsetHandler({ hasSidebar }: { hasSidebar: boolean }) {
  const map = useMap();

  useEffect(() => {
    const apply = () => {
      const left = hasSidebar
        ? clampInset(readSidebarWidth(), map.getContainer().clientWidth)
        : 0;

      // Setting padding stops the camera dead, so it is only ever set when it
      // would actually change something -- see hasLeftInset.
      if (hasLeftInset(map.getPadding(), left)) {
        return;
      }

      map.setPadding({ top: 0, right: 0, bottom: 0, left });
    };

    apply();

    // The clamp depends on the container's width, so a window resize can change
    // it -- and apply() is free when it has not.
    map.on('resize', apply);

    return () => {
      map.off('resize', apply);
    };
  }, [map, hasSidebar]);

  return null;
}

function Map({
  selectedTrail,
  trailFocusRequest,
  onTrailClick,
  onTrailsLoaded,
  refreshTrigger,
  fitBoundsTarget,
  isDrawingActive = false,
  onRouteComplete,
  onDrawingCancel,
  initialGpxContent,
  activeBaseMap = 'swisstopo-raster',
  hasSidebar = false,
  userLocation,
  showUserLocation = false,
  userHeading,
  locationMarkerRef,
}: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Held as state rather than a ref so that children mount once the style is
  // ready; every one of them adds a source or a layer in its first effect.
  const [map, setMap] = useState<MapLibreMap | null>(null);
  // A capability of the browser, not something that changes: read once as lazy
  // initial state rather than discovered inside an effect.
  const [isSupported] = useState(isWebGL2Available);

  /*
   * A base map is a whole style document now, not a layer to make visible, so
   * switching one is a real setStyle -- which drops every source, layer and
   * sprite image the app had put on the map. The epoch is what puts them back:
   * the overlay components below are keyed on it, so a style swap unmounts and
   * remounts them, and each one re-runs the effect that adds its own layers.
   * They already guard their cleanups with getLayer/getSource checks, so it
   * does not matter whether they tear down before or after the style goes.
   *
   * The camera handlers are deliberately outside that subtree: remounting
   * SelectedTrailHandler would re-run its fitBounds on every switch and fly the
   * reader back to whatever trail is selected.
   */
  const [styleEpoch, setStyleEpoch] = useState(0);
  const [styleReady, setStyleReady] = useState(false);
  const [initialStyle, setInitialStyle] = useState<StyleSpecification | null>(null);

  // The base map the map is built with. Read once: later changes go through
  // setStyle rather than rebuilding the map.
  const initialBaseMapRef = useRef(activeBaseMap);
  const appliedBaseMapRef = useRef(activeBaseMap);

  // The first style, fetched before the map exists: a vector base map's style
  // is a document on the provider's server, not something to synthesise here.
  useEffect(() => {
    let cancelled = false;

    loadBaseStyle(BASE_MAPS[initialBaseMapRef.current])
      .then((style) => {
        if (!cancelled) {
          setInitialStyle(style);
        }
      })
      .catch((error) => console.error('Failed to load the base map style:', error));

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    if (!isSupported || !initialStyle) {
      return;
    }

    // Before the first Map: MapLibre cannot resolve its own worker under a
    // bundler, and without it every vector tile hangs unreported.
    configureMapWorker();

    const instance = new MapLibreMap({
      container,
      style: initialStyle,
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
      maxZoom: MAX_ZOOM,
      // Leaflet could not rotate or tilt, and there is no compass control here
      // to undo either, so a stray two-finger twist would leave the map askew
      // with no way back.
      //
      // maxPitch is what holds that for the 3D base maps as well. They carry
      // real terrain, but the map is only ever read from straight above -- what
      // the elevation buys there is the parallax high ground picks up as the
      // map is panned, not a view from the side. Pinning the ceiling rather
      // than only the gestures means nothing can tilt it: not a keypress, not
      // an easeTo, not a control added later.
      pitch: 0,
      bearing: 0,
      maxPitch: 0,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      attributionControl: { compact: true },
    });

    instance.touchZoomRotate.disableRotation();

    let cancelled = false;

    instance.on('load', () => {
      // The markers are sprite images, so they have to exist before the symbol
      // layer asks for them by name.
      registerEndpointImages(instance)
        .catch((error) => console.error('Failed to register trail markers:', error))
        .finally(() => {
          if (!cancelled) {
            setMap(instance);
            setStyleReady(true);
          }
        });
    });

    return () => {
      cancelled = true;
      setMap(null);
      setStyleReady(false);

      instance.remove();
    };
  }, [isSupported, initialStyle]);

  // Swapping the base map: fetch the style, hand it over, then let the overlay
  // components put themselves back through a new epoch.
  useEffect(() => {
    if (!map || appliedBaseMapRef.current === activeBaseMap) {
      return;
    }

    appliedBaseMapRef.current = activeBaseMap;

    let cancelled = false;

    setStyleReady(false);

    loadBaseStyle(BASE_MAPS[activeBaseMap])
      .then((style) => {
        if (cancelled) {
          return;
        }

        map.setStyle(style, { diff: false });

        map.once('style.load', () => {
          if (cancelled) {
            return;
          }

          // The sprite does not survive a style, so the markers are registered
          // again before the symbol layer asks for them by name.
          registerEndpointImages(map)
            .catch((error) => console.error('Failed to register trail markers:', error))
            .finally(() => {
              if (!cancelled) {
                setStyleEpoch((epoch) => epoch + 1);
                setStyleReady(true);
              }
            });
        });
      })
      .catch((error) => console.error('Failed to load the base map style:', error));

    return () => {
      cancelled = true;
    };
  }, [map, activeBaseMap]);

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
          {/* Mounted first: the handlers below frame against its padding. */}
          <ViewportInsetHandler hasSidebar={hasSidebar} />

          <FitBoundsHandler fitBoundsTarget={fitBoundsTarget} />

          <SelectedTrailHandler
            selectedTrail={selectedTrail}
            trailFocusRequest={trailFocusRequest}
          />

          {/*
            * Everything that owns a source or a layer, keyed on the style it
            * was added to. A base map switch replaces the style underneath and
            * bumps the epoch, which remounts these and has each one add its
            * layers to the new style.
            */}
          {styleReady && (
            <Fragment key={styleEpoch}>
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
            </Fragment>
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
