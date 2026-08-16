import L from "leaflet";
import "leaflet.vectorgrid";
import { MVTTrailProperties, MVTTrail, MapBounds } from "../types";
import { getLevelColor } from "../utils/colors";
import { API_BASE_URL } from "../utils/apiBaseUrl";

export interface MVTTrailEvents {
  onTrailClick?: (trail: MVTTrail) => void;
  onTrailsLoaded?: (trails: MVTTrail[]) => void;
}

// How long tile arrivals are allowed to accumulate before one flush. Not a
// resetting debounce: the window starts at the first tile and fires regardless
// of later ones, so a long stream of tiles still reports at a steady cadence
// instead of being starved until it stops.
const TILE_FLUSH_MS = 150;

export function convertMVTPropertiesToTrail(
  props: MVTTrailProperties,
): MVTTrail {
  return {
    id: props.id,
    name: props.name,
    description: props.description,
    level: props.level,
    tags: props.tags ? props.tags.split(",").map((tag) => tag.trim()) : [],
    owner: props.owner_id,
    created: props.created_at,
    updated: props.updated_at,

    bounds: {
      north: props.bbox_north,
      south: props.bbox_south,
      east: props.bbox_east,
      west: props.bbox_west,
    },

    elevation: {
      gain: props.elevation_gain_meters,
      loss: props.elevation_loss_meters,
      min: props.min_elevation_meters,
      max: props.max_elevation_meters,
      start: props.elevation_start_meters,
      end: props.elevation_end_meters,
    },

    distance: props.distance_m,

    startPoint: {
      lat: props.start_lat,
      lng: props.start_lng,
    },

    endPoint: {
      lat: props.end_lat,
      lng: props.end_lng,
    },

    rating_average: props.rating_average,
    rating_count: props.rating_count,
    comment_count: props.comment_count,

    ridden: props.ridden,
  };
}

type TrailLayer = L.vectorGrid.VectorGridLayer;

const START_ICON_URL = "/rock.png";
const END_ICON_URL = "/beer.png";

// Four zoom buckets x two images means eight distinct icons for the lifetime of
// the app. L.Icon holds no per-marker state -- Leaflet builds a fresh element
// from it for each marker -- so one instance can back every marker at a size.
const iconCache = new Map<string, L.Icon>();

function markerIcon(iconUrl: string, size: number): L.Icon {
  const key = `${iconUrl}@${size}`;
  const cached = iconCache.get(key);

  if (cached) {
    return cached;
  }

  const half = size / 2;
  const icon = L.icon({
    iconUrl,
    iconSize: [size, size],
    iconAnchor: [half, half],
    popupAnchor: [0, -half],
  });

  iconCache.set(key, icon);

  return icon;
}

export class MVTTrailService {
  private map: L.Map;
  private mvtLayer: TrailLayer | null = null;
  private selectedTrailId: string | null = null; // Track currently selected trail
  private loadedTrails = new Map<string, MVTTrail>();
  private trailMarkers = new Map<string, { start: L.Marker; end: L.Marker }>();
  private events: MVTTrailEvents = {};
  private baseUrl: string;
  private cacheVersion: string = ""; // Persistent cache version for all requests
  private updateMarkersTimeout: number | null = null; // Debounce timeout
  private tileFlushTimeout: number | null = null; // Coalesces tileload bursts
  private appliedMarkerSize: number | null = null; // Icon size currently on screen
  // Held as a field so on() and off() are given the same reference; passing a
  // fresh arrow to each would leave the listener attached forever.
  private readonly handleMapMove = () => this.debouncedUpdateVisibleMarkers();

  constructor(map: L.Map, baseUrl?: string) {
    this.map = map;
    this.baseUrl = baseUrl || API_BASE_URL;

    this.generateCacheVersion();
  }

  setEvents(events: MVTTrailEvents) {
    this.events = events;
  }

  private generateCacheVersion(): void {
    this.cacheVersion = `v${Date.now()}`;
  }

  // Markers grow with zoom; every zoom level shows them.
  private getMarkerSizeForZoom(zoom: number): number {
    return zoom <= 10 ? 15 : zoom <= 12 ? 22 : zoom <= 14 ? 30 : 38;
  }

  createMVTLayer(): TrailLayer {
    const url = `${this.baseUrl}/api/tiles/{z}/{x}/{y}.mvt?cache=${this.cacheVersion}`;

    const layer = L.vectorGrid.protobuf(url, {
      vectorTileLayerStyles: {
        trails: (properties: MVTTrailProperties) => {
          const trail = convertMVTPropertiesToTrail(properties);
          this.loadedTrails.set(trail.id, trail);

          // Create markers for this trail (must be done in styling function)
          this.createTrailMarkers(trail);

          // Style the trail line - apply dashed pattern for non-ridden trails
          const trackColor = getLevelColor(trail.level);

          return {
            weight: 6,
            color: trackColor,
            opacity: trail.ridden ? 0.9 : 0.7,
            lineCap: "round",
            lineJoin: "round",
            dashArray: trail.ridden ? undefined : "12, 14", // Dashed for non-ridden trails
          };
        },
      },
      getFeatureId: (feature) => feature.properties.id,
      interactive: true,
      maxZoom: 18,
      attribution: "",
      pane: "overlayPane",
    });

    // Handle trail clicks. The hit sub-layer (and so the feature's properties)
    // is vector-grid specific, so widen the plain Leaflet event to reach it.
    layer.on("click", (e) => {
      const { layer: feature } = e as L.vectorGrid.VectorGridEvent<MVTTrailProperties>;
      if (feature?.properties) {
        const trail = convertMVTPropertiesToTrail(feature.properties);
        this.events.onTrailClick?.(trail);
      }
    });

    layer.on("tileload", () => this.scheduleTileFlush());

    return layer;
  }

  private createTrailMarkers(trail: MVTTrail) {
    if (this.trailMarkers.has(trail.id)) {
      return;
    }

    const size = this.getMarkerSizeForZoom(this.map.getZoom());

    const startMarker = L.marker(
      [trail.startPoint.lat, trail.startPoint.lng],
      {
        title: `${trail.name} - Start`,
        icon: markerIcon(START_ICON_URL, size),
      },
    ).addTo(this.map);

    const endMarker = L.marker(
      [trail.endPoint.lat, trail.endPoint.lng],
      {
        title: `${trail.name} - End`,
        icon: markerIcon(END_ICON_URL, size),
      },
    ).addTo(this.map);

    const handleMarkerClick = () => {
      this.events.onTrailClick?.(trail);
    };

    startMarker.on("click", handleMarkerClick);
    endMarker.on("click", handleMarkerClick);

    this.trailMarkers.set(trail.id, { start: startMarker, end: endMarker });
  }

  addToMap(): void {
    if (this.mvtLayer) {
      this.map.removeLayer(this.mvtLayer);
    }

    this.mvtLayer = this.createMVTLayer();
    this.map.addLayer(this.mvtLayer);

    // Paired with the off() in removeFromMap. Registering here rather than in
    // the constructor is what makes the pair symmetric: the service outlives
    // any single add/remove cycle, so a constructor-time listener would be
    // detached by the first teardown and never come back. Leaflet ignores a
    // repeat registration of the same function reference.
    this.map.on("moveend zoomend", this.handleMapMove);
  }

  removeFromMap(): void {
    if (this.mvtLayer) {
      this.map.removeLayer(this.mvtLayer);
    }

    this.trailMarkers.forEach(({ start, end }) => {
      this.map.removeLayer(start);
      this.map.removeLayer(end);
    });

    // Clean up map event listeners and timeout
    this.map.off("moveend zoomend", this.handleMapMove);

    if (this.updateMarkersTimeout) {
      clearTimeout(this.updateMarkersTimeout);
      this.updateMarkersTimeout = null;
    }

    this.cancelTileFlush();

    this.trailMarkers.clear();
    this.loadedTrails.clear();
    this.selectedTrailId = null;
    this.appliedMarkerSize = null;
  }

  // tileload fires once per tile, so a single pan can fire it a dozen times or
  // more. Each firing swept every loaded trail and pushed a fresh array into
  // React; now a burst of tiles costs one sweep and one dispatch.
  private scheduleTileFlush(): void {
    if (this.tileFlushTimeout !== null) {
      return;
    }

    this.tileFlushTimeout = window.setTimeout(() => {
      this.tileFlushTimeout = null;

      this.cleanupInvisibleTrails();
      this.events.onTrailsLoaded?.(this.getLoadedTrails());
    }, TILE_FLUSH_MS);
  }

  private cancelTileFlush(): void {
    if (this.tileFlushTimeout !== null) {
      clearTimeout(this.tileFlushTimeout);
      this.tileFlushTimeout = null;
    }
  }

  private cleanupInvisibleTrails(): void {
    const mapBounds = this.map.getBounds();
    const currentBounds = {
      north: mapBounds.getNorth(),
      south: mapBounds.getSouth(),
      east: mapBounds.getEast(),
      west: mapBounds.getWest(),
    };

    // Add buffer (50% of current view) to prevent premature removal
    const buffer = {
      lat: (currentBounds.north - currentBounds.south) * 0.5,
      lng: (currentBounds.east - currentBounds.west) * 0.5,
    };

    const bufferedBounds = {
      north: currentBounds.north + buffer.lat,
      south: currentBounds.south - buffer.lat,
      east: currentBounds.east + buffer.lng,
      west: currentBounds.west - buffer.lng,
    };

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

    trailsToRemove.forEach((trailId) => {
      this.loadedTrails.delete(trailId);

      const markers = this.trailMarkers.get(trailId);
      if (markers) {
        this.map.removeLayer(markers.start);
        this.map.removeLayer(markers.end);
        this.trailMarkers.delete(trailId);
      }
    });
  }

  selectTrail(trailId: string | null): void {
    if (this.selectedTrailId && this.mvtLayer) {
      this.mvtLayer.resetFeatureStyle(this.selectedTrailId);
    }

    if (trailId && this.mvtLayer) {
      const trail = this.loadedTrails.get(trailId);
      if (trail) {
        const trackColor = getLevelColor(trail.level);

        // Apply enhanced styling for selected trail
        this.mvtLayer.setFeatureStyle(trailId, {
          weight: 12,
          color: trackColor,
          opacity: 0.9,
          lineCap: "round",
          lineJoin: "round",
        });
      }
    }

    this.selectedTrailId = trailId;
  }

  refreshMVTLayer(): void {
    this.generateCacheVersion();

    // A flush queued against the old layer would report trails we are about to
    // clear.
    this.cancelTileFlush();

    const currentSelection = this.selectedTrailId;

    if (this.mvtLayer) {
      this.map.removeLayer(this.mvtLayer);
      this.mvtLayer = null;
    }

    this.loadedTrails.clear();
    this.trailMarkers.forEach(({ start, end }) => {
      this.map.removeLayer(start);
      this.map.removeLayer(end);
    });
    this.trailMarkers.clear();

    this.selectedTrailId = null;
    this.appliedMarkerSize = null;

    // Add a small delay to ensure cleanup is complete
    setTimeout(() => {
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
    return this.getLoadedTrails().filter((trail) => {
      // Check if trail bounds intersect with map bounds (strict bounds for visible list)
      return !(
        trail.bounds.south > bounds.north ||
        trail.bounds.north < bounds.south ||
        trail.bounds.east < bounds.west ||
        trail.bounds.west > bounds.east
      );
    });
  }

  getVisibleTrails(): MVTTrail[] {
    const mapBounds = this.map.getBounds();
    const currentBounds = {
      north: mapBounds.getNorth(),
      south: mapBounds.getSouth(),
      east: mapBounds.getEast(),
      west: mapBounds.getWest(),
    };

    return this.getTrailsInBounds(currentBounds);
  }

  private updateMarkerSizes(): void {
    const size = this.getMarkerSizeForZoom(this.map.getZoom());

    // setIcon replaces the marker's <img> element. Applying it on every settled
    // move rebuilt two DOM nodes per loaded trail even when the size was
    // identical, which is the common case: panning never changes the bucket.
    const sizeChanged = size !== this.appliedMarkerSize;
    this.appliedMarkerSize = size;

    this.trailMarkers.forEach((markers) => {
      if (sizeChanged) {
        markers.start.setIcon(markerIcon(START_ICON_URL, size));
        markers.end.setIcon(markerIcon(END_ICON_URL, size));
      }

      // Re-add markers if they were previously removed
      if (!this.map.hasLayer(markers.start)) {
        markers.start.addTo(this.map);
      }
      if (!this.map.hasLayer(markers.end)) {
        markers.end.addTo(this.map);
      }
    });
  }

  private debouncedUpdateVisibleMarkers(): void {
    if (this.updateMarkersTimeout) {
      clearTimeout(this.updateMarkersTimeout);
    }

    this.updateMarkersTimeout = window.setTimeout(() => {
      this.updateVisibleMarkers();
      this.updateMarkersTimeout = null;
    }, 300);
  }

  // Update markers when map moves - re-add missing markers for visible trails
  private updateVisibleMarkers(): void {
    if (!this.mvtLayer) return;

    const visibleTrails = this.getVisibleTrails();

    visibleTrails.forEach((trail) => {
      if (!this.trailMarkers.has(trail.id)) {
        this.createTrailMarkers(trail);
      }
    });

      this.updateMarkerSizes();

    this.events.onTrailsLoaded?.(visibleTrails);
  }
}
