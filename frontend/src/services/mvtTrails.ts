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
    (layer as any).on('tileload', (e: any) => {
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
    
    // Create new MVT layer for the selected trail with gradient styling
    if (trailId) {
      this.createSelectedTrailLayer(trailId);
    }
  }

  private removeSelectionOverlay(): void {
    if (this.selectedOverlayLayer) {
      this.map.removeLayer(this.selectedOverlayLayer);
      this.selectedOverlayLayer = null;
    }
  }

  private createSelectedTrailLayer(trailId: string): void {
    const trail = this.loadedTrails.get(trailId);
    if (!trail) {
      console.warn('❌ Trail not found:', trailId);
      return;
    }

    console.log('🎨 Creating selected trail layer for:', trailId);
    
    // Create a new MVT layer filtered to only show the selected trail
    const url = `${this.baseUrl}/api/tiles/{z}/{x}/{y}.mvt`;
    
    this.selectedOverlayLayer = L.vectorGrid.protobuf(url, {
      vectorTileLayerStyles: {
        'trails': (properties: MVTTrailProperties) => {
          // Only style the selected trail
          if (properties.id !== trailId) {
            // Hide other trails by making them transparent
            return { opacity: 0, fillOpacity: 0, weight: 0 };
          }

          // Style the selected trail with gradient effect
          const trackColor = getLevelColor(trail.level);
          
          return {
            weight: 12,
            color: trackColor,
            opacity: 0.8,
            lineCap: 'round',
            lineJoin: 'round',
            // Add a slight shadow effect
            shadowColor: '#000000',
            shadowBlur: 3
          };
        }
      },
      interactive: false, // Don't need interaction on selection layer
      maxZoom: 18,
      attribution: 'BikeMap Selection'
    });

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