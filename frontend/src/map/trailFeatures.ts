import type { Map as MapLibreMap, MapGeoJSONFeature } from "maplibre-gl";
import type { Feature } from "geojson";
import { MVTTrailProperties, MVTTrail } from "../types";
import {
  SOURCE_TRAILS,
  SOURCE_LAYER_TRAILS,
  LAYER_TRAILS,
} from "./ids";

/**
 * Turns a tile feature's properties into the shape the rest of the app speaks.
 *
 * This used to run inside vector-grid's per-feature styling callback, which
 * meant allocating one of these for every feature of every tile, on every
 * restyle, purely so the callback could read `level` and `ridden`. Styling is
 * now a style expression evaluated in the worker, so this only runs where a
 * trail object is genuinely wanted: the sidebar list and the selected trail.
 */
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

/**
 * The trails currently drawn on screen, deduplicated.
 *
 * A trail that crosses a tile boundary is clipped into one feature per tile, so
 * the same id comes back more than once; the first copy wins, since the
 * properties are identical across the pieces.
 *
 * This replaces the whole apparatus that used to keep this list by hand -- a
 * map of loaded trails, a tile-load flush timer, a move debounce, and a sweep
 * over every loaded trail against a 50%-buffered bounding box. Asking MapLibre
 * what it just rendered is the same answer by definition.
 */
export function queryVisibleTrails(map: MapLibreMap): MVTTrail[] {
  if (!map.getLayer(LAYER_TRAILS)) {
    return [];
  }

  const features = map.queryRenderedFeatures({ layers: [LAYER_TRAILS] });

  return dedupeTrails(features);
}

/**
 * Looks a trail up by id in the tiles currently held for the source.
 *
 * Used when a start/finish marker is clicked: the endpoint feature carries only
 * `trail_id`, and the line feature holding the full property set is guaranteed
 * to be in the same tile -- the tile index is built from the trail's geometry,
 * so any tile containing an endpoint also contains the line that ends there.
 */
export function findTrailById(
  map: MapLibreMap,
  trailId: string,
): MVTTrail | null {
  const features = map.querySourceFeatures(SOURCE_TRAILS, {
    sourceLayer: SOURCE_LAYER_TRAILS,
    filter: ["==", ["get", "id"], trailId],
  });

  const [trail] = dedupeTrails(features);

  return trail ?? null;
}

function dedupeTrails(
  features: Array<MapGeoJSONFeature | Feature>,
): MVTTrail[] {
  const byId = new Map<string, MVTTrail>();

  for (const feature of features) {
    const props = feature.properties as MVTTrailProperties | null;

    if (!props?.id || byId.has(props.id)) {
      continue;
    }

    byId.set(props.id, convertMVTPropertiesToTrail(props));
  }

  return Array.from(byId.values());
}
