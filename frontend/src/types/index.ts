export interface Trail {
  id: string;
  name: string;
  description?: string;
  level: 'S0' | 'S1' | 'S2' | 'S3' | 'S4' | 'S5';
  tags: string[];
  file: string;
  owner: string | User; // Can be expanded to full User object
  created: string;
  updated: string;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
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