import L from 'leaflet';
import 'leaflet.vectorgrid';
import { MVTTrailProperties, MVTTrail, MapBounds } from '../types';
import { getLevelColor } from '../utils/colors';

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


export class MVTTrailService {
  private map: any; // L.Map
  private mvtLayer: any | null = null; // L.Layer
  private selectedOverlayLayer: any | null = null; // For gradient effect
  private loadedTrails = new Map<string, MVTTrail>();
  private trailMarkers = new Map<string, { start: any; end: any }>(); // L.Marker
  private events: MVTTrailEvents = {};
  private baseUrl: string;
  private cacheVersion: string = ''; // Persistent cache version for all requests

  constructor(map: any, baseUrl?: string) { // L.Map
    this.map = map;
    this.baseUrl = baseUrl || import.meta.env.VITE_API_BASE_URL || 'http://localhost:8090';
    
    // Initialize with current timestamp as initial cache version
    this.generateCacheVersion();
  }

  setEvents(events: MVTTrailEvents) {
    this.events = events;
  }

  // Generate a new cache version for cache busting
  private generateCacheVersion(): void {
    this.cacheVersion = `v${Date.now()}`;
    console.log(`🔄 Generated new MVT cache version: ${this.cacheVersion}`);
  }

  createMVTLayer(): any {
    // Add cache version to all tile requests
    const url = `${this.baseUrl}/api/tiles/{z}/{x}/{y}.mvt?cache=${this.cacheVersion}`;
    
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


    // Handle tile loading events with throttling
    let tileLoadThrottleTimer: ReturnType<typeof setTimeout>;
    (layer as any).on('tileload', () => {
      this.events.onTileLoad?.();
      
      // Throttle expensive operations to avoid overwhelming the UI
      clearTimeout(tileLoadThrottleTimer);
      tileLoadThrottleTimer = setTimeout(() => {
        // After tiles load, clean up trails that are no longer visible
        this.cleanupInvisibleTrails();
        
        // Notify about loaded trails (only currently visible ones)
        const trails = Array.from(this.loadedTrails.values());
        this.events.onTrailsLoaded?.(trails);
      }, 100); // 100ms throttle
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

  private cleanupInvisibleTrails(): void {
    const mapBounds = this.map.getBounds();
    const currentBounds = {
      north: mapBounds.getNorth(),
      south: mapBounds.getSouth(),
      east: mapBounds.getEast(),
      west: mapBounds.getWest()
    };

    // Find trails that are no longer visible (outside current bounds)
    const trailsToRemove: string[] = [];
    
    this.loadedTrails.forEach((trail, trailId) => {
      // Check if trail bounds intersect with current map bounds
      const isVisible = !(
        trail.bounds.south > currentBounds.north ||
        trail.bounds.north < currentBounds.south ||
        trail.bounds.east < currentBounds.west ||
        trail.bounds.west > currentBounds.east
      );
      
      if (!isVisible) {
        trailsToRemove.push(trailId);
      }
    });

    // Remove invisible trails and their markers
    trailsToRemove.forEach(trailId => {
      this.loadedTrails.delete(trailId);
      
      // Remove markers for this trail
      const markers = this.trailMarkers.get(trailId);
      if (markers) {
        this.map.removeLayer(markers.start);
        this.map.removeLayer(markers.end);
        this.trailMarkers.delete(trailId);
      }
    });
  }

  selectTrail(trailId: string | null): void {
    // Remove previous selection overlay
    this.removeSelectionOverlay();
    
    // Create new MVT layer for the selected trail with gradient styling
    if (trailId) {
      this.createSelectedTrailLayer(trailId);
    }
  }

  refreshMVTLayer(): void {
    console.log(`🔄 Refreshing MVT layer - generating new cache version`);
    
    // Generate new cache version to invalidate all cached tiles
    this.generateCacheVersion();
    
    // Remove the current MVT layer
    if (this.mvtLayer) {
      this.map.removeLayer(this.mvtLayer);
      this.mvtLayer = null;
    }

    // Remove selection overlay as well
    this.removeSelectionOverlay();

    // Clear loaded trails and markers
    this.loadedTrails.clear();
    this.trailMarkers.forEach(({ start, end }) => {
      this.map.removeLayer(start);
      this.map.removeLayer(end);
    });
    this.trailMarkers.clear();

    // Add a small delay to ensure cleanup is complete
    setTimeout(() => {
      // Recreate and add the MVT layer with new cache version
      this.mvtLayer = this.createMVTLayer();
      this.map.addLayer(this.mvtLayer);
      console.log(`✅ MVT layer refreshed with cache version: ${this.cacheVersion}`);
    }, 100);
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
      return;
    }
    
    // Create a new MVT layer filtered to only show the selected trail
    const url = `${this.baseUrl}/api/tiles/{z}/{x}/{y}.mvt?cache=${this.cacheVersion}`;
    
    this.selectedOverlayLayer = L.vectorGrid.protobuf(url, {
      vectorTileLayerStyles: {
        'trails': (properties: MVTTrailProperties) => {
          // Only style the selected trail
          if (properties.id !== trailId) {
            return { opacity: 0, fillOpacity: 0, weight: 0 };
          }

          const trackColor = getLevelColor(trail.level);
          
          return {
            weight: 16,
            color: trackColor,
            opacity: 0.6,
            lineCap: 'round',
            lineJoin: 'round'
          };
        }
      },
      interactive: false,
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