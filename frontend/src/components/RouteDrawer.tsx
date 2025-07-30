import { useState, useEffect, useCallback, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { 
  PathPoint, 
  PATHFINDING_CONFIG
} from '../utils/pathfinding';
import { generateGPX, parseGPX, parseGPXDetailed } from '../utils/gpxGenerator';

interface RouteDrawerProps {
  isActive: boolean;
  onRouteComplete: (gpxContent: string) => void;
  onCancel: () => void;
  initialGpxContent?: string;
}

export default function RouteDrawer({ isActive, onRouteComplete, onCancel, initialGpxContent }: RouteDrawerProps) {
  const map = useMap();
  const [waypoints, setWaypoints] = useState<PathPoint[]>([]);
  const [routePoints, setRoutePoints] = useState<PathPoint[]>([]);
  const [routeSegments, setRouteSegments] = useState<Array<Array<{lat: number, lng: number, ele?: number}>>>([]);
  const [routeLayer, setRouteLayer] = useState<L.LayerGroup | null>(null);
  const [waypointLayer, setWaypointLayer] = useState<L.LayerGroup | null>(null);
  const [initialWaypoints, setInitialWaypoints] = useState<PathPoint[]>([]);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [routePointsWithElevation, setRoutePointsWithElevation] = useState<Array<{lat: number, lng: number, ele?: number}>>([]);
  const [hasExistingRoute, setHasExistingRoute] = useState(false);
  const isUndoingRef = useRef(false);
  const lastUserWaypointCountRef = useRef(0);

  // Calculate distance between two lat/lng points in meters (Haversine formula)
  const calculateDistance = useCallback((lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }, []);

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
        const dist = calculateDistance(startWaypoint.lat, startWaypoint.lng, completeRoute[j].lat, completeRoute[j].lng);
        if (dist < minStartDist) {
          minStartDist = dist;
          startIndex = j;
        }
      }
      
      // Find end index in route (closest to end waypoint, after start)
      let endIndex = completeRoute.length - 1;
      let minEndDist = Infinity;
      for (let j = startIndex; j < completeRoute.length; j++) {
        const dist = calculateDistance(endWaypoint.lat, endWaypoint.lng, completeRoute[j].lat, completeRoute[j].lng);
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
  }, [calculateDistance]);

  // Initialize waypoints from GPX content when drawing becomes active
  useEffect(() => {
        if (!isActive) {
      // Clear state when drawing becomes inactive
            setRoutePointsWithElevation([]);
      setRouteSegments([]);
      setHasExistingRoute(false);
      lastUserWaypointCountRef.current = 0;
            return;
    }
    
    const parsedGPX = parseGPXDetailed(initialGpxContent || '');
    const { waypoints: initialWaypoints, route: cachedRoute } = parsedGPX;
    
    setInitialWaypoints(initialWaypoints);
    setWaypoints(initialWaypoints);
    
    // Initialize the user waypoint count with existing waypoints
    lastUserWaypointCountRef.current = initialWaypoints.length;
    
    // Check if we have existing content with both waypoints and computed route
    const hasExisting = initialWaypoints.length > 0 && cachedRoute.length > 0;
    setHasExistingRoute(hasExisting);
    
    if (hasExisting) {
      // Cache the computed route and split it into segments
      const reconstructedSegments = splitRouteIntoSegments(cachedRoute, initialWaypoints);
      setRouteSegments(reconstructedSegments);
    } else {
      // Starting fresh - clear route data
      setRoutePointsWithElevation([]);
      setRouteSegments([]);
    }
    
  }, [isActive, initialGpxContent, splitRouteIntoSegments]);

  // Initialize layers
  useEffect(() => {
    if (!map || !isActive) return;

    const rLayer = new L.LayerGroup();
    const wLayer = new L.LayerGroup();
    
    map.addLayer(rLayer);
    map.addLayer(wLayer);
    
    setRouteLayer(rLayer);
    setWaypointLayer(wLayer);

    return () => {
      if (map.hasLayer(rLayer)) map.removeLayer(rLayer);
      if (map.hasLayer(wLayer)) map.removeLayer(wLayer);
    };
  }, [map, isActive]);


  // Handle map clicks to add waypoints
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
        if (prev.length >= PATHFINDING_CONFIG.MAX_WAYPOINTS) {
          alert(`Maximum ${PATHFINDING_CONFIG.MAX_WAYPOINTS} waypoints allowed`);
          return prev;
        }

        const newPoint: PathPoint = {
          lat: e.latlng.lat,
          lng: e.latlng.lng,
        };

        // User is adding a new waypoint - routing will be handled automatically

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
      const brouterUrl = `http://localhost:17777/brouter?lonlats=${lonlats}&profile=hiking-mountain&format=gpx`;
      
      const response = await fetch(brouterUrl);
      if (!response.ok) {
        console.error('BRouter API error:', response.status, response.statusText);
        return [fromPoint, toPoint].map(p => ({...p, ele: undefined})); // Fallback to straight line
      }
      
      const gpxText = await response.text();
      
      // Parse GPX to extract track points
      const parser = new DOMParser();
      const gpxDoc = parser.parseFromString(gpxText, 'application/xml');
      
      // Extract track points from GPX including elevation data
      const trackPoints: Array<{lat: number, lng: number, ele?: number}> = [];
      const trkpts = gpxDoc.querySelectorAll('trkpt');
      
      trkpts.forEach(trkpt => {
        const lat = parseFloat(trkpt.getAttribute('lat') || '0');
        const lon = parseFloat(trkpt.getAttribute('lon') || '0');
        const eleElement = trkpt.querySelector('ele');
        const elevation = eleElement ? parseFloat(eleElement.textContent || '0') : undefined;
        
        if (lat && lon) {
          trackPoints.push({ lat, lng: lon, ele: elevation });
        }
      });
      
      return trackPoints.length > 0 ? trackPoints : [fromPoint, toPoint].map(p => ({...p, ele: undefined}));
    } catch (error) {
      console.error('BRouter routing error:', error);
      return [fromPoint, toPoint].map(p => ({...p, ele: undefined})); // Fallback to straight line
    }
  }, []);

  // Calculate elevation gain, loss, and total distance from track points
  const calculateRouteData = useCallback((trackPoints: Array<{lat: number, lng: number, ele?: number}>) => {
    let totalGain = 0;
    let totalLoss = 0;
    let totalDistance = 0;

    for (let i = 1; i < trackPoints.length; i++) {
      const point = trackPoints[i];
      const prevPoint = trackPoints[i - 1];
      
      // Calculate distance
      const distance = calculateDistance(prevPoint.lat, prevPoint.lng, point.lat, point.lng);
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
  }, [calculateDistance]);

  // Update route when waypoints change - handle incrementally
  useEffect(() => {
    if (waypoints.length < 2) {
      setRoutePoints([...waypoints]);
      setRoutePointsWithElevation([]);
      setRouteSegments([]);
      setIsCalculatingRoute(false);
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
      
      console.log('🔥 TRIGGERING BROUTER CALL - User added waypoint');
      setIsCalculatingRoute(true);
      calculateRouteSegment(fromPoint, toPoint).then(newSegment => {
        setRouteSegments(prev => [...prev, newSegment]);
        setIsCalculatingRoute(false);
      });
      
      // Update the cached count
      lastUserWaypointCountRef.current = currentWaypointCount;
    } else if (currentWaypointCount < lastWaypointCount) {
      // User removed a waypoint - remove the last segment
      const segmentsToRemove = lastWaypointCount - currentWaypointCount;
      setRouteSegments(prev => prev.slice(0, -segmentsToRemove));
      
      // Update the cached count
      lastUserWaypointCountRef.current = currentWaypointCount;
    }
    // If currentWaypointCount === lastWaypointCount, it's just reinitialization - do nothing
  }, [waypoints, calculateRouteSegment]);

  // Rebuild complete route from segments
  useEffect(() => {
    if (routeSegments.length === 0) {
      setRoutePointsWithElevation([]);
      setRoutePoints([...waypoints]);
      return;
    }
    
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
    
    setRoutePointsWithElevation(completeRoute);
    setRoutePoints(completeRoute.map(p => ({ lat: p.lat, lng: p.lng })));
  }, [routeSegments, waypoints]);

  // Update map display
  useEffect(() => {
    if (!routeLayer || !waypointLayer) return;

    // Clear existing layers
    routeLayer.clearLayers();
    waypointLayer.clearLayers();

    // Draw waypoints
    waypoints.forEach((point, index) => {
      const marker = L.circleMarker([point.lat, point.lng], {
        radius: 8,
        fillColor: index === 0 ? '#28a745' : index === waypoints.length - 1 ? '#dc3545' : '#007bff',
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8,
      });
      
      marker.bindTooltip(`Waypoint ${index + 1}`, { permanent: false });
      waypointLayer.addLayer(marker);
    });

    // Draw route - either computed by BRouter or straight lines as fallback
    if (routePoints.length >= 2) {
      const isComputedRoute = routePoints.length > waypoints.length;
      
      const polyline = L.polyline(
        routePoints.map(p => [p.lat, p.lng]),
        {
          color: isComputedRoute ? '#28a745' : '#007bff',
          weight: isComputedRoute ? 4 : 3,
          opacity: isComputedRoute ? 0.8 : 0.5,
          dashArray: isComputedRoute ? undefined : '5, 5'
        }
      );
      routeLayer.addLayer(polyline);
      
      const tooltipText = isComputedRoute 
        ? 'Route computed by BRouter' 
        : 'Fallback: straight line between waypoints';
      polyline.bindTooltip(tooltipText, { permanent: false });
    }
  }, [routePoints, waypoints, routeLayer, waypointLayer]);

  // Handle undo last waypoint
  const handleUndo = useCallback(() => {
    isUndoingRef.current = true;
    
    setWaypoints(prev => {
      if (prev.length === 0) return prev;
      
      // User is modifying waypoints - routing will be handled automatically
      
      // Remove the last waypoint
      return prev.slice(0, -1);
    });
    
    // Reset the undoing flag after a short delay
    setTimeout(() => {
      isUndoingRef.current = false;
    }, 200);
  }, []);

  // Handle route completion
  const handleComplete = useCallback(() => {
    if (waypoints.length < 2) {
      alert('Please add at least 2 waypoints to create a route');
      return;
    }

    // Use cached route data - no BRouter calls needed
    const pointsToUse = routePointsWithElevation.length > 0 ? routePointsWithElevation : routePoints;
    
    // Generate GPX including elevation data and original waypoints
    const gpxContent = generateGPX(pointsToUse, 'Drawn Route', waypoints);
    onRouteComplete(gpxContent);
  }, [waypoints, routePoints, routePointsWithElevation, onRouteComplete]);

  // Handle cancel
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

  return (
    <div 
      data-route-drawer-panel
      style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        background: 'white',
        borderRadius: '8px',
        padding: '16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        zIndex: 1000,
        minWidth: '200px',
        pointerEvents: 'auto', // Ensure this panel captures clicks
      }}
      onClick={(e) => {
        e.stopPropagation();
      }}
    >
      <h4 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>🎯 Draw Route</h4>
      
      <div style={{ fontSize: '14px', marginBottom: '12px' }}>
        <div>Waypoints: {waypoints.length}/{PATHFINDING_CONFIG.MAX_WAYPOINTS}</div>
        <div>
          {isCalculatingRoute ? '🔄 Computing route...' : 
            routePointsWithElevation.length > 0 ? 
              (() => {
                const routeData = calculateRouteData(routePointsWithElevation);
                const distanceKm = routeData.distance / 1000;
                return `Distance: ${distanceKm.toFixed(1)} km`;
              })() : 
              routePoints.length > 1 ? 
                (() => {
                  const routeData = calculateRouteData(routePoints.map(p => ({...p, ele: undefined})));
                  const distanceKm = routeData.distance / 1000;
                  return `Distance: ${distanceKm.toFixed(1)} km (approx)`;
                })() :
                'Click to add waypoints'
          }
        </div>
        {routePointsWithElevation.length > 0 && !isCalculatingRoute && (
          <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
            {(() => {
              const routeData = calculateRouteData(routePointsWithElevation);
              return (
                <div>
                  <strong>D+:</strong> {Math.round(routeData.gain)}m | <strong>D-:</strong> {Math.round(routeData.loss)}m
                </div>
              );
            })()}
          </div>
        )}
      </div>


      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleUndo();
          }}
          disabled={waypoints.length === 0}
          style={{
            padding: '8px 12px',
            backgroundColor: waypoints.length === 0 ? '#ccc' : '#ffc107',
            color: waypoints.length === 0 ? '#666' : '#000',
            border: 'none',
            borderRadius: '4px',
            cursor: waypoints.length === 0 ? 'not-allowed' : 'pointer',
            fontSize: '12px',
          }}
        >
          ↶ Undo Last Point
        </button>
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleComplete();
          }}
          disabled={routePoints.length < 2}
          style={{
            padding: '8px 12px',
            backgroundColor: routePoints.length < 2 ? '#ccc' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: routePoints.length < 2 ? 'not-allowed' : 'pointer',
            fontSize: '12px',
          }}
        >
          ✓ Complete Route
        </button>
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleCancel();
          }}
          style={{
            padding: '8px 12px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          ✕ Cancel
        </button>
      </div>

      <div style={{ fontSize: '11px', color: '#666', marginTop: '8px' }}>
        Click on map to add waypoints
      </div>
    </div>
  );
}