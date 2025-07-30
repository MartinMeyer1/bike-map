// import Pbf from 'pbf'; // TODO: Enable when implementing proper PBF parsing

// Configuration constants
export const PATHFINDING_CONFIG = {
  MAX_WAYPOINTS: 50,
  MAX_ROUTE_DISTANCE_KM: 100,
  SNAP_DISTANCE_METERS: 100,
  TILE_BUFFER_SIZE: 2, // Number of tiles to buffer around viewport
};

export interface PathPoint {
  lat: number;
  lng: number;
}

export interface PathSegment {
  start: PathPoint;
  end: PathPoint;
  distance: number;
}

export interface PathNetwork {
  nodes: Map<string, PathPoint>;
  edges: Map<string, PathSegment[]>;
}

// Simple utility functions
export function calculateDistance(p1: PathPoint, p2: PathPoint): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (p2.lat - p1.lat) * Math.PI / 180;
  const dLng = (p2.lng - p1.lng) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
          Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export function pointToTileCoords(lat: number, lng: number, zoom: number): { x: number, y: number } {
  const n = Math.pow(2, zoom);
  const x = Math.floor((lng + 180) / 360 * n);
  const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n);
  return { x, y };
}

export function tileToLatLng(x: number, y: number, zoom: number): PathPoint {
  const n = Math.pow(2, zoom);
  const lng = x / n * 360 - 180;
  const lat_rad = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n)));
  const lat = lat_rad * 180 / Math.PI;
  return { lat, lng };
}

// Load vector tiles from Swisstopo WMTS service
export async function loadVectorTile(x: number, y: number, z: number): Promise<ArrayBuffer | null> {
  try {
    const url = `https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swisstlm3d-strassen/default/current/3857/${z}/${x}/${y}.pbf`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.warn(`Failed to load tile ${z}/${x}/${y}: ${response.status}`);
      return null;
    }
    
    return await response.arrayBuffer();
  } catch (error) {
    console.warn(`Error loading tile ${z}/${x}/${y}:`, error);
    return null;
  }
}

// Simple PBF parsing for path extraction
export function extractPathsFromTile(_buffer: ArrayBuffer, tileX: number, tileY: number, zoom: number): PathSegment[] {
  try {
    // TODO: Implement proper PBF parsing
    // const pbf = new Pbf(buffer);
    const paths: PathSegment[] = [];
    
    // This is a simplified parser - in a real implementation,
    // you'd need to properly decode the vector tile format
    // For now, we'll create some mock path data based on tile bounds
    const tileBounds = {
      north: tileToLatLng(tileX, tileY, zoom).lat,
      south: tileToLatLng(tileX, tileY + 1, zoom).lat,
      west: tileToLatLng(tileX, tileY, zoom).lng,
      east: tileToLatLng(tileX + 1, tileY, zoom).lng,
    };
    
    // Generate some mock path segments for demonstration
    // In a real implementation, you'd parse the actual vector tile data
    const segmentCount = Math.floor(Math.random() * 10) + 5;
    for (let i = 0; i < segmentCount; i++) {
      const start: PathPoint = {
        lat: tileBounds.south + Math.random() * (tileBounds.north - tileBounds.south),
        lng: tileBounds.west + Math.random() * (tileBounds.east - tileBounds.west),
      };
      const end: PathPoint = {
        lat: start.lat + (Math.random() - 0.5) * 0.001,
        lng: start.lng + (Math.random() - 0.5) * 0.001,
      };
      
      paths.push({
        start,
        end,
        distance: calculateDistance(start, end),
      });
    }
    
    return paths;
  } catch (error) {
    console.warn('Error parsing tile:', error);
    return [];
  }
}

// Find nearest path point to a given coordinate
export function findNearestPathPoint(targetPoint: PathPoint, pathSegments: PathSegment[]): PathPoint | null {
  let nearestPoint: PathPoint | null = null;
  let minDistance = PATHFINDING_CONFIG.SNAP_DISTANCE_METERS;
  
  for (const segment of pathSegments) {
    // Check distance to start point
    const distToStart = calculateDistance(targetPoint, segment.start);
    if (distToStart < minDistance) {
      minDistance = distToStart;
      nearestPoint = segment.start;
    }
    
    // Check distance to end point
    const distToEnd = calculateDistance(targetPoint, segment.end);
    if (distToEnd < minDistance) {
      minDistance = distToEnd;
      nearestPoint = segment.end;
    }
    
    // TODO: Also check distance to points along the segment
  }
  
  return nearestPoint;
}

// Simple pathfinding between two points
export function findPath(start: PathPoint, end: PathPoint, pathSegments: PathSegment[]): PathPoint[] {
  // For now, implement a simple approach:
  // 1. Snap start and end to nearest path points
  // 2. If they're the same, return direct path
  // 3. Otherwise, return straight line between snapped points
  
  const snappedStart = findNearestPathPoint(start, pathSegments) || start;
  const snappedEnd = findNearestPathPoint(end, pathSegments) || end;
  
  // Simple implementation: return direct path between snapped points
  // In a more sophisticated implementation, you'd use A* or Dijkstra's algorithm
  return [snappedStart, snappedEnd];
}

// Build path network from segments (for future advanced pathfinding)
export function buildPathNetwork(pathSegments: PathSegment[]): PathNetwork {
  const nodes = new Map<string, PathPoint>();
  const edges = new Map<string, PathSegment[]>();
  
  for (const segment of pathSegments) {
    const startKey = `${segment.start.lat.toFixed(6)},${segment.start.lng.toFixed(6)}`;
    const endKey = `${segment.end.lat.toFixed(6)},${segment.end.lng.toFixed(6)}`;
    
    nodes.set(startKey, segment.start);
    nodes.set(endKey, segment.end);
    
    if (!edges.has(startKey)) {
      edges.set(startKey, []);
    }
    edges.get(startKey)!.push(segment);
  }
  
  return { nodes, edges };
}