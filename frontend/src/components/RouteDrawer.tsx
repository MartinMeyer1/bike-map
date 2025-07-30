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
  const isUndoingRef = useRef(false);

  // Initialize waypoints from GPX content when drawing becomes active
  useEffect(() => {
    if (!isActive) return;
    
    const initialPoints = parseGPX(initialGpxContent || '');
    setInitialWaypoints(initialPoints);
    setWaypoints(initialPoints);
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

    // Draw route as straight lines (placeholder while waiting for server routing)
    if (routePoints.length >= 2) {
      const polyline = L.polyline(
        routePoints.map(p => [p.lat, p.lng]),
        {
          color: '#007bff',
          weight: 3,
          opacity: 0.5,
          dashArray: '5, 5' // Dashed line to indicate it's temporary
        }
      );
      routeLayer.addLayer(polyline);
      
      polyline.bindTooltip('Temporary route - will be computed by server', { permanent: false });
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

    // Generate GPX from waypoints for server routing
    const gpxContent = generateGPX(routePoints, 'Drawn Route');
    onRouteComplete(gpxContent);
  }, [routePoints, onRouteComplete]);

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
        <div>Route will be computed by server</div>
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