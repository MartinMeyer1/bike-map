/**
 * Everything the app draws on the map, in one place.
 *
 * The trail lines, the drawing route and the GPS accuracy disc take their
 * colours from the `:root` design tokens in App.css through `getToken`, so the
 * map and the badges cannot drift apart.
 *
 * The base maps themselves are deliberately not styled here. Each provider's
 * style document is used exactly as it is served; the only thing added to one is
 * the terrain block the 3D maps need, in vectorStyle.ts.
 */

import { getToken } from "../utils/colors";

/* ------------------------------------------------------------------ *
 * Terrain
 * ------------------------------------------------------------------ */

/**
 * The DEM behind the 3D base maps.
 *
 * Maptoolkit's own styles already declare this source under exactly this id;
 * swisstopo publishes no terrain-RGB at all, so the same one is injected into
 * its style. Over Switzerland the tiles behind it are derived from swissALTI3D,
 * so the Swiss 3D map is still standing on Swiss elevation data.
 */
export const TERRAIN_DEM = {
  id: "rgb-tiles",
  spec: {
    type: "raster-dem" as const,
    url: "https://tiles.maptoolkit.org/terrainrgb.json",
    encoding: "terrarium" as const,
  },
};

/**
 * The camera never tilts (see Map.tsx), so the terrain is read entirely through
 * the parallax it gives high ground when the map is panned. That effect scales
 * with exaggeration, which is why this sits above the 1 the provider ships.
 */
export const TERRAIN = { exaggeration: 1.4 };

/* ------------------------------------------------------------------ *
 * The app's own overlays
 * ------------------------------------------------------------------ */

const TRAIL_WIDTH = 6;

export const TRAIL_STYLE = {
  width: TRAIL_WIDTH,
  selectedWidth: 12,
  /**
   * Leaflet's dash was "12, 14" in pixels. MapLibre measures a dash in multiples
   * of the line's own width, so at width 6 the same rhythm is 2 and 2.33 -- and
   * it now scales with the line, which is why a selected trail keeps a
   * proportionate dash instead of the solid stroke Leaflet fell back to.
   */
  dash: [2, 14 / TRAIL_WIDTH],
  /**
   * A fully-dashed pattern, i.e. a solid line. Needed because `line-dasharray`
   * has to produce a value on both branches of the ridden test; MapLibre handles
   * the zero-length gap explicitly.
   */
  solid: [1, 0],
};

const ROUTE_WIDTH = 6;

/**
 * The drawing overlay borrows the grade scale's green, blue and red for start,
 * middle and end, read from the tokens rather than written out: these were
 * literal copies of the old bright palette, so when the scale was darkened they
 * stayed behind as the only vivid thing left on the map.
 */
export const ROUTE_STYLE = {
  width: ROUTE_WIDTH,
  opacity: 0.85,
  /** Leaflet's "5, 5" in pixels, in the line-widths MapLibre measures a dash in. */
  dash: [5 / ROUTE_WIDTH, 5 / ROUTE_WIDTH],
  solid: [1, 0],
  waypointRadius: 8,
  waypointOpacity: 0.9,
  waypointStrokeWidth: 2,
  colors: () => ({
    start: getToken("--level-s0"),
    mid: getToken("--level-s1"),
    end: getToken("--level-s3"),
    waypointStroke: getToken("--paper"),
  }),
};

/**
 * The GPS accuracy disc. Its blue is the same token the marker's own CSS uses,
 * rather than a literal here: that is how a colour ends up restyled in one place
 * and not the other.
 */
export const LOCATION_STYLE = {
  fillOpacity: 0.1,
  lineOpacity: 0.3,
  lineWidth: 1,
  color: () => getToken("--accent"),
};
