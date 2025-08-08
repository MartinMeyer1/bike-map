export interface Trail {
  id: string;
  name: string;
  description?: string;
  level: 'S0' | 'S1' | 'S2' | 'S3' | 'S4' | 'S5';
  tags: string[];
  file: string;
  owner: string; // Owner ID reference
  created: string;
  updated: string;
  elevation_profile?: Array<{ distance: number; elevation: number }>;
}

export interface GeoJsonGeometry {
  type: 'LineString';
  coordinates: number[][];
}

export interface GeoJsonFeature {
  type: 'Feature';
  properties: {
    name: string;
    level: string;
    description?: string;
    tags: string[];
  };
  geometry: GeoJsonGeometry;
}

export interface TrailBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface ElevationData {
  gain: number;
  loss: number;
  profile: Array<{ distance: number; elevation: number }>;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  role?: 'Viewer' | 'Editor' | 'Admin';
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

// MVT Trail Properties (from backend tiles)
export interface MVTTrailProperties {
  id: string;
  name: string;
  description?: string;
  level: 'S0' | 'S1' | 'S2' | 'S3' | 'S4' | 'S5';
  tags?: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
  gpx_file: string;
  
  // Geometric data
  start_lat: number;
  start_lng: number;
  end_lat: number;
  end_lng: number;
  bbox_north: number;
  bbox_south: number;
  bbox_east: number;
  bbox_west: number;
  
  // Pre-calculated metrics from backend
  distance_m: number;
  elevation_gain_meters: number;
  elevation_loss_meters: number;
  min_elevation_meters: number;
  max_elevation_meters: number;
  elevation_start_meters: number;
  elevation_end_meters: number;
}

// Simplified trail interface for MVT-based system
export interface MVTTrail {
  id: string;
  name: string;
  description?: string;
  level: 'S0' | 'S1' | 'S2' | 'S3' | 'S4' | 'S5';
  tags: string[];
  owner: string;
  created: string;
  updated: string;
  
  // Pre-calculated from backend
  bounds: TrailBounds;
  elevation: {
    gain: number;
    loss: number;
    min: number;
    max: number;
    start: number;
    end: number;
  };
  distance: number;
  startPoint: { lat: number; lng: number };
  endPoint: { lat: number; lng: number };
  
  // For compatibility with existing components
  ownerInfo?: User;
}