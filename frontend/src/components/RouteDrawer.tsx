import { useState, useEffect, useCallback, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { 
  PathPoint, 
  PathSegment, 
  loadVectorTile, 
  extractPathsFromTile, 
  pointToTileCoords,
  calculateDistance,
  PATHFINDING_CONFIG
} from '../utils/pathfinding';
import { generateGPX } from '../utils/gpxGenerator';

interface RouteDrawerProps {
  isActive: boolean;
  onRouteComplete: (gpxContent: string) => void;
  onCancel: () => void;
}

export default function RouteDrawer({ isActive, onRouteComplete, onCancel }: RouteDrawerProps) {
  const map = useMap();
  const [waypoints, setWaypoints] = useState<PathPoint[]>([]);
  const [routePoints, setRoutePoints] = useState<PathPoint[]>([]);
  // const [pathSegments] = useState<PathSegment[]>([]); // Temporarily disabled
  const [routeLayer, setRouteLayer] = useState<L.LayerGroup | null>(null);
  const [waypointLayer, setWaypointLayer] = useState<L.LayerGroup | null>(null);
  const isUndoingRef = useRef(false);

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

  // Load path data for current map view
  const loadPathData = useCallback(async () => {
    if (!map || !isActive) return;
    const bounds = map.getBounds();
    const zoom = Math.min(map.getZoom(), 16); // Limit zoom level for tile loading
    
    const newSegments: PathSegment[] = [];
    
    // Get tile coordinates for current bounds
    const nw = pointToTileCoords(bounds.getNorth(), bounds.getWest(), zoom);
    const se = pointToTileCoords(bounds.getSouth(), bounds.getEast(), zoom);
    
    // Load tiles in the current view + buffer
    const promises: Promise<void>[] = [];
    for (let x = nw.x - PATHFINDING_CONFIG.TILE_BUFFER_SIZE; x <= se.x + PATHFINDING_CONFIG.TILE_BUFFER_SIZE; x++) {
      for (let y = nw.y - PATHFINDING_CONFIG.TILE_BUFFER_SIZE; y <= se.y + PATHFINDING_CONFIG.TILE_BUFFER_SIZE; y++) {
        promises.push(
          loadVectorTile(x, y, zoom).then(buffer => {
            if (buffer) {
              const segments = extractPathsFromTile(buffer, x, y, zoom);
              newSegments.push(...segments);
            }
          })
        );
      }
    }
    
    await Promise.all(promises);
    // setPathSegments(newSegments); // Temporarily disabled - pathfinding not implemented
  }, [map, isActive]);

  // Load path data when map moves or drawing becomes active
  useEffect(() => {
    if (isActive) {
      loadPathData();
    }
  }, [isActive, loadPathData]);

  useEffect(() => {
    if (!map || !isActive) return;

    const handleMoveEnd = () => {
      loadPathData();
    };

    map.on('moveend', handleMoveEnd);
    return () => {
      map.off('moveend', handleMoveEnd);
    };
  }, [map, isActive, loadPathData]);

  // Handle map clicks to add waypoints
  useEffect(() => {
    if (!map || !isActive) return;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      if (isUndoingRef.current) {
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

  // Update route when waypoints change
  useEffect(() => {
    // Simple implementation: direct line between waypoints (no pathfinding yet)
    setRoutePoints([...waypoints]);
  }, [waypoints]);

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

    // Draw route
    if (routePoints.length >= 2) {
      const polyline = L.polyline(
        routePoints.map(p => [p.lat, p.lng]),
        {
          color: '#007bff',
          weight: 4,
          opacity: 0.8,
        }
      );
      routeLayer.addLayer(polyline);
      
      // Calculate and show total distance
      let totalDistance = 0;
      for (let i = 0; i < routePoints.length - 1; i++) {
        totalDistance += calculateDistance(routePoints[i], routePoints[i + 1]);
      }
      
      const distanceKm = (totalDistance / 1000).toFixed(1);
      polyline.bindTooltip(`Route: ${distanceKm} km`, { permanent: false });
    }
  }, [routePoints, waypoints, routeLayer, waypointLayer]);

  // Handle undo last waypoint
  const handleUndo = useCallback(() => {
    isUndoingRef.current = true;
    
    setWaypoints(prev => {
      if (prev.length === 0) return prev;
      
      // Remove 2 waypoints to compensate for duplicate click issue
      const waypointsToRemove = Math.min(2, prev.length);
      return prev.slice(0, -waypointsToRemove);
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

    // Check route distance
    let totalDistance = 0;
    for (let i = 0; i < routePoints.length - 1; i++) {
      totalDistance += calculateDistance(routePoints[i], routePoints[i + 1]);
    }
    
    const distanceKm = totalDistance / 1000;
    if (distanceKm > PATHFINDING_CONFIG.MAX_ROUTE_DISTANCE_KM) {
      alert(`Route too long (${distanceKm.toFixed(1)} km). Maximum allowed: ${PATHFINDING_CONFIG.MAX_ROUTE_DISTANCE_KM} km`);
      return;
    }

    const gpxContent = generateGPX(routePoints, 'Drawn Route');
    onRouteComplete(gpxContent);
  }, [routePoints, onRouteComplete]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    setWaypoints([]);
    setRoutePoints([]);
    onCancel();
  }, [onCancel]);

  if (!isActive) return null;

  return (
    <div 
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
        {routePoints.length >= 2 && (
          <div>
            Distance: {(routePoints.reduce((acc, point, i) => 
              i === 0 ? acc : acc + calculateDistance(routePoints[i-1], point), 0
            ) / 1000).toFixed(1)} km
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