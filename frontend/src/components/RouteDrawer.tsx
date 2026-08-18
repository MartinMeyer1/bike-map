import { useState, useEffect, useCallback, useRef, useMemo, useTransition } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { PathPoint } from '../types';
import { generateGPX, parseGPXDetailed } from '../utils/gpxGenerator';
import { haversineDistance } from '../utils/geo';
import { getToken } from '../utils/colors';
import { PocketBaseService } from '../services/pocketbase';
import { useAppContext } from '../hooks/useAppContext';
import styles from './routeDrawer.module.css';

interface RouteDrawerProps {
  isActive: boolean;
  onRouteComplete: (gpxContent: string) => void;
  onCancel: () => void;
  initialGpxContent?: string;
}

export default function RouteDrawer({ isActive, onRouteComplete, onCancel, initialGpxContent }: RouteDrawerProps) {
  const map = useMap();
  const { setError } = useAppContext();
  const [waypoints, setWaypoints] = useState<PathPoint[]>([]);
  const [routeSegments, setRouteSegments] = useState<Array<Array<{lat: number, lng: number, ele?: number}>>>([]);
  const [initialWaypoints, setInitialWaypoints] = useState<PathPoint[]>([]);
  const [isCalculatingRoute, startRouteTransition] = useTransition();
  const isUndoingRef = useRef(false);
  const lastUserWaypointCountRef = useRef(0);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const waypointLayerRef = useRef<L.LayerGroup | null>(null);

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

  // Initialize layers
  useEffect(() => {
    if (!map || !isActive) return;

    const rLayer = new L.LayerGroup();
    const wLayer = new L.LayerGroup();
    
    map.addLayer(rLayer);
    map.addLayer(wLayer);

    routeLayerRef.current = rLayer;
    waypointLayerRef.current = wLayer;

    return () => {
      if (map.hasLayer(rLayer)) map.removeLayer(rLayer);
      if (map.hasLayer(wLayer)) map.removeLayer(wLayer);
      routeLayerRef.current = null;
      waypointLayerRef.current = null;
    };
  }, [map, isActive]);


  useEffect(() => {
    if (!map || !isActive) return;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      if (isUndoingRef.current) {
        return;
      }
      
      // Check if the click event originated from the RouteDrawer panel
      // This prevents clicks on the panel from adding waypoints
      const target = e.originalEvent?.target as HTMLElement;
      if (target && target.closest('[data-route-drawer-panel]')) {
        return;
      }
      
      setWaypoints(prev => {

        const newPoint: PathPoint = {
          lat: e.latlng.lat,
          lng: e.latlng.lng,
        };


        return [...prev, newPoint];
      });
    };

    map.on('click', handleMapClick);
    
    return () => {
      map.off('click', handleMapClick);
    };
  }, [map, isActive]);

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

      startRouteTransition(async () => {
        const newSegment = await calculateRouteSegment(fromPoint, toPoint);
        setRouteSegments(prev => [...prev, newSegment]);
      });

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
    const routeLayer = routeLayerRef.current;
    const waypointLayer = waypointLayerRef.current;
    if (!routeLayer || !waypointLayer) return;

    // Clear existing layers
    routeLayer.clearLayers();
    waypointLayer.clearLayers();

    /*
     * The overlay borrows the grade scale's green, blue and red for start,
     * middle and end. Read from the tokens rather than written out: these were
     * literal copies of the old bright palette, so when the scale was darkened
     * they stayed behind as the only vivid thing left on the map.
     */
    const startColor = getToken('--level-s0');
    const midColor = getToken('--level-s1');
    const endColor = getToken('--level-s3');

    // Draw waypoints
    waypoints.forEach((point, index) => {
      const marker = L.circleMarker([point.lat, point.lng], {
        radius: 8,
        fillColor: index === 0 ? startColor : index === waypoints.length - 1 ? endColor : midColor,
        color: getToken('--paper'),
        weight: 2,
        opacity: 1,
        fillOpacity: 0.9,
      });

      marker.bindTooltip(`Waypoint ${index + 1}`, { permanent: false });
      waypointLayer.addLayer(marker);
    });

    // Draw route - either computed by BRouter or straight lines as fallback
    if (routePoints.length >= 2) {
      const isComputedRoute = routePoints.length > waypoints.length;

      const polyline = L.polyline(
        routePoints.map((p): L.LatLngTuple => [p.lat, p.lng]),
        {
          color: endColor,
          weight: 6,
          opacity: 0.85,
          dashArray: isComputedRoute ? undefined : '5, 5'
        }
      );
      routeLayer.addLayer(polyline);
      
      const tooltipText = isComputedRoute 
        ? 'Route computed by BRouter' 
        : 'Fallback: straight line between waypoints';
      polyline.bindTooltip(tooltipText, { permanent: false });
    }
  }, [routePoints, waypoints]);

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
  const routeData = trackPoints.length > 1 ? calculateRouteData(trackPoints) : null;

  return (
    <div
      data-route-drawer-panel
      className={styles.panel}
      onClick={(e) => {
        e.stopPropagation();
      }}
    >
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
                <div className={styles.climb}>
                  <span>D+ {Math.round(routeData.gain)}m</span>
                  <span>D− {Math.round(routeData.loss)}m</span>
                </div>
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

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.action}
          onClick={(e) => {
            e.stopPropagation();
            handleUndo();
          }}
          disabled={waypoints.length === 0}
        >
          ↶ UNDO LAST POINT
        </button>

        <button
          type="button"
          className={`${styles.action} ${styles.actionPrimary}`}
          onClick={(e) => {
            e.stopPropagation();
            handleComplete();
          }}
          disabled={routePoints.length < 2}
        >
          ✓ COMPLETE ROUTE
        </button>

        <button
          type="button"
          className={`${styles.action} ${styles.actionDanger}`}
          onClick={(e) => {
            e.stopPropagation();
            handleCancel();
          }}
        >
          ✕ CANCEL
        </button>

        <div className={styles.hint}>CLICK ON MAP TO ADD WAYPOINTS</div>
      </div>
    </div>
  );
}
