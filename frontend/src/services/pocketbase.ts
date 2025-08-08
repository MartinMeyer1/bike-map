import PocketBase from 'pocketbase';
import { Trail, User } from '../types';
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

  static getTrailFileUrl(trail: Trail): string {
    // Construct the file URL manually since we have the trail ID and file name
    return `${pb.baseUrl}/api/files/trails/${trail.id}/${trail.file}`;
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

  static canEditTrail(trail: Trail, user: User | null): boolean {
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
}

export default pb;