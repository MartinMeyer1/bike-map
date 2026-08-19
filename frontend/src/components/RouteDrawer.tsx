import { useState, useEffect, useCallback, useRef, useMemo, useTransition } from 'react';
import { Popup } from 'maplibre-gl';
import type { GeoJSONSource, MapMouseEvent } from 'maplibre-gl';
import type { Feature, FeatureCollection } from 'geojson';
import { useMap } from '../map/useMap';
import {
  LAYER_ROUTE,
  LAYER_WAYPOINTS,
  SOURCE_ROUTE,
  SOURCE_WAYPOINTS,
} from '../map/ids';
import { PathPoint } from '../types';
import { generateGPX, parseGPXDetailed } from '../utils/gpxGenerator';
import { haversineDistance } from '../utils/geo';
import { getToken } from '../utils/colors';
import { PocketBaseService } from '../services/pocketbase';
import { useAppContext } from '../hooks/useAppContext';
import styles from './routeDrawer.module.css';

/** Stroke width of the drawn route, and so the unit its dash is measured in. */
const ROUTE_WIDTH = 6;

/**
 * A waypoint, plus how the leg arriving at it was drawn.
 *
 * `straight` is the drawing mode as it stood when the point was placed: the leg
 * from the previous waypoint to this one goes direct, with no routing call. The
 * first waypoint has no leg, so its flag means nothing.
 */
type DrawnWaypoint = PathPoint & { straight?: boolean };

/**
 * A leg of two points is a straight line, whether it was drawn as one or came
 * back from the router that way -- which is also what a failed route falls back
 * to. This is the only thing the map and the readout need to know about a leg,
 * so nothing is stored alongside the segments and nothing has to survive the GPX
 * round trip: splitRouteIntoSegments recovers a straight leg as its two ends.
 */
const isStraightLeg = (segment: Array<{ lat: number; lng: number }>) => segment.length <= 2;

interface RouteDrawerProps {
  isActive: boolean;
  onRouteComplete: (gpxContent: string) => void;
  onCancel: () => void;
  initialGpxContent?: string;
}

export default function RouteDrawer({ isActive, onRouteComplete, onCancel, initialGpxContent }: RouteDrawerProps) {
  const map = useMap();
  const { setError } = useAppContext();
  const [waypoints, setWaypoints] = useState<DrawnWaypoint[]>([]);
  const [routeSegments, setRouteSegments] = useState<Array<Array<{lat: number, lng: number, ele?: number}>>>([]);
  const [initialWaypoints, setInitialWaypoints] = useState<PathPoint[]>([]);
  const [isCalculatingRoute, startRouteTransition] = useTransition();
  /*
   * Straight-line mode: while it is on, a new point is joined to the previous
   * one by a straight line and BRouter is not called at all. It stays on until
   * it is switched off, which is what makes it useful -- the router only needs
   * overriding for the point or two it cannot handle.
   */
  const [isStraight, setIsStraight] = useState(false);
  const isUndoingRef = useRef(false);
  const lastUserWaypointCountRef = useRef(0);

  // Route points are entirely derived from the accumulated BRouter segments
  // (or, absent those, the raw waypoints) - no need to store them separately.
  const routePointsWithElevation = useMemo(() => {
    if (routeSegments.length === 0) return [];

    // Concatenate all segments, avoiding duplicate points at segment boundaries
    const completeRoute: Array<{lat: number, lng: number, ele?: number}> = [];
    routeSegments.forEach((segment, index) => {
      if (index === 0) {
        // First segment: add all points
        completeRoute.push(...segment);
      } else {
        // Subsequent segments: skip first point to avoid duplication
        completeRoute.push(...segment.slice(1));
      }
    });
    return completeRoute;
  }, [routeSegments]);

  const routePoints = useMemo<PathPoint[]>(() => {
    if (routePointsWithElevation.length === 0) return [...waypoints];
    return routePointsWithElevation.map(p => ({ lat: p.lat, lng: p.lng }));
  }, [waypoints, routePointsWithElevation]);

  // Split a complete route back into segments between waypoints
  const splitRouteIntoSegments = useCallback((completeRoute: Array<{lat: number, lng: number, ele?: number}>, waypoints: PathPoint[]): Array<Array<{lat: number, lng: number, ele?: number}>> => {
    if (waypoints.length < 2 || completeRoute.length < 2) return [];
    
    const segments: Array<Array<{lat: number, lng: number, ele?: number}>> = [];
    
    // For each waypoint pair, find the corresponding route segment
    for (let i = 0; i < waypoints.length - 1; i++) {
      const startWaypoint = waypoints[i];
      const endWaypoint = waypoints[i + 1];
      
      // Find start index in route (closest to start waypoint)
      let startIndex = 0;
      let minStartDist = Infinity;
      for (let j = 0; j < completeRoute.length; j++) {
        const dist = haversineDistance(startWaypoint.lat, startWaypoint.lng, completeRoute[j].lat, completeRoute[j].lng);
        if (dist < minStartDist) {
          minStartDist = dist;
          startIndex = j;
        }
      }
      
      // Find end index in route (closest to end waypoint, after start)
      let endIndex = completeRoute.length - 1;
      let minEndDist = Infinity;
      for (let j = startIndex; j < completeRoute.length; j++) {
        const dist = haversineDistance(endWaypoint.lat, endWaypoint.lng, completeRoute[j].lat, completeRoute[j].lng);
        if (dist < minEndDist) {
          minEndDist = dist;
          endIndex = j;
        }
      }
      
      // Extract segment
      const segment = completeRoute.slice(startIndex, endIndex + 1);
      if (segment.length > 0) {
        segments.push(segment);
      }
    }
    
    return segments;
  }, []);

  // Initialize waypoints from GPX content when drawing becomes active.
  // This is a pure reset driven by props (isActive/initialGpxContent), so it's
  // adjusted during render rather than in an effect - see
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [lastInitKey, setLastInitKey] = useState('');
  const initKey = `${isActive}|${initialGpxContent ?? ''}`;
  if (initKey !== lastInitKey) {
    setLastInitKey(initKey);

    // Every fresh session starts on routing, whichever way the last one ended.
    setIsStraight(false);

    if (!isActive) {
      // Clear state when drawing becomes inactive
      setRouteSegments([]);
    } else {
      const parsedGPX = parseGPXDetailed(initialGpxContent || '');
      const { waypoints: initialWaypoints, route: cachedRoute } = parsedGPX;

      setInitialWaypoints(initialWaypoints);
      setWaypoints(initialWaypoints);

      // Check if we have existing content with both waypoints and computed route
      const hasExisting = initialWaypoints.length > 0 && cachedRoute.length > 0;

      // Cache the computed route and split it into segments, or start fresh
      setRouteSegments(hasExisting ? splitRouteIntoSegments(cachedRoute, initialWaypoints) : []);
    }
  }

  // Keep the incremental-routing waypoint counter (a ref, not state - see the
  // "Update route when waypoints change" effect below) in sync with the reset
  // above. Refs can't be written during render, so this runs as an effect;
  // it's declared before the waypoints-change effect so it primes the ref
  // first within the same commit.
  useEffect(() => {
    lastUserWaypointCountRef.current = isActive ? initialWaypoints.length : 0;
  }, [isActive, initialWaypoints]);

  /*
   * The overlay's sources and layers, alive only while drawing.
   *
   * The route borrows the grade scale's green, blue and red for start, middle
   * and end. Read from the tokens rather than written out: these were literal
   * copies of the old bright palette, so when the scale was darkened they
   * stayed behind as the only vivid thing left on the map.
   */
  useEffect(() => {
    if (!isActive) return;

    const startColor = getToken('--level-s0');
    const midColor = getToken('--level-s1');
    const endColor = getToken('--level-s3');

    const empty: FeatureCollection = { type: 'FeatureCollection', features: [] };

    map.addSource(SOURCE_ROUTE, { type: 'geojson', data: empty });
    map.addSource(SOURCE_WAYPOINTS, { type: 'geojson', data: empty });

    map.addLayer({
      id: LAYER_ROUTE,
      type: 'line',
      source: SOURCE_ROUTE,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': endColor,
        'line-width': ROUTE_WIDTH,
        'line-opacity': 0.85,
        // Leaflet's "5, 5" in pixels, expressed in the line-widths MapLibre
        // measures a dash in.
        'line-dasharray': [
          'case',
          ['get', 'computed'],
          ['literal', [1, 0]],
          ['literal', [5 / ROUTE_WIDTH, 5 / ROUTE_WIDTH]],
        ],
      },
    });

    map.addLayer({
      id: LAYER_WAYPOINTS,
      type: 'circle',
      source: SOURCE_WAYPOINTS,
      paint: {
        'circle-radius': 8,
        'circle-color': [
          'match',
          ['get', 'role'],
          'start', startColor,
          'end', endColor,
          midColor,
        ],
        'circle-opacity': 0.9,
        'circle-stroke-color': getToken('--paper'),
        'circle-stroke-width': 2,
      },
    });

    // One popup, moved and refilled, rather than a tooltip bound to every
    // waypoint and to the line.
    const popup = new Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 12,
    });

    const canvas = map.getCanvas();

    const showLabel = (event: MapMouseEvent & { features?: Feature[] }) => {
      const label = event.features?.[0]?.properties?.label;
      if (typeof label !== 'string') return;

      canvas.style.cursor = 'pointer';
      popup.setLngLat(event.lngLat).setText(label).addTo(map);
    };

    const hideLabel = () => {
      canvas.style.cursor = '';
      popup.remove();
    };

    for (const id of [LAYER_WAYPOINTS, LAYER_ROUTE]) {
      map.on('mousemove', id, showLabel);
      map.on('mouseleave', id, hideLabel);
    }

    return () => {
      for (const id of [LAYER_WAYPOINTS, LAYER_ROUTE]) {
        map.off('mousemove', id, showLabel);
        map.off('mouseleave', id, hideLabel);

        if (map.getLayer(id)) map.removeLayer(id);
      }

      popup.remove();
      canvas.style.cursor = '';

      for (const id of [SOURCE_ROUTE, SOURCE_WAYPOINTS]) {
        if (map.getSource(id)) map.removeSource(id);
      }
    };
  }, [map, isActive]);


  /*
   * Clicks on the map add a waypoint. The panel used to have to be filtered out
   * of this by hand, because it rendered inside the map's own container and its
   * clicks reached the map with it; it is now a sibling of that container, so
   * they never arrive here in the first place.
   */
  useEffect(() => {
    if (!isActive) return;

    const handleMapClick = (event: MapMouseEvent) => {
      if (isUndoingRef.current) {
        return;
      }

      setWaypoints(prev => [
        ...prev,
        { lat: event.lngLat.lat, lng: event.lngLat.lng, straight: isStraight },
      ]);
    };

    map.on('click', handleMapClick);

    return () => {
      map.off('click', handleMapClick);
    };
    // isStraight is read at click time, so the handler is rebound when it
    // changes: the mode a point records is the mode that was showing.
  }, [map, isActive, isStraight]);

  // Function to calculate route between two specific points
  const calculateRouteSegment = useCallback(async (fromPoint: PathPoint, toPoint: PathPoint): Promise<Array<{lat: number, lng: number, ele?: number}>> => {
    try {
      // Format two points for BRouter API
      const lonlats = `${fromPoint.lng},${fromPoint.lat}|${toPoint.lng},${toPoint.lat}`;
      
      
      // BRouter API call with GPX format
      const BROUTER_BASE_URL = import.meta.env.VITE_BROUTER_BASE_URL || 'http://localhost:17777';
      const brouterUrl = `${BROUTER_BASE_URL}/brouter?lonlats=${lonlats}&profile=hiking-mountain&format=gpx`;

      const token = PocketBaseService.getAuthToken();

      const response = await fetch(brouterUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      // Without this check an error body is parsed as GPX, yields no track
      // points, and silently degrades to a straight line.
      if (!response.ok) {
        throw new Error(`BRouter responded ${response.status}`);
      }

      const trackPoints = parseGPXDetailed(await response.text()).route;

      if (trackPoints.length === 0) {
        throw new Error('BRouter returned no track points');
      }

      return trackPoints;
    } catch (error) {
      setError('Could not compute the route, using a straight line instead.');
      console.error('BRouter routing error:', error);
      return [fromPoint, toPoint].map(p => ({...p, ele: undefined})); // Fallback to straight line
    }
  }, [setError]);

  // Calculate elevation gain, loss, and total distance from track points
  const calculateRouteData = useCallback((trackPoints: Array<{lat: number, lng: number, ele?: number}>) => {
    let totalGain = 0;
    let totalLoss = 0;
    let totalDistance = 0;

    for (let i = 1; i < trackPoints.length; i++) {
      const point = trackPoints[i];
      const prevPoint = trackPoints[i - 1];
      
      // Calculate distance
      const distance = haversineDistance(prevPoint.lat, prevPoint.lng, point.lat, point.lng);
      totalDistance += distance;
      
      // Calculate elevation change
      if (point.ele !== undefined && prevPoint.ele !== undefined) {
        const elevChange = point.ele - prevPoint.ele;
        if (elevChange > 0) {
          totalGain += elevChange;
        } else {
          totalLoss += Math.abs(elevChange);
        }
      }
    }

    return {
      gain: totalGain,
      loss: totalLoss,
      distance: totalDistance
    };
  }, []);

  // Update route when waypoints change - handle incrementally.
  // routeSegments accumulates results from real BRouter network calls, so this
  // stays an effect; the state updates are wrapped in a transition (rather than
  // called synchronously) so isCalculatingRoute is derived from the transition's
  // pending status instead of being managed by hand.
  useEffect(() => {
    if (waypoints.length < 2) {
      startRouteTransition(() => {
        setRouteSegments([]);
      });
      lastUserWaypointCountRef.current = waypoints.length;
      return;
    }

    // Only trigger BRouter calls if the user has actually added waypoints
    const currentWaypointCount = waypoints.length;
    const lastWaypointCount = lastUserWaypointCountRef.current;

    if (currentWaypointCount > lastWaypointCount) {
      // User added a waypoint - calculate route from previous waypoint to new one
      const fromPoint = waypoints[waypoints.length - 2];
      const toPoint = waypoints[waypoints.length - 1];

      if (toPoint.straight) {
        // Drawn straight on purpose: the leg *is* its two ends. No router, no
        // network, and so none of the failure handling below either.
        startRouteTransition(() => {
          setRouteSegments(prev => [
            ...prev,
            [fromPoint, toPoint].map(({ lat, lng }) => ({ lat, lng })),
          ]);
        });
      } else {
        startRouteTransition(async () => {
          const newSegment = await calculateRouteSegment(fromPoint, toPoint);
          setRouteSegments(prev => [...prev, newSegment]);
        });
      }

      // Update the cached count
      lastUserWaypointCountRef.current = currentWaypointCount;
    } else if (currentWaypointCount < lastWaypointCount) {
      // User removed a waypoint - remove the last segment
      const segmentsToRemove = lastWaypointCount - currentWaypointCount;
      startRouteTransition(() => {
        setRouteSegments(prev => prev.slice(0, -segmentsToRemove));
      });

      // Update the cached count
      lastUserWaypointCountRef.current = currentWaypointCount;
    }
    // If currentWaypointCount === lastWaypointCount, it's just reinitialization - do nothing
  }, [waypoints, calculateRouteSegment]);

  // Update map display
  useEffect(() => {
    const routeSource = map.getSource(SOURCE_ROUTE) as GeoJSONSource | undefined;
    const waypointSource = map.getSource(SOURCE_WAYPOINTS) as GeoJSONSource | undefined;

    if (!routeSource || !waypointSource) return;

    waypointSource.setData({
      type: 'FeatureCollection',
      features: waypoints.map((point, index) => ({
        type: 'Feature',
        properties: {
          role:
            index === 0
              ? 'start'
              : index === waypoints.length - 1
                ? 'end'
                : 'mid',
          label: `Waypoint ${index + 1}`,
        },
        geometry: { type: 'Point', coordinates: [point.lng, point.lat] },
      })),
    });

    /*
     * One feature per leg rather than one for the whole route, because a route
     * can now mix the two: a leg the router laid out draws solid, one drawn
     * straight -- on purpose, or because the router could not answer -- draws
     * dashed. Until the first segments arrive the raw waypoints stand in, as
     * one straight line through all of them.
     */
    const legs: Feature[] =
      routeSegments.length > 0
        ? routeSegments
            .filter((segment) => segment.length >= 2)
            .map((segment) => {
              const straight = isStraightLeg(segment);

              return {
                type: 'Feature',
                properties: {
                  computed: !straight,
                  label: straight
                    ? 'Straight line — no routing'
                    : 'Route computed by BRouter',
                },
                geometry: {
                  type: 'LineString',
                  coordinates: segment.map((p) => [p.lng, p.lat]),
                },
              };
            })
        : routePoints.length >= 2
          ? [
              {
                type: 'Feature',
                properties: {
                  computed: false,
                  label: 'Straight line between waypoints',
                },
                geometry: {
                  type: 'LineString',
                  coordinates: routePoints.map((p) => [p.lng, p.lat]),
                },
              },
            ]
          : [];

    routeSource.setData({ type: 'FeatureCollection', features: legs });
  }, [map, routePoints, routeSegments, waypoints]);

  const handleUndo = useCallback(() => {
    isUndoingRef.current = true;
    
    setWaypoints(prev => {
      if (prev.length === 0) return prev;
      
      return prev.slice(0, -1);
    });
    
    // Reset the undoing flag after a short delay
    setTimeout(() => {
      isUndoingRef.current = false;
    }, 200);
  }, []);

  const handleComplete = useCallback(() => {
    if (waypoints.length < 2) {
      setError('Please add at least 2 waypoints to create a route');
      return;
    }

    // Use cached route data - no BRouter calls needed
    const pointsToUse = routePointsWithElevation.length > 0 ? routePointsWithElevation : routePoints;
    
    // Generate GPX including elevation data and original waypoints
    const gpxContent = generateGPX(pointsToUse, 'Drawn Route', waypoints);
    onRouteComplete(gpxContent);
  }, [waypoints, routePoints, routePointsWithElevation, onRouteComplete, setError]);

  const handleCancel = useCallback(() => {
    // Generate GPX from initial waypoints to restore previous state
    if (initialWaypoints.length > 0) {
      // Use cached route points if available, otherwise fallback to waypoints
      const pointsToUse = routePointsWithElevation.length > 0 ? routePointsWithElevation : initialWaypoints;
      const restoredGpxContent = generateGPX(pointsToUse, 'Drawn Route', initialWaypoints);
      onRouteComplete(restoredGpxContent);
    } else {
      // If no initial waypoints, proceed with normal cancel
      onCancel();
    }
  }, [initialWaypoints, routePointsWithElevation, onRouteComplete, onCancel]);


  if (!isActive) return null;

  /*
   * Prefer the routed track's own measurements. Climb is only reported when the
   * points actually carry elevation: when BRouter is unreachable the fallback
   * straight lines still produce a route, and a confident "D+ 0m" on those would
   * claim the line is flat rather than unmeasured.
   */
  const trackPoints =
    routePointsWithElevation.length > 0
      ? routePointsWithElevation
      : routePoints.map((p) => ({ ...p, ele: undefined }));
  const hasElevation = trackPoints.some((p) => p.ele !== undefined);
  // A straight leg carries no elevation, so on a mixed route the climb figures
  // are real but partial. Said out loud rather than left to be inferred.
  const hasStraightLeg = routeSegments.some(isStraightLeg);
  const routeData = trackPoints.length > 1 ? calculateRouteData(trackPoints) : null;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.eyebrow}>DRAWING MODE</div>
        <div className={styles.title}>Draw Route</div>
      </div>

      <div className={styles.readout}>
        <div className={styles.measure}>
          <div className={styles.measureLabel}>DISTANCE</div>

          {isCalculatingRoute ? (
            <>
              <div className={styles.distance}>—</div>
              <div className={styles.pending}>COMPUTING ROUTE…</div>
            </>
          ) : routeData ? (
            <>
              <div className={styles.distance}>
                {(routeData.distance / 1000).toFixed(1)} km
              </div>
              {hasElevation ? (
                <>
                  <div className={styles.climb}>
                    <span>D+ {Math.round(routeData.gain)}m</span>
                    <span>D− {Math.round(routeData.loss)}m</span>
                  </div>
                  {hasStraightLeg && (
                    <div className={styles.pending}>STRAIGHT LEGS NOT MEASURED</div>
                  )}
                </>
              ) : (
                <div className={styles.pending}>STRAIGHT LINE — NO ELEVATION</div>
              )}
            </>
          ) : (
            <>
              <div className={styles.distance}>—</div>
              <div className={styles.pending}>NO WAYPOINTS YET</div>
            </>
          )}
        </div>

        <div className={styles.waypoints}>
          <span className={styles.waypointsLabel}>WAYPOINTS</span>
          <span className={styles.waypointsCount}>{waypoints.length}</span>
        </div>
      </div>

      {/*
        * A mode rather than an action, so it stands apart from the button stack
        * below: it changes what the next click does instead of doing something.
        */}
      <div className={styles.mode}>
        <button
          type="button"
          className={`${styles.modeToggle} ${isStraight ? styles.modeToggleOn : ''}`}
          onClick={() => setIsStraight((current) => !current)}
          aria-pressed={isStraight}
        >
          <span className={styles.modeBox} aria-hidden="true"></span>
          <span className={styles.modeLabel}>
            {isStraight ? 'STRAIGHT LINES' : 'FOLLOW PATHS'}
          </span>
        </button>

        <div className={styles.modeHint}>
          {isStraight
            ? 'NEW LEGS GO DIRECT — SWITCH BACK FOR ROUTING'
            : 'BROUTER PICKS THE PATH BETWEEN POINTS'}
        </div>
      </div>

      {/*
        * Two labels per button, one shown at a time: on mobile these sit three
        * across rather than stacked, and the long forms would wrap to three
        * lines each. display:none keeps the hidden one out of the accessibility
        * tree too, so nothing is announced twice.
        */}
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.action}
          onClick={handleUndo}
          disabled={waypoints.length === 0}
        >
          ↶ <span className={styles.labelLong}>UNDO LAST POINT</span>
          <span className={styles.labelShort}>UNDO</span>
        </button>

        <button
          type="button"
          className={`${styles.action} ${styles.actionPrimary}`}
          onClick={handleComplete}
          disabled={routePoints.length < 2}
        >
          ✓ <span className={styles.labelLong}>COMPLETE ROUTE</span>
          <span className={styles.labelShort}>COMPLETE</span>
        </button>

        <button
          type="button"
          className={`${styles.action} ${styles.actionDanger}`}
          onClick={handleCancel}
        >
          ✕ CANCEL
        </button>
      </div>

      {/*
       * Only worth the room until the first point is down: after that the reader
       * has plainly worked it out. Kept always on desktop, where it costs
       * nothing.
       */}
      <div
        className={`${styles.hint} ${waypoints.length > 0 ? styles.hintDone : ''}`}
      >
        CLICK ON MAP TO ADD WAYPOINTS
      </div>
    </div>
  );
}
