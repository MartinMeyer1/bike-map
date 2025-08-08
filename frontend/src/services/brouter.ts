export interface BRouterPoint {
  lat: number;
  lng: number;
}

export interface BRouterProfile {
  name: string;
  description?: string;
}

export interface BRouterResponse {
  type: string;
  features: Array<{
    type: string;
    properties: {
      name?: string;
      [key: string]: unknown;
    };
    geometry: {
      type: string;
      coordinates: number[][];
    };
  }>;
}

export interface BRouterOptions {
  profile?: string;
  alternativeIdx?: number;
  format?: 'gpx' | 'geojson' | 'kml';
  trackname?: string;
  turnInstructionMode?: number;
}

export class BRouterService {
  private static readonly DEFAULT_BASE_URL = 'http://localhost:17777';
  private static baseUrl: string;

  static initialize(baseUrl?: string) {
    this.baseUrl = baseUrl || import.meta.env.VITE_BROUTER_BASE_URL || this.DEFAULT_BASE_URL;
  }

  static getBaseUrl(): string {
    if (!this.baseUrl) {
      this.initialize();
    }
    return this.baseUrl;
  }

  static async calculateRoute(
    waypoints: BRouterPoint[],
    options: BRouterOptions = {}
  ): Promise<BRouterResponse> {
    if (waypoints.length < 2) {
      throw new Error('At least 2 waypoints are required for routing');
    }

    const baseUrl = this.getBaseUrl();
    const {
      profile = 'trekking',
      alternativeIdx = 0,
      format = 'geojson',
      trackname = 'brouter-route',
      turnInstructionMode = 0
    } = options;

    // Build lonlats parameter (lng,lat pairs separated by |)
    const lonlats = waypoints
      .map(point => `${point.lng},${point.lat}`)
      .join('|');

    const params = new URLSearchParams({
      lonlats,
      profile,
      alternativeidx: alternativeIdx.toString(),
      format,
      trackname,
      turnInstructionMode: turnInstructionMode.toString()
    });

    const url = `${baseUrl}/brouter?${params.toString()}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': format === 'geojson' ? 'application/json' : 'text/plain'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`BRouter API error (${response.status}): ${errorText}`);
      }

      if (format === 'geojson') {
        return await response.json();
      } else {
        const text = await response.text();
        return { type: 'text', features: [], text } as BRouterResponse & { text: string };
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
          throw new Error(`Unable to connect to BRouter service at ${baseUrl}. Please check if the service is running.`);
        }
        throw error;
      }
      throw new Error('Unknown error occurred while calculating route');
    }
  }

  static async getProfiles(): Promise<BRouterProfile[]> {
    const baseUrl = this.getBaseUrl();
    const url = `${baseUrl}/brouter/profiles2`;

    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch profiles: ${response.status}`);
      }

      const text = await response.text();
      
      // Parse simple text response - each line is a profile name
      const profiles = text
        .split('\n')
        .filter(line => line.trim())
        .map(name => ({ name: name.trim() }));

      return profiles;
    } catch (error) {
      console.warn('Could not fetch BRouter profiles:', error);
      // Return default profiles if service is not available
      return [
        { name: 'trekking', description: 'General purpose trekking profile' },
        { name: 'fastbike', description: 'Fast bike routing' },
        { name: 'mtb', description: 'Mountain bike routing' },
        { name: 'hiking', description: 'Hiking profile' }
      ];
    }
  }

  static async isServiceAvailable(): Promise<boolean> {
    try {
      const baseUrl = this.getBaseUrl();
      const response = await fetch(`${baseUrl}/brouter/profiles2`, { 
        method: 'HEAD',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  static convertGeoJsonToGpx(geoJson: BRouterResponse, trackName: string = 'BRouter Track'): string {
    if (!geoJson.features || geoJson.features.length === 0) {
      throw new Error('No route data found in GeoJSON');
    }

    const feature = geoJson.features[0];
    if (feature.geometry.type !== 'LineString') {
      throw new Error('Invalid route geometry - expected LineString');
    }

    const coordinates = feature.geometry.coordinates;
    
    let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="BRouter">
  <trk>
    <name>${trackName}</name>
    <trkseg>`;

    coordinates.forEach(coord => {
      const [lng, lat, ele] = coord;
      gpx += `
      <trkpt lat="${lat}" lon="${lng}">`;
      if (ele !== undefined) {
        gpx += `
        <ele>${ele}</ele>`;
      }
      gpx += `
      </trkpt>`;
    });

    gpx += `
    </trkseg>
  </trk>
</gpx>`;

    return gpx;
  }
}