import PocketBase from 'pocketbase';
import { Trail, User } from '../types';

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
    } catch (error: any) {
      // Handle specific error responses
      if (error?.status) {
        switch (error.status) {
          case 400:
            if (error.data?.message) {
              throw new Error(`Invalid data: ${error.data.message}`);
            }
            throw new Error('Invalid trail data. Please check your input and try again.');
          case 401:
            throw new Error('Authentication required. Please log in and try again.');
          case 403:
            throw new Error('You do not have permission to create trails. Only Editor and Admin users can create trails.');
          case 413:
            throw new Error('File too large. Please use a smaller GPX file (max 5MB).');
          case 415:
            throw new Error('Invalid file type. Please upload a valid GPX file.');
          case 422:
            if (error.data?.data) {
              const fieldErrors = Object.entries(error.data.data)
                .map(([field, errors]: [string, any]) => `${field}: ${Array.isArray(errors) ? errors.join(', ') : errors}`)
                .join('; ');
              throw new Error(`Validation errors: ${fieldErrors}`);
            }
            throw new Error('Validation failed. Please check your input and try again.');
          case 500:
            throw new Error('Server error. Please try again later.');
          default:
            throw new Error(`Upload failed with status ${error.status}. Please try again.`);
        }
      }
      
      // Handle network or other errors
      if (error.name === 'NetworkError' || !navigator.onLine) {
        throw new Error('Network error. Please check your connection and try again.');
      }
      
      // Fallback error message
      throw new Error(error.message || 'Failed to create trail. Please try again.');
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
    } catch (error: any) {
      // Handle specific error responses
      if (error?.status) {
        switch (error.status) {
          case 400:
            if (error.data?.message) {
              throw new Error(`Invalid data: ${error.data.message}`);
            }
            throw new Error('Invalid trail data. Please check your input and try again.');
          case 401:
            throw new Error('Authentication required. Please log in and try again.');
          case 403:
            throw new Error('You do not have permission to edit this trail. Only the owner or Admin users can edit trails.');
          case 404:
            throw new Error('Trail not found. It may have been deleted.');
          case 413:
            throw new Error('File too large. Please use a smaller GPX file (max 5MB).');
          case 415:
            throw new Error('Invalid file type. Please upload a valid GPX file.');
          case 422:
            if (error.data?.data) {
              const fieldErrors = Object.entries(error.data.data)
                .map(([field, errors]: [string, any]) => `${field}: ${Array.isArray(errors) ? errors.join(', ') : errors}`)
                .join('; ');
              throw new Error(`Validation errors: ${fieldErrors}`);
            }
            throw new Error('Validation failed. Please check your input and try again.');
          case 500:
            throw new Error('Server error. Please try again later.');
          default:
            throw new Error(`Update failed with status ${error.status}. Please try again.`);
        }
      }
      
      // Handle network or other errors
      if (error.name === 'NetworkError' || !navigator.onLine) {
        throw new Error('Network error. Please check your connection and try again.');
      }
      
      // Fallback error message
      throw new Error(error.message || 'Failed to update trail. Please try again.');
    }
  }

  static async deleteTrail(id: string): Promise<void> {
    if (!pb.authStore.isValid) {
      throw new Error('You must be logged in to delete a trail');
    }
    
    try {
      await pb.collection('trails').delete(id);
    } catch (error: any) {
      // Handle specific error responses
      if (error?.status) {
        switch (error.status) {
          case 401:
            throw new Error('Authentication required. Please log in and try again.');
          case 403:
            throw new Error('You do not have permission to delete this trail. Only the owner or Admin users can delete trails.');
          case 404:
            throw new Error('Trail not found. It may have already been deleted.');
          case 500:
            throw new Error('Server error. Please try again later.');
          default:
            throw new Error(`Delete failed with status ${error.status}. Please try again.`);
        }
      }
      
      // Handle network or other errors
      if (error.name === 'NetworkError' || !navigator.onLine) {
        throw new Error('Network error. Please check your connection and try again.');
      }
      
      // Fallback error message
      throw new Error(error.message || 'Failed to delete trail. Please try again.');
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
    if (typeof trail.owner === 'object' && trail.owner.id === user.id) return true;
    if (typeof trail.owner === 'string' && trail.owner === user.id) return true;
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