/**
 * The base maps the reader can choose between.
 *
 * Two kinds, and the difference runs deeper than the tiles. A raster base map is
 * a handful of lines of style JSON this file can synthesise on the spot. A
 * vector one is a whole style document -- its own sources, glyphs, sprite and
 * around ninety layers -- fetched from the provider and reworked by
 * `vectorStyle.ts` before the map is ever shown it. Switching between them is a
 * real `setStyle`, not the visibility flip this used to be.
 *
 * Each provider is offered in the same three forms -- raster, vector, and vector
 * on terrain -- which is what the picker's three buttons per section are.
 */

export type BaseMapId =
  | "swisstopo-raster"
  | "swisstopo-vector"
  | "swisstopo-3d"
  | "osm-raster"
  | "osm-vector"
  | "osm-3d";

export type BaseMapGroup = "Swisstopo" | "OpenStreetMap";

export type BaseMapSource =
  | { kind: "raster"; tiles: string[]; attribution: string }
  | {
      kind: "vector";
      styleUrl: string;
      /**
       * Whether the style should end up with a `terrain` block. The maptoolkit
       * `-3d` styles arrive with one; swisstopo's never does, and has no DEM of
       * its own to point at, so `vectorStyle.ts` injects the shared one.
       */
      terrain: boolean;
    };

/** The three forms each provider is offered in, and the picker's button text. */
export type BaseMapVariant = "Raster" | "Vector" | "3D";

export interface BaseMapDef {
  id: BaseMapId;
  group: BaseMapGroup;
  variant: BaseMapVariant;
  maxzoom: number;
  source: BaseMapSource;
}

export const BASE_MAPS: Record<BaseMapId, BaseMapDef> = {
  "swisstopo-raster": {
    id: "swisstopo-raster",
    group: "Swisstopo",
    variant: "Raster",
    maxzoom: 18,
    source: {
      kind: "raster",
      tiles: [
        "https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg",
      ],
      attribution:
        '&copy; <a href="https://www.swisstopo.admin.ch/">Swisstopo</a>',
    },
  },
  "swisstopo-vector": {
    id: "swisstopo-vector",
    group: "Swisstopo",
    variant: "Vector",
    maxzoom: 18,
    source: {
      kind: "vector",
      styleUrl:
        "https://vectortiles.geo.admin.ch/styles/ch.swisstopo.lightbasemap.vt/style.json",
      terrain: false,
    },
  },
  "swisstopo-3d": {
    id: "swisstopo-3d",
    group: "Swisstopo",
    variant: "3D",
    maxzoom: 18,
    source: {
      kind: "vector",
      styleUrl:
        "https://vectortiles.geo.admin.ch/styles/ch.swisstopo.lightbasemap.vt/style.json",
      terrain: true,
    },
  },
  "osm-raster": {
    id: "osm-raster",
    group: "OpenStreetMap",
    variant: "Raster",
    maxzoom: 18,
    source: {
      kind: "raster",
      // MapLibre has no {s} token. Leaflet was rotating through a/b/c, which OSM
      // no longer wants -- a single host over HTTP/2 is what their tile usage
      // policy now asks for, and it is one connection instead of three.
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  "osm-vector": {
    id: "osm-vector",
    group: "OpenStreetMap",
    variant: "Vector",
    maxzoom: 18,
    source: {
      kind: "vector",
      styleUrl: "https://styles.maptoolkit.org/summer.json",
      terrain: false,
    },
  },
  "osm-3d": {
    id: "osm-3d",
    group: "OpenStreetMap",
    variant: "3D",
    maxzoom: 18,
    source: {
      kind: "vector",
      styleUrl: "https://styles.maptoolkit.org/summer-3d.json",
      terrain: true,
    },
  },
};

export const BASE_MAP_IDS = Object.keys(BASE_MAPS) as BaseMapId[];

export const DEFAULT_BASE_MAP: BaseMapId = "swisstopo-raster";

/** The order the picker lists its groups in. */
export const BASE_MAP_GROUPS: BaseMapGroup[] = ["Swisstopo", "OpenStreetMap"];

/** The deepest zoom any base map serves, and so the map's own maximum. */
export const MAX_ZOOM = Math.max(
  ...BASE_MAP_IDS.map((id) => BASE_MAPS[id].maxzoom),
);

/**
 * What was stored under `bikemap-basemap` before there were six of these: the
 * two words 'swisstopo' and 'osm'. Both now name a group rather than a map, so
 * they resolve to that group's raster entry -- which is what the reader who
 * saved them was actually looking at.
 */
const LEGACY_BASE_MAP_IDS: Record<string, BaseMapId> = {
  swisstopo: "swisstopo-raster",
  osm: "osm-raster",
};

export function normalizeBaseMapId(saved: string | null): BaseMapId {
  if (!saved) {
    return DEFAULT_BASE_MAP;
  }

  if (saved in BASE_MAPS) {
    return saved as BaseMapId;
  }

  return LEGACY_BASE_MAP_IDS[saved] ?? DEFAULT_BASE_MAP;
}
