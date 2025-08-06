export interface Trail {
  id: string;
  name: string;
  description: string;
  level: 'S0' | 'S1' | 'S2' | 'S3' | 'S4' | 'S5';
  tags: string[];
  gpx_file: string;
  owner: string; // Owner ID reference
  created: string;
  updated: string;
  collectionId: string;
  collectionName: string;
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