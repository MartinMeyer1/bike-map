import { Trail, MapBounds, User } from '../types';
import { PocketBaseService } from './pocketbase';

// Extended trail interface with cached GeoJSON data
export interface CachedTrail extends Trail {
  geoJson?: any;
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  elevation?: {
    gain: number;
    loss: number;
    profile: Array<{ distance: number; elevation: number }>;
  };
  processedAt?: number;
}

// Cache configuration - memory only, no persistence

class TrailCacheService {
  private memoryCache: Map<string, CachedTrail> = new Map();
  private userCache: Map<string, User> = new Map(); // Cache for user data
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  // Initialize cache - fetches and processes all trails fresh each session
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.doInitialize();
    return this.initPromise;
  }

  private async doInitialize(): Promise<void> {
    try {
      // Clear any existing cache
      this.memoryCache.clear();

      // Fetch fresh trail list from API
      const freshTrails = await PocketBaseService.getTrails();

      // Process all trails
      if (freshTrails.length > 0) {
        await this.processTrails(freshTrails);
      }

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize trail cache:', error);
      throw error;
    }
  }

  // Get all cached trails
  getAllTrails(): CachedTrail[] {
    if (!this.isInitialized) {
      return [];
    }
    return Array.from(this.memoryCache.values());
  }

  // Get trails within map bounds (spatial filtering)
  getTrailsInBounds(bounds: MapBounds): CachedTrail[] {
    return this.getAllTrails().filter(trail => {
      if (!trail.bounds) return true; // Include trails without bounds calculated
      
      // Check if trail bounds intersect with map bounds
      return !(
        trail.bounds.south > bounds.north ||
        trail.bounds.north < bounds.south ||
        trail.bounds.east < bounds.west ||
        trail.bounds.west > bounds.east
      );
    });
  }

  // Get specific trail by ID
  getTrail(id: string): CachedTrail | null {
    return this.memoryCache.get(id) || null;
  }

  // Add new trail to cache (for when users upload)
  async addTrail(trail: Trail): Promise<void> {
    const processedTrails = await this.processTrails([trail]);
    
    if (processedTrails.length > 0) {
      const cachedTrail = processedTrails[0];
      this.memoryCache.set(cachedTrail.id, cachedTrail);
    }
  }

  // Update existing trail in cache
  async updateTrail(updatedTrail: Trail): Promise<void> {
    const processedTrails = await this.processTrails([updatedTrail]);
    
    if (processedTrails.length > 0) {
      const cachedTrail = processedTrails[0];
      this.memoryCache.set(cachedTrail.id, cachedTrail);
    }
  }

  // Remove trail from cache
  removeTrail(trailId: string): void {
    this.memoryCache.delete(trailId);
  }

  // Force refresh cache (useful after backend changes)
  async forceRefresh(): Promise<void> {
    this.isInitialized = false;
    this.initPromise = null;
    await this.initialize();
  }

  // Fetch user data by ID with caching
  private async fetchUser(userId: string): Promise<User | null> {
    // Return cached user if available
    if (this.userCache.has(userId)) {
      return this.userCache.get(userId)!;
    }

    try {
      // Fetch user data from API - using configurable base URL
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8090';
      const response = await fetch(`${API_BASE_URL}/api/collections/_pb_users_auth_/records/${userId}`);
      if (!response.ok) {
        console.error(`Failed to fetch user ${userId}:`, response.status);
        return null;
      }

      const userData = await response.json();
      const user: User = {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        avatar: userData.avatar
      };

      // Cache the user data
      this.userCache.set(userId, user);
      return user;
    } catch (error) {
      console.error(`Error fetching user ${userId}:`, error);
      return null;
    }
  }

  // Process trails: convert GPX to GeoJSON and extract metadata
  private async processTrails(trails: Trail[]): Promise<CachedTrail[]> {
    const processed: CachedTrail[] = [];
    
    // First, collect all unique user IDs that need to be fetched
    const userIdsToFetch = new Set<string>();
    for (const trail of trails) {
      if (typeof trail.owner === 'string' && !this.userCache.has(trail.owner)) {
        userIdsToFetch.add(trail.owner);
      }
    }

    // Fetch all user data in parallel
    const userFetchPromises = Array.from(userIdsToFetch).map(userId => this.fetchUser(userId));
    await Promise.all(userFetchPromises);
    
    for (const trail of trails) {
      try {
        const geoJsonData = await this.convertGpxToGeoJson(trail);
        
        // Get user data from cache and replace owner string ID with user object
        let processedTrail = { ...trail };
        if (typeof trail.owner === 'string') {
          const userData = this.userCache.get(trail.owner);
          if (userData) {
            processedTrail.owner = userData;
          }
        }
        
        const cachedTrail: CachedTrail = {
          ...processedTrail,
          ...geoJsonData,
          processedAt: Date.now()
        };
        processed.push(cachedTrail);
        this.memoryCache.set(trail.id, cachedTrail);
      } catch (error) {
        console.error(`Failed to process trail ${trail.name}:`, error);
        
        // Still cache the trail without GeoJSON data, but with user data if available
        let processedTrail = { ...trail };
        if (typeof trail.owner === 'string') {
          const userData = this.userCache.get(trail.owner);
          if (userData) {
            processedTrail.owner = userData;
          }
        }
        
        const cachedTrail: CachedTrail = {
          ...processedTrail,
          processedAt: Date.now()
        };
        processed.push(cachedTrail);
        this.memoryCache.set(trail.id, cachedTrail);
      }
    }
    
    return processed;
  }

  // Convert GPX file to GeoJSON with elevation data
  private async convertGpxToGeoJson(trail: Trail): Promise<Partial<CachedTrail>> {
    return new Promise(async (resolve, reject) => {
      try {
        const gpxUrl = PocketBaseService.getTrailFileUrl(trail);
        const response = await fetch(gpxUrl);
        const gpxText = await response.text();
        
        // Parse GPX using DOMParser
        const parser = new DOMParser();
        const gpxDoc = parser.parseFromString(gpxText, 'text/xml');
        
        // Extract track points
        const trackPoints: Array<{lat: number, lng: number, ele?: number}> = [];
        const trkpts = gpxDoc.querySelectorAll('trkpt');
        
        trkpts.forEach(trkpt => {
          const lat = parseFloat(trkpt.getAttribute('lat') || '0');
          const lon = parseFloat(trkpt.getAttribute('lon') || '0');
          const ele = trkpt.querySelector('ele');
          const elevation = ele ? parseFloat(ele.textContent || '0') : undefined;
          
          trackPoints.push({
            lat,
            lng: lon,
            ele: elevation
          });
        });

        if (trackPoints.length === 0) {
          throw new Error('No track points found in GPX');
        }

        // Calculate bounds
        const bounds = {
          north: Math.max(...trackPoints.map(p => p.lat)),
          south: Math.min(...trackPoints.map(p => p.lat)),
          east: Math.max(...trackPoints.map(p => p.lng)),
          west: Math.min(...trackPoints.map(p => p.lng))
        };

        // Calculate elevation data
        const elevation = this.calculateElevationData(trackPoints);

        // Create GeoJSON
        const geoJson = {
          type: 'Feature',
          properties: {
            name: trail.name,
            level: trail.level,
            description: trail.description,
            tags: trail.tags
          },
          geometry: {
            type: 'LineString',
            coordinates: trackPoints.map(p => [p.lng, p.lat, p.ele || 0])
          }
        };

        resolve({
          geoJson,
          bounds,
          elevation
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  // Calculate elevation gain, loss, and profile
  private calculateElevationData(trackPoints: Array<{lat: number, lng: number, ele?: number}>) {
    let totalGain = 0;
    let totalLoss = 0;
    let totalDistance = 0;
    const profile: Array<{ distance: number; elevation: number }> = [];

    for (let i = 0; i < trackPoints.length; i++) {
      const point = trackPoints[i];
      
      if (i > 0) {
        const prevPoint = trackPoints[i - 1];
        
        // Calculate distance using Haversine formula
        const distance = this.calculateDistance(
          prevPoint.lat, prevPoint.lng,
          point.lat, point.lng
        );
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

      // Build elevation profile
      if (point.ele !== undefined) {
        profile.push({
          distance: totalDistance,
          elevation: point.ele
        });
      }
    }

    return {
      gain: totalGain,
      loss: totalLoss,
      profile
    };
  }

  // Calculate distance between two lat/lng points in meters
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // Clear cache (for debugging/reset)
  clearCache(): void {
    this.memoryCache.clear();
    this.isInitialized = false;
    this.initPromise = null;
  }
}

// Export singleton instance
export const trailCache = new TrailCacheService();
export default trailCache;