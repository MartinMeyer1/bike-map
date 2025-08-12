import PocketBase from 'pocketbase';
import { Trail, User, MVTTrail, TrailRating, TrailComment, TrailCommentWithUser, RatingStats, RatingAverage } from '../types';
import { handleApiError } from '../utils/errorHandling';

// Initialize PocketBase client with configurable base URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8090';
const pb = new PocketBase(API_BASE_URL);

// Enable auto-refresh and persistence of auth token
pb.autoCancellation(false);

// Auth state persistence - PocketBase should handle this automatically,
// but we can add explicit handling for better reliability
if (pb.authStore.isValid) {
  // Trigger a test API call to verify the token is still valid
  pb.collection('users').authRefresh().catch(() => {
    // Token is invalid, clear it
    pb.authStore.clear();
  });
}

export class PocketBaseService {
  static async loginWithGoogle(): Promise<User> {
    const authData = await pb.collection('users').authWithOAuth2({ provider: 'google' });
    return {
      id: authData.record.id,
      email: authData.record.email,
      name: authData.record.name,
      avatar: authData.record.avatar,
      role: authData.record.role,
    };
  }

  static logout(): void {
    pb.authStore.clear();
  }

  static getCurrentUser(): User | null {
    if (!pb.authStore.isValid || !pb.authStore.model) {
      return null;
    }

    return {
      id: pb.authStore.model.id,
      email: pb.authStore.model.email,
      name: pb.authStore.model.name,
      avatar: pb.authStore.model.avatar,
      role: pb.authStore.model.role,
    };
  }

  static isAuthenticated(): boolean {
    return pb.authStore.isValid;
  }

  static getAuthToken(): string {
    return pb.authStore.token
  }

  static onAuthChange(callback: (user: User | null) => void): () => void {
    const unsubscribe = pb.authStore.onChange(() => {
      const currentUser = this.getCurrentUser();
      callback(currentUser);
    });
    
    return unsubscribe;
  }

  static async createTrail(formData: FormData): Promise<Trail> {
    if (!pb.authStore.isValid) {
      throw new Error('You must be logged in to create a trail');
    }
    
    try {
      const record = await pb.collection('trails').create(formData);
      return this.formatTrail(record);
    } catch (error) {
      throw handleApiError(error);
    }
  }

  static async getTrails(): Promise<Trail[]> {
    try {
      const records = await pb.collection('trails').getFullList({
        sort: '-created',
        requestKey: null, // Disable auto-cancellation for this request
      });
      
      return records.map(record => this.formatTrail(record));
    } catch (error) {
      console.error('Error in getTrails:', error);
      throw error;
    }
  }

  static async getTrail(id: string): Promise<Trail> {
    const record = await pb.collection('trails').getOne(id, {
      expand: 'owner'
    });
    
    return this.formatTrail(record);
  }

  static async updateTrail(id: string, formData: FormData): Promise<Trail> {
    if (!pb.authStore.isValid) {
      throw new Error('You must be logged in to update a trail');
    }
    
    try {
      const record = await pb.collection('trails').update(id, formData, {
        expand: 'owner'
      });
      return this.formatTrail(record);
    } catch (error) {
      throw handleApiError(error);
    }
  }

  static async deleteTrail(id: string): Promise<void> {
    if (!pb.authStore.isValid) {
      throw new Error('You must be logged in to delete a trail');
    }
    
    try {
      await pb.collection('trails').delete(id);
    } catch (error) {
      throw handleApiError(error);
    }
  }

  static getFileUrl(record: any, filename: string): string {
    return pb.files.getUrl(record, filename);
  }

  static getTrailFileUrl(trail: Trail | { id: string; file?: string }): string {
    // For MVT trails, reconstruct the file name from ID
    const fileName = 'file' in trail && trail.file ? trail.file : `${trail.id}.gpx`;
    return `${pb.baseUrl}/api/files/trails/${trail.id}/${fileName}`;
  }

  static async updateUser(id: string, data: { name?: string }): Promise<User> {
    if (!pb.authStore.isValid) {
      throw new Error('You must be logged in to update your profile');
    }
    const record = await pb.collection('_pb_users_auth_').update(id, data);
    // Update the auth store with the new data
    pb.authStore.save(pb.authStore.token, record);
    return {
      id: record.id,
      email: record.email,
      name: record.name,
      avatar: record.avatar,
      role: record.role,
    };
  }

  static canEditTrail(trail: Trail | MVTTrail, user: User | null): boolean {
    if (!user) return false;
    if (user.role === 'Admin') return true;
    if (trail.owner === user.id) return true;
    return false;
  }

  private static formatTrail(record: any): Trail {
    return {
      id: record.id,
      name: record.name,
      description: record.description,
      level: record.level,
      tags: record.tags || [],
      file: record.file,
      owner: record.expand?.owner || record.owner,
      created: record.created,
      updated: record.updated,
    };
  }

  // RATINGS METHODS

  // Get rating statistics for a trail
  static async getTrailRatingStats(trailId: string, userId?: string): Promise<RatingStats> {
    try {
      // Get rating average from the new collection for better performance
      const ratingAverageResponse = await pb.collection('rating_average').getList(1, 1, {
        filter: `trail = "${trailId}"`
      });

      let count = 0;
      let average = 0;

      if (ratingAverageResponse.items.length > 0) {
        const ratingAverage = ratingAverageResponse.items[0] as unknown as RatingAverage;
        count = ratingAverage.count;
        average = ratingAverage.average;
      }

      // Get user's specific rating if userId provided
      let userRating: number | undefined;
      if (userId) {
        try {
          const userRatingResponse = await pb.collection('trail_ratings').getList(1, 1, {
            filter: `trail = "${trailId}" && user = "${userId}"`
          });
          userRating = userRatingResponse.items.length > 0 ? userRatingResponse.items[0].rating : undefined;
        } catch (error) {
          // User rating not found or error - continue without it
          console.warn('Could not fetch user rating:', error);
        }
      }

      return {
        count,
        average: Math.round(average * 100) / 100, // Round to 2 decimal places
        userRating
      };
    } catch (error) {
      handleApiError(error);
      return { count: 0, average: 0 };
    }
  }

  // Create or update a rating
  static async upsertTrailRating(trailId: string, rating: number): Promise<TrailRating> {
    try {
      const user = pb.authStore.model;
      if (!user) throw new Error('User not authenticated');

      // Check if user already has a rating for this trail
      const existingRatings = await pb.collection('trail_ratings').getList(1, 1, {
        filter: `trail = "${trailId}" && user = "${user.id}"`
      });

      if (existingRatings.items.length > 0) {
        // Update existing rating
        const updated = await pb.collection('trail_ratings').update(existingRatings.items[0].id, {
          rating
        });
        return updated as unknown as TrailRating;
      } else {
        // Create new rating
        const created = await pb.collection('trail_ratings').create({
          trail: trailId,
          user: user.id,
          rating
        });
        return created as unknown as TrailRating;
      }
    } catch (error) {
      handleApiError(error);
      throw error;
    }
  }

  // Delete a rating
  static async deleteTrailRating(ratingId: string): Promise<void> {
    try {
      await pb.collection('trail_ratings').delete(ratingId);
    } catch (error) {
      handleApiError(error);
      throw error;
    }
  }

  // COMMENTS METHODS

  // Get comments count for a trail
  static async getTrailCommentCount(trailId: string): Promise<number> {
    try {
      const response = await pb.collection('trail_comments').getList(1, 1, {
        filter: `trail = "${trailId}"`,
      });
      return response.totalItems;
    } catch (error) {
      handleApiError(error);
      return 0;
    }
  }

  // Get all comments for a trail
  static async getTrailComments(trailId: string): Promise<TrailCommentWithUser[]> {
    try {
      const response = await pb.collection('trail_comments').getList(1, 500, {
        filter: `trail = "${trailId}"`,
        expand: 'user',
        sort: '-created'
      });
      return response.items as unknown as TrailCommentWithUser[];
    } catch (error) {
      handleApiError(error);
      return [];
    }
  }

  // Create a comment
  static async createTrailComment(trailId: string, comment: string): Promise<TrailComment> {
    try {
      const user = pb.authStore.model;
      if (!user) throw new Error('User not authenticated');

      const created = await pb.collection('trail_comments').create({
        trail: trailId,
        user: user.id,
        comment
      });
      return created as unknown as TrailComment;
    } catch (error) {
      handleApiError(error);
      throw error;
    }
  }

  // Update a comment
  static async updateTrailComment(commentId: string, comment: string): Promise<TrailComment> {
    try {
      const updated = await pb.collection('trail_comments').update(commentId, {
        comment
      });
      return updated as unknown as TrailComment;
    } catch (error) {
      handleApiError(error);
      throw error;
    }
  }

  // Delete a comment
  static async deleteTrailComment(commentId: string): Promise<void> {
    try {
      await pb.collection('trail_comments').delete(commentId);
    } catch (error) {
      handleApiError(error);
      throw error;
    }
  }
}

export default pb;