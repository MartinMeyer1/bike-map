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
    },
    
    // Engagement data
    rating_average: props.rating_average,
    rating_count: props.rating_count,
    comment_count: props.comment_count
  };
}


export class MVTTrailService {
  private map: any; // L.Map
  private mvtLayer: any | null = null; // L.Layer
  private selectedTrailId: string | null = null; // Track currently selected trail
  private loadedTrails = new Map<string, MVTTrail>();
  private trailMarkers = new Map<string, { start: any; end: any }>(); // L.Marker
  private events: MVTTrailEvents = {};
  private baseUrl: string;
  private cacheVersion: string = ''; // Persistent cache version for all requests
  private updateMarkersTimeout: number | null = null; // Debounce timeout

  constructor(map: any, baseUrl?: string) { // L.Map
    this.map = map;
    this.baseUrl = baseUrl || import.meta.env.VITE_API_BASE_URL || 'http://localhost:8090';
    
    // Initialize with current timestamp as initial cache version
    this.generateCacheVersion();
    
    // Listen to map movement to re-add markers for trails that come back into view (debounced)
    this.map.on('moveend zoomend', () => {
      this.debouncedUpdateVisibleMarkers();
    });
  }

  setEvents(events: MVTTrailEvents) {
    this.events = events;
  }

  // Generate a new cache version for cache busting
  private generateCacheVersion(): void {
    this.cacheVersion = `v${Date.now()}`;
  }

  // Calculate marker size and visibility based on zoom level
  private getMarkerSizeForZoom(zoom: number): { iconSize: [number, number]; iconAnchor: [number, number]; opacity: number } | null {
    if (zoom <= 10) {
      // Small markers
      const size = 15;
      return {
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        opacity: 1
      };
    } else if (zoom <= 12) {
      // Medium markers
      const size = 22;
      return {
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        opacity: 1
      };
    } else if (zoom <= 14) {
      // Normal markers
      const size = 30;
      return {
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        opacity: 1
      };
    } else {
      // Large markers (zoom 17-18)
      const size = 38;
      return {
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        opacity: 1
      };
    }
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
      // Add getFeatureId to enable setFeatureStyle functionality
      getFeatureId: function(feature: any) {
        return feature.properties.id;
      },
      interactive: true,
      maxZoom: 18,
      attribution: ''
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
      
        // After tiles load, clean up trails that are no longer visible
        this.cleanupInvisibleTrails();
        
        // Notify about loaded trails (only currently visible ones)
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

    // Get current zoom level and marker sizing
    const zoom = this.map.getZoom();
    const markerConfig = this.getMarkerSizeForZoom(zoom);

    // If markers should be hidden at this zoom level, don't create them
    if (!markerConfig) {
      return;
    }

    // Create start marker (rock hand)
    const startMarker = (L as any).marker([trail.startPoint.lat, trail.startPoint.lng], {
      title: `${trail.name} - Start`,
      icon: (L as any).icon({
        iconUrl: '/rock.png',
        iconSize: markerConfig.iconSize,
        iconAnchor: markerConfig.iconAnchor,
        popupAnchor: [0, -markerConfig.iconAnchor[1]]
      }),
      opacity: markerConfig.opacity
    }).addTo(this.map);

    // Create end marker (beer)
    const endMarker = (L as any).marker([trail.endPoint.lat, trail.endPoint.lng], {
      title: `${trail.name} - End`,
      icon: (L as any).icon({
        iconUrl: '/beer.png',
        iconSize: markerConfig.iconSize,
        iconAnchor: markerConfig.iconAnchor,
        popupAnchor: [0, -markerConfig.iconAnchor[1]]
      }),
      opacity: markerConfig.opacity
    }).addTo(this.map);

    // Add click handlers to markers for trail selection
    const handleMarkerClick = () => {
      this.events.onTrailClick?.(trail);
    };

    startMarker.on('click', handleMarkerClick);
    endMarker.on('click', handleMarkerClick);

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
    
    // Remove all markers
    this.trailMarkers.forEach(({ start, end }) => {
      this.map.removeLayer(start);
      this.map.removeLayer(end);
    });
    
    // Clean up map event listeners and timeout
    this.map.off('moveend zoomend', this.debouncedUpdateVisibleMarkers);
    
    if (this.updateMarkersTimeout) {
      clearTimeout(this.updateMarkersTimeout);
      this.updateMarkersTimeout = null;
    }
    
    this.trailMarkers.clear();
    this.loadedTrails.clear();
    this.selectedTrailId = null;
  }

  private cleanupInvisibleTrails(): void {
    const mapBounds = this.map.getBounds();
    const currentBounds = {
      north: mapBounds.getNorth(),
      south: mapBounds.getSouth(),
      east: mapBounds.getEast(),
      west: mapBounds.getWest()
    };

    // Add buffer (50% of current view) to prevent premature removal
    const buffer = {
      lat: (currentBounds.north - currentBounds.south) * 0.5,
      lng: (currentBounds.east - currentBounds.west) * 0.5
    };

    const bufferedBounds = {
      north: currentBounds.north + buffer.lat,
      south: currentBounds.south - buffer.lat,
      east: currentBounds.east + buffer.lng,
      west: currentBounds.west - buffer.lng
    };

    // Find trails that are far outside buffered bounds
    const trailsToRemove: string[] = [];
    
    this.loadedTrails.forEach((trail, trailId) => {
      // Check if trail bounds intersect with buffered bounds
      const isVisible = !(
        trail.bounds.south > bufferedBounds.north ||
        trail.bounds.north < bufferedBounds.south ||
        trail.bounds.east < bufferedBounds.west ||
        trail.bounds.west > bufferedBounds.east
      );
      
      if (!isVisible) {
        trailsToRemove.push(trailId);
      }
    });

    // Remove trails that are far outside buffered bounds
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
    // Reset previous selection
    if (this.selectedTrailId && this.mvtLayer) {
      this.mvtLayer.resetFeatureStyle(this.selectedTrailId);
    }
    
    // Apply new selection
    if (trailId && this.mvtLayer) {
      const trail = this.loadedTrails.get(trailId);
      if (trail) {
        const trackColor = getLevelColor(trail.level);
        
        // Apply enhanced styling for selected trail
        this.mvtLayer.setFeatureStyle(trailId, {
          weight: 12,
          color: trackColor,
          opacity: 0.9,
          lineCap: 'round',
          lineJoin: 'round'
        });
      }
    }
    
    this.selectedTrailId = trailId;
  }

  refreshMVTLayer(): void {
    // Generate new cache version to invalidate all cached tiles
    this.generateCacheVersion();
    
    // Store current selection to restore it after refresh
    const currentSelection = this.selectedTrailId;
    
    // Remove the current MVT layer
    if (this.mvtLayer) {
      this.map.removeLayer(this.mvtLayer);
      this.mvtLayer = null;
    }

    // Clear loaded trails and markers
    this.loadedTrails.clear();
    this.trailMarkers.forEach(({ start, end }) => {
      this.map.removeLayer(start);
      this.map.removeLayer(end);
    });
    this.trailMarkers.clear();

    // Reset selection state
    this.selectedTrailId = null;

    // Add a small delay to ensure cleanup is complete
    setTimeout(() => {
      // Recreate and add the MVT layer with new cache version
      this.mvtLayer = this.createMVTLayer();
      this.map.addLayer(this.mvtLayer);
      
      // Restore selection after tiles load (if there was one)
      if (currentSelection) {
        // Wait a bit more for tiles to load before applying selection
        setTimeout(() => {
          this.selectTrail(currentSelection);
        }, 200);
      }
    }, 100);
  }

  getLoadedTrails(): MVTTrail[] {
    return Array.from(this.loadedTrails.values());
  }

  getTrailsInBounds(bounds: MapBounds): MVTTrail[] {
    return this.getLoadedTrails().filter(trail => {
      // Check if trail bounds intersect with map bounds (strict bounds for visible list)
      return !(
        trail.bounds.south > bounds.north ||
        trail.bounds.north < bounds.south ||
        trail.bounds.east < bounds.west ||
        trail.bounds.west > bounds.east
      );
    });
  }

  // Get only trails that are actually visible in current map view
  getVisibleTrails(): MVTTrail[] {
    const mapBounds = this.map.getBounds();
    const currentBounds = {
      north: mapBounds.getNorth(),
      south: mapBounds.getSouth(),
      east: mapBounds.getEast(),
      west: mapBounds.getWest()
    };
    
    return this.getTrailsInBounds(currentBounds);
  }

  // Update marker sizes based on current zoom level
  private updateMarkerSizes(): void {
    const zoom = this.map.getZoom();
    const markerConfig = this.getMarkerSizeForZoom(zoom);

    // Iterate through all markers and update their sizes
    this.trailMarkers.forEach((markers) => {
      if (!markerConfig) {
        // Hide markers if zoom is too far out
        if (this.map.hasLayer(markers.start)) {
          this.map.removeLayer(markers.start);
        }
        if (this.map.hasLayer(markers.end)) {
          this.map.removeLayer(markers.end);
        }
      } else {
        // Update icon sizes for existing markers
        const startIcon = (L as any).icon({
          iconUrl: '/rock.png',
          iconSize: markerConfig.iconSize,
          iconAnchor: markerConfig.iconAnchor,
          popupAnchor: [0, -markerConfig.iconAnchor[1]]
        });

        const endIcon = (L as any).icon({
          iconUrl: '/beer.png',
          iconSize: markerConfig.iconSize,
          iconAnchor: markerConfig.iconAnchor,
          popupAnchor: [0, -markerConfig.iconAnchor[1]]
        });

        markers.start.setIcon(startIcon);
        markers.start.setOpacity(markerConfig.opacity);

        markers.end.setIcon(endIcon);
        markers.end.setOpacity(markerConfig.opacity);

        // Re-add markers if they were previously removed
        if (!this.map.hasLayer(markers.start)) {
          markers.start.addTo(this.map);
        }
        if (!this.map.hasLayer(markers.end)) {
          markers.end.addTo(this.map);
        }
      }
    });
  }

  // Debounced version of updateVisibleMarkers
  private debouncedUpdateVisibleMarkers(): void {
    // Clear existing timeout
    if (this.updateMarkersTimeout) {
      clearTimeout(this.updateMarkersTimeout);
    }

    // Set new timeout (300ms debounce)
    this.updateMarkersTimeout = window.setTimeout(() => {
      this.updateVisibleMarkers();
      this.updateMarkersTimeout = null;
    }, 300);
  }

  // Update markers when map moves - re-add missing markers for visible trails
  private updateVisibleMarkers(): void {
    if (!this.mvtLayer) return;

    // Get current visible trails
    const visibleTrails = this.getVisibleTrails();

    // Add missing markers for visible trails
    visibleTrails.forEach(trail => {
      if (!this.trailMarkers.has(trail.id)) {
        this.createTrailMarkers(trail);
      }
    });

    // Update marker sizes based on current zoom level
    this.updateMarkerSizes();

    // Notify about current visible trails
    this.events.onTrailsLoaded?.(visibleTrails);
  }
}