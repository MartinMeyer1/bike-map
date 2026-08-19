/**
 * Source, source-layer and layer ids for everything the app draws on the map.
 *
 * Collected here because MapLibre addresses layers by string id from several
 * places at once -- the component that creates a layer, the click handler that
 * queries it, and the style expressions that reference an image by name.
 */

/** Vector source backed by the backend's /api/tiles endpoint. */
export const SOURCE_TRAILS = "trails";

/** The two layers the backend packs into each tile. */
export const SOURCE_LAYER_TRAILS = "trails";
export const SOURCE_LAYER_ENDPOINTS = "trail_endpoints";

/**
 * Trail lines, then the selected trail drawn again on top of them, then the
 * start/finish markers. Added in this order so a selected trail is never buried
 * under a neighbour and the markers always sit above both.
 */
export const LAYER_TRAILS = "trails-line";
export const LAYER_TRAILS_SELECTED = "trails-line-selected";
export const LAYER_ENDPOINTS = "trails-endpoints";

/** Layers a click may select a trail from, in hit-test priority order. */
export const SELECTABLE_LAYERS = [LAYER_ENDPOINTS, LAYER_TRAILS] as const;

/** Route drawing overlay. */
export const SOURCE_ROUTE = "route";
export const LAYER_ROUTE = "route-line";
export const SOURCE_WAYPOINTS = "route-waypoints";
export const LAYER_WAYPOINTS = "route-waypoints-circle";

/** GPS accuracy disc, drawn as a real polygon so its radius stays in metres. */
export const SOURCE_ACCURACY = "location-accuracy";
export const LAYER_ACCURACY_FILL = "location-accuracy-fill";
export const LAYER_ACCURACY_LINE = "location-accuracy-line";
