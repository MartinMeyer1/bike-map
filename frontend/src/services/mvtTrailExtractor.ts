import { Trail } from '../types';
import { userCache } from './userCache';

/**
 * MVTTrailExtractor - Extracts trail data from loaded MVT tiles
 * This replaces the old trail cache by collecting trail info from vector tiles
 */
class MVTTrailExtractorService {
  private extractedTrails: Map<string, Trail> = new Map();
  private listeners: (() => void)[] = [];

  // Add trail from MVT feature data
  async addTrailFromMVT(featureProperties: any): Promise<void> {
    const trail: Trail = {
      id: featureProperties.id,
      name: featureProperties.name || 'Unknown Trail',
      description: featureProperties.description || '',
      level: featureProperties.level || 'S0',
      tags: featureProperties.tags ? (typeof featureProperties.tags === 'string' ? featureProperties.tags.split(',') : featureProperties.tags) : [],
      owner: featureProperties.owner_id || '',
      created: '', // Not available in MVT
      updated: '', // Not available in MVT
      gpx_file: '', // Not needed for MVT
      collectionId: '',
      collectionName: ''
    };

    // Fetch owner information
    if (featureProperties.owner_id) {
      const ownerInfo = await userCache.fetchUser(featureProperties.owner_id);
      if (ownerInfo) {
        (trail as any).ownerInfo = ownerInfo;
      }
    }

    this.extractedTrails.set(trail.id, trail);
    this.notifyListeners();
  }

  // Get all extracted trails
  getAllTrails(): Trail[] {
    return Array.from(this.extractedTrails.values());
  }

  // Get trail by ID
  getTrail(id: string): Trail | null {
    return this.extractedTrails.get(id) || null;
  }

  // Clear extracted trails (when map moves to new area)
  clearTrails(): void {
    this.extractedTrails.clear();
    this.notifyListeners();
  }

  // Add listener for trail updates
  addListener(listener: () => void): void {
    this.listeners.push(listener);
  }

  // Remove listener
  removeListener(listener: () => void): void {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  // Notify all listeners of trail updates
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }

  // Get cache statistics
  getStats(): { trailCount: number } {
    return {
      trailCount: this.extractedTrails.size
    };
  }
}

// Export singleton instance
export const mvtTrailExtractor = new MVTTrailExtractorService();
export default mvtTrailExtractor;