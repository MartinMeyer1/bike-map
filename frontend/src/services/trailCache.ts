import { Trail, User } from '../types';
import { PocketBaseService } from './pocketbase';

// Simplified cached trail for CRUD operations only
export interface CachedTrail extends Trail {
  ownerInfo?: User; // Cache owner information for display
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

  // Get specific trail by ID
  getTrail(id: string): CachedTrail | null {
    return this.memoryCache.get(id) || null;
  }

  // Add new trail to cache (for when users upload)
  async addTrail(trail: Trail): Promise<void> {
    const cachedTrail: CachedTrail = { ...trail };
    
    // Fetch owner info if available
    const ownerInfo = await this.fetchUser(trail.owner);
    if (ownerInfo) {
      cachedTrail.ownerInfo = ownerInfo;
    }
    
    this.memoryCache.set(cachedTrail.id, cachedTrail);
  }

  // Update existing trail in cache
  async updateTrail(updatedTrail: Trail): Promise<void> {
    const cachedTrail: CachedTrail = { ...updatedTrail };
    
    // Fetch owner info if available
    const ownerInfo = await this.fetchUser(updatedTrail.owner);
    if (ownerInfo) {
      cachedTrail.ownerInfo = ownerInfo;
    }
    
    this.memoryCache.set(cachedTrail.id, cachedTrail);
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

  // Simplified trail processing - no GPX conversion needed (MVT handles geometry)
  private async processTrails(trails: Trail[]): Promise<CachedTrail[]> {
    const processed: CachedTrail[] = [];
    
    // Collect all unique user IDs that need to be fetched
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
      // Just add user info - no GPX processing needed
      const cachedTrail: CachedTrail = { ...trail };
      const ownerInfo = this.userCache.get(trail.owner);
      if (ownerInfo) {
        cachedTrail.ownerInfo = ownerInfo;
      }
      
      processed.push(cachedTrail);
      this.memoryCache.set(trail.id, cachedTrail);
    }
    
    return processed;
  }

  // GPX processing methods removed - MVT backend handles all geometric calculations

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