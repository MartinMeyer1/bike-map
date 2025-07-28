import PocketBase from 'pocketbase';
import { Trail, User } from '../types';

// Initialize PocketBase client
const pb = new PocketBase('http://localhost:8090');

// Auto-refresh auth token
pb.authStore.onChange(() => {
  if (pb.authStore.isValid) {
    localStorage.setItem('pb_auth', JSON.stringify(pb.authStore.exportToCookie()));
  } else {
    localStorage.removeItem('pb_auth');
  }
});

// Restore auth state from localStorage
const storedAuth = localStorage.getItem('pb_auth');
if (storedAuth) {
  try {
    pb.authStore.loadFromCookie(storedAuth);
  } catch (e) {
    console.error('Failed to restore auth state:', e);
    localStorage.removeItem('pb_auth');
  }
}

export class PocketBaseService {
  static async login(email: string, password: string): Promise<User> {
    const authData = await pb.collection('users').authWithPassword(email, password);
    return {
      id: authData.record.id,
      email: authData.record.email,
      name: authData.record.name,
      avatar: authData.record.avatar,
    };
  }

  static async register(email: string, password: string, name?: string): Promise<User> {
    const userData = {
      email,
      password,
      passwordConfirm: password,
      name: name || email.split('@')[0],
    };

    const record = await pb.collection('users').create(userData);
    
    // Auto-login after registration
    const authData = await pb.collection('users').authWithPassword(email, password);
    
    return {
      id: authData.record.id,
      email: authData.record.email,
      name: authData.record.name,
      avatar: authData.record.avatar,
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
    };
  }

  static isAuthenticated(): boolean {
    return pb.authStore.isValid;
  }

  static async createTrail(formData: FormData): Promise<Trail> {
    if (!pb.authStore.isValid) {
      throw new Error('You must be logged in to create a trail');
    }
    
    const record = await pb.collection('trails').create(formData);
    return this.formatTrail(record);
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
    const record = await pb.collection('trails').getOne(id);
    
    return this.formatTrail(record);
  }

  static async updateTrail(id: string, formData: FormData): Promise<Trail> {
    const record = await pb.collection('trails').update(id, formData);
    return this.formatTrail(record);
  }

  static async deleteTrail(id: string): Promise<void> {
    await pb.collection('trails').delete(id);
  }

  static getFileUrl(record: any, filename: string): string {
    return pb.files.getUrl(record, filename);
  }

  static getTrailFileUrl(trail: Trail): string {
    // Construct the file URL manually since we have the trail ID and file name
    return `${pb.baseUrl}/api/files/trails/${trail.id}/${trail.file}`;
  }

  private static formatTrail(record: any): Trail {
    return {
      id: record.id,
      name: record.name,
      description: record.description,
      level: record.level,
      tags: record.tags || [],
      file: record.file,
      owner: record.owner,
      created: record.created,
      updated: record.updated,
    };
  }
}

export default pb;