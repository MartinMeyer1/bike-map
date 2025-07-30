import { useState, useEffect, useCallback, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { 
  PathPoint, 
  PATHFINDING_CONFIG
} from '../utils/pathfinding';
import { generateGPX, parseGPX } from '../utils/gpxGenerator';

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
  // const [pathSegments] = useState<PathSegment[]>([]); // Temporarily disabled
  const [routeLayer, setRouteLayer] = useState<L.LayerGroup | null>(null);
  const [waypointLayer, setWaypointLayer] = useState<L.LayerGroup | null>(null);
  const [initialWaypoints, setInitialWaypoints] = useState<PathPoint[]>([]);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [routePointsWithElevation, setRoutePointsWithElevation] = useState<Array<{lat: number, lng: number, ele?: number}>>([]);
  const isUndoingRef = useRef(false);

  // Initialize waypoints from GPX content when drawing becomes active
  useEffect(() => {
    if (!isActive) {
      // Clear state when drawing becomes inactive
      setRoutePointsWithElevation([]);
      return;
    }
    
    const initialPoints = parseGPX(initialGpxContent || '');
    setInitialWaypoints(initialPoints);
    setWaypoints(initialPoints);
    setRoutePointsWithElevation([]); // Clear elevation data when starting fresh
  }, [isActive, initialGpxContent]);

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

        return [...prev, newPoint];
      });
    };

    map.on('click', handleMapClick);
    
    return () => {
      map.off('click', handleMapClick);
    };
  }, [map, isActive]);

  // Function to call BRouter API
  const calculateRoute = useCallback(async (waypoints: PathPoint[]): Promise<PathPoint[]> => {
    if (waypoints.length < 2) return waypoints;
    
    try {
      // Format waypoints for BRouter API: "lng,lat|lng,lat|..."
      const lonlats = waypoints.map(wp => `${wp.lng},${wp.lat}`).join('|');
      
      // Debug: log what we're sending to BRouter
      console.log(`Sending ${waypoints.length} waypoints to BRouter:`, lonlats);
      
      // BRouter API call with GPX format - using trekking profile for better waypoint adherence
      const brouterUrl = `http://localhost:17777/brouter?lonlats=${lonlats}&profile=hiking-mountain&format=gpx`;
      
      const response = await fetch(brouterUrl);
      if (!response.ok) {
        console.error('BRouter API error:', response.status, response.statusText);
        return waypoints; // Fallback to straight line
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
      
      // Store the detailed track points with elevation for later use
      if (trackPoints.length > 0) {
        // Store in component state for use in handleComplete
        setRoutePointsWithElevation(trackPoints);
        
        // Return simple points for route display
        return trackPoints.map(p => ({ lat: p.lat, lng: p.lng }));
      }
      
      return waypoints;
    } catch (error) {
      console.error('BRouter routing error:', error);
      return waypoints; // Fallback to straight line
    }
  }, []);

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

  // Update route when waypoints change
  useEffect(() => {
    if (waypoints.length < 2) {
      setRoutePoints([...waypoints]);
      setRoutePointsWithElevation([]); // Clear elevation data
      setIsCalculatingRoute(false);
      return;
    }
    
    // Call BRouter for routing
    setIsCalculatingRoute(true);
    calculateRoute(waypoints).then(routePoints => {
      setRoutePoints(routePoints);
      setIsCalculatingRoute(false);
    });
  }, [waypoints, calculateRoute]);

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
    if (routePoints.length < 2) {
      alert('Please add at least 2 waypoints to create a route');
      return;
    }

    // Use elevation data if available from BRouter, otherwise use simple route points
    const pointsToUse = routePointsWithElevation.length > 0 ? routePointsWithElevation : routePoints;
    
    // Generate GPX including elevation data if available
    const gpxContent = generateGPX(pointsToUse, 'Drawn Route');
    onRouteComplete(gpxContent);
  }, [routePoints, routePointsWithElevation, onRouteComplete]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    // Generate GPX from initial waypoints to restore previous state
    if (initialWaypoints.length > 0) {
      const restoredGpxContent = generateGPX(initialWaypoints, 'Drawn Route');
      onRouteComplete(restoredGpxContent);
    } else {
      // If no initial waypoints, proceed with normal cancel
      onCancel();
    }
  }, [initialWaypoints, onRouteComplete, onCancel]);

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