import { User } from '../types';

/**
 * UserCache - Caches username information for trail owners
 * Only caches user data, not trail data (trails now come from MVT)
 */
class UserCacheService {
  private userCache: Map<string, User> = new Map();

  // Fetch user data by ID with caching
  async fetchUser(userId: string): Promise<User | null> {
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

  // Get cached user (no fetch)
  getCachedUser(userId: string): User | null {
    return this.userCache.get(userId) || null;
  }

  // Clear user cache
  clearCache(): void {
    this.userCache.clear();
  }

  // Get cache statistics
  getCacheSize(): number {
    return this.userCache.size;
  }
}

// Export singleton instance
export const userCache = new UserCacheService();
export default userCache;