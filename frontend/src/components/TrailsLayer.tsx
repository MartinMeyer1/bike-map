import { useEffect } from "react";
import type {
  ExpressionSpecification,
  MapGeoJSONFeature,
  MapMouseEvent,
  PointLike,
  VectorTileSource,
} from "maplibre-gl";
import { MVTTrail, MVTTrailProperties } from "../types";
import { useMap } from "../map/useMap";
import { API_BASE_URL } from "../utils/apiBaseUrl";
import { getLevelColor } from "../utils/colors";
import {
  LAYER_ENDPOINTS,
  LAYER_TRAILS,
  LAYER_TRAILS_SELECTED,
  SELECTABLE_LAYERS,
  SOURCE_LAYER_ENDPOINTS,
  SOURCE_LAYER_TRAILS,
  SOURCE_TRAILS,
} from "../map/ids";
import {
  FALLBACK_LEVEL,
  KNOWN_LEVELS,
  MARKER_GLYPH_MIN_ZOOM,
  MARKER_SIZE,
} from "../map/markerImages";
import { TRAIL_STYLE } from "../map/mapTheme";
import {
  convertMVTPropertiesToTrail,
  findTrailById,
  queryVisibleTrails,
} from "../map/trailFeatures";

/** Matches the backend's tile_config. */
const SOURCE_MIN_ZOOM = 6;

/**
 * Where the backend stops adding anything.
 *
 * `get_simplification_tolerance` in mvt-server/initdb/init.sql returns 0 from
 * zoom 12 up, so a z13 tile carries exactly the geometry its z12 parent already
 * did, cut into four. Telling the source that 12 is as deep as it goes has
 * MapLibre scale that parent locally instead, and zooming or panning anywhere
 * above 12 -- which is most of the riding, most of the time -- then asks the
 * backend for nothing at all.
 *
 * The cost is quantisation: a tile's geometry is snapped to a 4096-unit grid, so
 * at z12 the step is about 1.6m on the ground, roughly four screen pixels once
 * the map is at z18. If that reads as a staircase under the lines, 13 halves it
 * and 14 quarters it -- the backend serves every zoom either way.
 */
const SOURCE_MAX_ZOOM = 12;

const {
  width: TRAIL_WIDTH,
  selectedWidth: SELECTED_WIDTH,
  dash: DASH_PATTERN,
  solid: SOLID_PATTERN,
} = TRAIL_STYLE;

/** Half of the hit box a click is tested against, in screen pixels. */
const MOUSE_TOLERANCE = 6;
const TOUCH_TOLERANCE = 22;

/** No trail id is empty, so this filter matches nothing. */
const NO_SELECTION = "";

/**
 * The expression helpers below build style JSON, which TypeScript cannot check
 * structurally without spelling out every tuple. They are asserted once here
 * rather than at each use.
 */
const expression = (value: unknown[]): ExpressionSpecification =>
  value as unknown as ExpressionSpecification;

/**
 * The grade colours, read from the design tokens so the map and the badges
 * cannot drift apart. Built once per layer creation rather than per feature:
 * this used to be a JS callback vector-grid invoked for every feature of every
 * tile.
 */
function levelColorExpression(): ExpressionSpecification {
  const cases = KNOWN_LEVELS.flatMap((level) => [level, getLevelColor(level)]);

  return expression([
    "match",
    ["get", "level"],
    ...cases,
    getLevelColor(FALLBACK_LEVEL),
  ]);
}

/**
 * `trail-<role>-<level>-<variant>`, matching the ids registered in
 * markerImages. The zoom test has to be the outermost expression -- MapLibre
 * only accepts `zoom` at the top level of a layout property -- so the two
 * variants are built as whole names rather than by appending a suffix.
 */
function endpointIconExpression(): ExpressionSpecification {
  const level = [
    "match",
    ["get", "level"],
    [...KNOWN_LEVELS],
    ["get", "level"],
    FALLBACK_LEVEL,
  ];

  const nameFor = (variant: "sm" | "lg") => [
    "concat",
    "trail-",
    ["get", "role"],
    "-",
    level,
    `-${variant}`,
  ];

  return expression([
    "step",
    ["zoom"],
    nameFor("sm"),
    MARKER_GLYPH_MIN_ZOOM,
    nameFor("lg"),
  ]);
}

/**
 * The design calls for the full 28px footprint from z12 in, receding to a 16px
 * dot at the zoom the app opens at, where a cantonal view holds close to a
 * thousand trail ends and full-size discs would bury the terrain. Interpolated
 * rather than stepped, because the GPU is redrawing the icon every frame
 * anyway and a smooth change reads better than three jumps.
 */
function endpointSizeExpression(): ExpressionSpecification {
  return expression([
    "interpolate",
    ["linear"],
    ["zoom"],
    10,
    16 / MARKER_SIZE,
    11,
    22 / MARKER_SIZE,
    12,
    1,
  ]);
}

function tileUrl(cacheVersion: string): string {
  return `${API_BASE_URL}/api/tiles/{z}/{x}/{y}.mvt?cache=${cacheVersion}`;
}

function newCacheVersion(): string {
  return `v${Date.now()}`;
}

/*
 * Deliberately outside the component.
 *
 * There is only ever one TrailsLayer, but it is remounted every time the base
 * map changes -- a new style means new layers, added from scratch. Held in a
 * ref, the cache key would be minted fresh on each of those mounts and every
 * trail tile would be refetched to answer a question about the base map. The
 * key belongs to the tiles, so it outlives the mounts that draw them.
 *
 * `appliedRefreshTrigger` is what keeps the same arrangement from bumping the
 * key on mount: the refresh effect has to be able to tell a trail that was just
 * edited from a component that has simply come back.
 */
let cacheVersion = newCacheVersion();
let appliedRefreshTrigger = 0;

interface TrailsLayerProps {
  selectedTrail: MVTTrail | null;
  onTrailClick: (trail: MVTTrail | null) => void;
  onTrailsLoaded?: (trails: MVTTrail[]) => void;
  refreshTrigger?: number;
}

/**
 * The trail lines and their start/finish markers.
 *
 * Replaces MVTTrailService, which kept a map of loaded trails, created two DOM
 * markers per trail, swept them against a buffered bounding box on a timer, and
 * re-styled features by hand. All of that is now either a style expression or a
 * query against what MapLibre has already rendered.
 */
export function TrailsLayer({
  selectedTrail,
  onTrailClick,
  onTrailsLoaded,
  refreshTrigger,
}: TrailsLayerProps) {
  const map = useMap();
  const selectedId = selectedTrail?.id ?? null;

  // Source and layers. Declared first so that on mount they exist before every
  // effect below runs, and on unmount they are torn down before those effects
  // clean up -- which is why the cleanups that touch the source check it is
  // still there.
  useEffect(() => {
    map.addSource(SOURCE_TRAILS, {
      type: "vector",
      tiles: [tileUrl(cacheVersion)],
      minzoom: SOURCE_MIN_ZOOM,
      maxzoom: SOURCE_MAX_ZOOM,
      // Promotes the trail's own text id to the feature id, which is what makes
      // feature-state addressable. Scoped to the lines layer so the endpoint
      // points are left alone.
      promoteId: { [SOURCE_LAYER_TRAILS]: "id" },
    });

    const linePaint = {
      "line-color": levelColorExpression(),
      "line-width": expression([
        "case",
        ["boolean", ["feature-state", "selected"], false],
        SELECTED_WIDTH,
        TRAIL_WIDTH,
      ]),
      // Full strength, ridden or not: solid versus dashed already carries that
      // distinction, and dimming an unridden trail on top of it only made it
      // harder to see against the terrain.
      "line-opacity": 1,
      "line-dasharray": expression([
        "case",
        ["get", "ridden"],
        ["literal", SOLID_PATTERN],
        ["literal", DASH_PATTERN],
      ]),
    };

    const lineLayout = {
      "line-cap": "round" as const,
      "line-join": "round" as const,
    };

    map.addLayer({
      id: LAYER_TRAILS,
      type: "line",
      source: SOURCE_TRAILS,
      "source-layer": SOURCE_LAYER_TRAILS,
      layout: lineLayout,
      paint: linePaint,
    });

    // The same trail drawn once more on top. feature-state gives the selection
    // its appearance but cannot reorder anything, so without this a selected
    // trail can still sit underneath a neighbour that happens to be drawn after
    // it.
    map.addLayer({
      id: LAYER_TRAILS_SELECTED,
      type: "line",
      source: SOURCE_TRAILS,
      "source-layer": SOURCE_LAYER_TRAILS,
      filter: ["==", ["get", "id"], NO_SELECTION],
      layout: lineLayout,
      paint: linePaint,
    });

    map.addLayer({
      id: LAYER_ENDPOINTS,
      type: "symbol",
      source: SOURCE_TRAILS,
      "source-layer": SOURCE_LAYER_ENDPOINTS,
      layout: {
        "icon-image": endpointIconExpression(),
        "icon-size": endpointSizeExpression(),
        // Every marker is drawn, as Leaflet drew them. Letting MapLibre's
        // collision engine thin them out at low zoom is a one-line change here,
        // but it would silently drop trail ends the map used to show.
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
    });

    return () => {
      for (const id of [LAYER_ENDPOINTS, LAYER_TRAILS_SELECTED, LAYER_TRAILS]) {
        if (map.getLayer(id)) {
          map.removeLayer(id);
        }
      }

      if (map.getSource(SOURCE_TRAILS)) {
        map.removeSource(SOURCE_TRAILS);
      }
    };
  }, [map]);

  // Selection: the feature's own state, re-asserted whenever the source
  // reloads, and cleared on the way out.
  useEffect(() => {
    if (!selectedId) {
      return;
    }

    const target = {
      source: SOURCE_TRAILS,
      sourceLayer: SOURCE_LAYER_TRAILS,
      id: selectedId,
    };

    const apply = () => map.setFeatureState(target, { selected: true });

    apply();

    // A refresh replaces every tile in the source; re-applying here is cheaper
    // than reasoning about whether the state survived.
    const handleSourceData = (event: { sourceId?: string }) => {
      if (event.sourceId === SOURCE_TRAILS) {
        apply();
      }
    };

    map.on("sourcedata", handleSourceData);

    return () => {
      map.off("sourcedata", handleSourceData);

      if (map.getSource(SOURCE_TRAILS)) {
        map.removeFeatureState(target, "selected");
      }
    };
  }, [map, selectedId]);

  // Which trail the overlay layer draws.
  useEffect(() => {
    if (!map.getLayer(LAYER_TRAILS_SELECTED)) {
      return;
    }

    map.setFilter(LAYER_TRAILS_SELECTED, [
      "==",
      ["get", "id"],
      selectedId ?? NO_SELECTION,
    ]);
  }, [map, selectedId]);

  // One handler for selecting and for clearing the selection. Leaflet needed
  // two -- a layer click and a map click -- plus a flag and a timeout to stop
  // the second undoing the first.
  useEffect(() => {
    const handleClick = (event: MapMouseEvent) => {
      const tolerance = window.matchMedia("(pointer: coarse)").matches
        ? TOUCH_TOLERANCE
        : MOUSE_TOLERANCE;

      const box: [PointLike, PointLike] = [
        [event.point.x - tolerance, event.point.y - tolerance],
        [event.point.x + tolerance, event.point.y + tolerance],
      ];

      const layers = SELECTABLE_LAYERS.filter((id) => map.getLayer(id));

      if (layers.length === 0) {
        return;
      }

      // Topmost first, so a marker wins over the line running underneath it.
      const features = map.queryRenderedFeatures(box, { layers });

      for (const feature of features) {
        const trail = trailFromFeature(map, feature);

        if (trail) {
          onTrailClick(trail);
          return;
        }
      }

      onTrailClick(null);
    };

    map.on("click", handleClick);

    return () => {
      map.off("click", handleClick);
    };
  }, [map, onTrailClick]);

  // A trail is clickable, so say so. Leaflet never did.
  useEffect(() => {
    const canvas = map.getCanvas();
    let hovering = 0;

    const enter = () => {
      hovering += 1;
      canvas.style.cursor = "pointer";
    };

    const leave = () => {
      hovering = Math.max(0, hovering - 1);

      if (hovering === 0) {
        canvas.style.cursor = "";
      }
    };

    for (const id of SELECTABLE_LAYERS) {
      map.on("mouseenter", id, enter);
      map.on("mouseleave", id, leave);
    }

    return () => {
      for (const id of SELECTABLE_LAYERS) {
        map.off("mouseenter", id, enter);
        map.off("mouseleave", id, leave);
      }

      canvas.style.cursor = "";
    };
  }, [map]);

  // The sidebar's list is whatever is on screen once the map settles.
  useEffect(() => {
    if (!onTrailsLoaded) {
      return;
    }

    const publish = () => onTrailsLoaded(queryVisibleTrails(map));

    map.on("idle", publish);

    return () => {
      map.off("idle", publish);
    };
  }, [map, onTrailsLoaded]);

  // A trail was created, edited or deleted: point the source at a fresh cache
  // key, which clears its tiles and refetches them.
  useEffect(() => {
    if (!refreshTrigger || refreshTrigger === appliedRefreshTrigger) {
      return;
    }

    appliedRefreshTrigger = refreshTrigger;

    const source = map.getSource(SOURCE_TRAILS) as VectorTileSource | undefined;

    if (!source?.setTiles) {
      return;
    }

    cacheVersion = newCacheVersion();
    source.setTiles([tileUrl(cacheVersion)]);
  }, [map, refreshTrigger]);

  return null;
}

/**
 * A clicked feature as a trail, whichever layer it came from.
 *
 * An endpoint carries only its trail's id, so the line feature holding the full
 * property set is looked up in the tiles already loaded for the source.
 */
function trailFromFeature(
  map: ReturnType<typeof useMap>,
  feature: MapGeoJSONFeature,
): MVTTrail | null {
  if (feature.layer.id === LAYER_ENDPOINTS) {
    const trailId = feature.properties?.trail_id;

    return typeof trailId === "string" ? findTrailById(map, trailId) : null;
  }

  const props = feature.properties as MVTTrailProperties | null;

  return props?.id ? convertMVTPropertiesToTrail(props) : null;
}
