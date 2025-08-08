import L from 'leaflet';
import 'leaflet.vectorgrid';
import { MVTTrailProperties, MVTTrail, MapBounds } from '../types';
import { getLevelColor, hexToRgb } from '../utils/colors';

export interface MVTTrailEvents {
  onTrailClick?: (trail: MVTTrail) => void;
  onTrailsLoaded?: (trails: MVTTrail[]) => void;
  onTileLoad?: () => void;
}

// Convert MVT properties to MVTTrail interface
export function convertMVTPropertiesToTrail(props: MVTTrailProperties): MVTTrail {
  return {
    id: props.id,
    name: props.name,
    description: props.description,
    level: props.level,
    tags: props.tags ? props.tags.split(',').map(tag => tag.trim()) : [],
    owner: props.owner_id,
    created: props.created_at,
    updated: props.updated_at,
    
    bounds: {
      north: props.bbox_north,
      south: props.bbox_south,
      east: props.bbox_east,
      west: props.bbox_west
    },
    
    elevation: {
      gain: props.elevation_gain_meters,
      loss: props.elevation_loss_meters,
      min: props.min_elevation_meters,
      max: props.max_elevation_meters,
      start: props.elevation_start_meters,
      end: props.elevation_end_meters
    },
    
    distance: props.distance_m,
    
    startPoint: {
      lat: props.start_lat,
      lng: props.start_lng
    },
    
    endPoint: {
      lat: props.end_lat,
      lng: props.end_lng
    }
  };
}

// Darken color for selected trail effect
function darkenColor(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  const r = Math.round(rgb.r * (1 - amount));
  const g = Math.round(rgb.g * (1 - amount));
  const b = Math.round(rgb.b * (1 - amount));
  
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export class MVTTrailService {
  private map: any; // L.Map
  private mvtLayer: any | null = null; // L.Layer
  private selectedOverlayLayer: any | null = null; // For gradient effect
  private loadedTrails = new Map<string, MVTTrail>();
  private trailMarkers = new Map<string, { start: any; end: any }>(); // L.Marker
  private events: MVTTrailEvents = {};
  private baseUrl: string;

  constructor(map: any, baseUrl?: string) { // L.Map
    this.map = map;
    this.baseUrl = baseUrl || import.meta.env.VITE_API_BASE_URL || 'http://localhost:8090';
  }

  setEvents(events: MVTTrailEvents) {
    this.events = events;
  }

  createMVTLayer(): any {
    const url = `${this.baseUrl}/api/tiles/{z}/{x}/{y}.mvt`;
    
    const layer = L.vectorGrid.protobuf(url, {
      vectorTileLayerStyles: {
        'trails': (properties: MVTTrailProperties) => {
          // Convert and store trail data
          const trail = convertMVTPropertiesToTrail(properties);
          this.loadedTrails.set(trail.id, trail);
          
          // Create markers for this trail (must be done in styling function)
          this.createTrailMarkers(trail);
          
          // Style the trail line - always normal style, selection handled separately
          const trackColor = getLevelColor(trail.level);
          
          return {
            weight: 6,
            color: trackColor,
            opacity: 0.8,
            lineCap: 'round',
            lineJoin: 'round'
          };
        }
      },
      interactive: true,
      maxZoom: 18,
      attribution: 'BikeMap MVT'
    });

    // Handle trail clicks
    (layer as any).on('click', (e: any) => {
      if (e.layer && e.layer.properties) {
        const trail = convertMVTPropertiesToTrail(e.layer.properties);
        this.events.onTrailClick?.(trail);
      }
    });

    // Handle tile loading events
    (layer as any).on('tileload', () => {
      this.events.onTileLoad?.();
      
      // Notify about loaded trails
      const trails = Array.from(this.loadedTrails.values());
      this.events.onTrailsLoaded?.(trails);
    });

    return layer;
  }

  private createTrailMarkers(trail: MVTTrail) {
    // Prevent duplicate markers
    if (this.trailMarkers.has(trail.id)) {
      return;
    }

    // Create start marker (🤘)
    const startMarker = (L as any).marker([trail.startPoint.lat, trail.startPoint.lng], {
      title: `${trail.name} - Start`,
      icon: (L as any).divIcon({
        html: '<div style="font-size: 24px;">🤘</div>',
        className: 'emoji-marker',
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        popupAnchor: [0, -15]
      })
    }).addTo(this.map);

    // Create end marker (🍺)
    const endMarker = (L as any).marker([trail.endPoint.lat, trail.endPoint.lng], {
      title: `${trail.name} - End`,
      icon: (L as any).divIcon({
        html: '<div style="font-size: 24px;">🍺</div>',
        className: 'emoji-marker',
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        popupAnchor: [0, -15]
      })
    }).addTo(this.map);

    // Store markers
    this.trailMarkers.set(trail.id, { start: startMarker, end: endMarker });
  }

  addToMap(): void {
    if (this.mvtLayer) {
      this.map.removeLayer(this.mvtLayer);
    }
    
    this.mvtLayer = this.createMVTLayer();
    this.map.addLayer(this.mvtLayer);
  }

  removeFromMap(): void {
    if (this.mvtLayer) {
      this.map.removeLayer(this.mvtLayer);
    }
    
    // Remove selection overlay
    this.removeSelectionOverlay();
    
    // Remove all markers
    this.trailMarkers.forEach(({ start, end }) => {
      this.map.removeLayer(start);
      this.map.removeLayer(end);
    });
    
    this.trailMarkers.clear();
    this.loadedTrails.clear();
  }

  selectTrail(trailId: string | null): void {
    
    // Remove previous selection overlay
    this.removeSelectionOverlay();
    
    // Create new selection overlay for the selected trail
    if (trailId) {
      this.createGradientSelectionOverlay(trailId);
    }
  }

  private removeSelectionOverlay(): void {
    if (this.selectedOverlayLayer) {
      this.map.removeLayer(this.selectedOverlayLayer);
      this.selectedOverlayLayer = null;
    }
  }

  private async createGradientSelectionOverlay(trailId: string): Promise<void> {
    const trail = this.loadedTrails.get(trailId);
    if (!trail) return;

    try {
      // Fetch the actual trail GPX data to create gradient effect
      const gpxResponse = await fetch(`${this.baseUrl}/api/files/trails/${trailId}/${trailId}.gpx`);
      if (!gpxResponse.ok) {
        console.warn('Could not fetch trail GPX for gradient effect');
        this.createSimpleSelectionOverlay(trail);
        return;
      }

      const gpxText = await gpxResponse.text();
      const parser = new DOMParser();
      const gpxDoc = parser.parseFromString(gpxText, 'text/xml');
      
      // Extract track points
      const trackPoints: Array<{lat: number, lng: number}> = [];
      const trkpts = gpxDoc.querySelectorAll('trkpt');
      
      trkpts.forEach(trkpt => {
        const lat = parseFloat(trkpt.getAttribute('lat') || '0');
        const lng = parseFloat(trkpt.getAttribute('lon') || '0');
        trackPoints.push({ lat, lng });
      });

      if (trackPoints.length > 1) {
        this.createGradientTrail(trackPoints, trail);
      } else {
        this.createSimpleSelectionOverlay(trail);
      }
    } catch (error) {
      console.warn('Error creating gradient selection overlay:', error);
      this.createSimpleSelectionOverlay(trail);
    }
  }

  private createGradientTrail(trackPoints: Array<{lat: number, lng: number}>, trail: MVTTrail): void {
    const trackColor = getLevelColor(trail.level);
    this.selectedOverlayLayer = (L as any).layerGroup();

    // Create wider background line with 50% opacity
    const backgroundLine = (L as any).polyline(trackPoints.map(p => [p.lat, p.lng]), {
      color: trackColor,
      weight: 12,
      opacity: 0.5
    });
    this.selectedOverlayLayer.addLayer(backgroundLine);

    // Create gradient trail segments
    const segmentLength = Math.max(1, Math.floor(trackPoints.length / 20)); // ~20 segments
    
    for (let i = 0; i < trackPoints.length - 1; i += segmentLength) {
      const endIndex = Math.min(i + segmentLength, trackPoints.length - 1);
      const segmentPoints = trackPoints.slice(i, endIndex + 1);
      
      if (segmentPoints.length < 2) continue;
      
      // Calculate progress along trail (0 to 1)
      const progress = i / (trackPoints.length - 1);
      
      // Create gradient from start color to end color
      const startColor = darkenColor(trackColor, 0.3);
      const endColor = '#ffffff';
      
      // Interpolate between colors
      const startRGB = hexToRgb(startColor);
      const endRGB = hexToRgb(endColor);
      
      const r = Math.round(startRGB.r + (endRGB.r - startRGB.r) * progress);
      const g = Math.round(startRGB.g + (endRGB.g - startRGB.g) * progress);
      const b = Math.round(startRGB.b + (endRGB.b - startRGB.b) * progress);
      
      const segmentColor = `rgb(${r}, ${g}, ${b})`;
      
      const segmentLine = (L as any).polyline(segmentPoints.map(p => [p.lat, p.lng]), {
        color: segmentColor,
        weight: 6,
        opacity: 0.9
      });
      
      this.selectedOverlayLayer.addLayer(segmentLine);
    }

    this.selectedOverlayLayer.addTo(this.map);
  }

  private createSimpleSelectionOverlay(trail: MVTTrail): void {
    const trackColor = getLevelColor(trail.level);
    this.selectedOverlayLayer = (L as any).layerGroup();
    
    // Create a simple highlight using trail bounds
    const bounds = [
      [trail.bounds.south, trail.bounds.west],
      [trail.bounds.north, trail.bounds.east]
    ];
    
    const highlight = (L as any).rectangle(bounds, {
      color: trackColor,
      weight: 3,
      opacity: 0.6,
      fillOpacity: 0.1,
      dashArray: '8, 4'
    });
    
    this.selectedOverlayLayer.addLayer(highlight);
    this.selectedOverlayLayer.addTo(this.map);
  }

  getLoadedTrails(): MVTTrail[] {
    return Array.from(this.loadedTrails.values());
  }

  getTrailsInBounds(bounds: MapBounds): MVTTrail[] {
    return this.getLoadedTrails().filter(trail => {
      // Check if trail bounds intersect with map bounds
      return !(
        trail.bounds.south > bounds.north ||
        trail.bounds.north < bounds.south ||
        trail.bounds.east < bounds.west ||
        trail.bounds.west > bounds.east
      );
    });
  }
}