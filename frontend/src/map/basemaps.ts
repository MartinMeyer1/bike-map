/**
 * The raster base maps.
 *
 * Both are declared in the style at all times and switched with a visibility
 * toggle rather than being added and removed. Two things fall out of that: the
 * inactive base map's tiles stay in MapLibre's cache, so toggling back is
 * instant instead of a full refetch, and attribution follows on its own --
 * AttributionControl only lists sources that a visible layer actually uses.
 */

export type BaseMapType = "swisstopo" | "osm";

export interface BaseMapConfig {
  sourceId: string;
  layerId: string;
  tiles: string[];
  attribution: string;
  maxzoom: number;
}

export const BASE_MAPS: Record<BaseMapType, BaseMapConfig> = {
  swisstopo: {
    sourceId: "basemap-swisstopo",
    layerId: "basemap-swisstopo-layer",
    tiles: [
      "https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg",
    ],
    attribution:
      '&copy; <a href="https://www.swisstopo.admin.ch/">Swisstopo</a>',
    maxzoom: 18,
  },
  osm: {
    sourceId: "basemap-osm",
    layerId: "basemap-osm-layer",
    // MapLibre has no {s} token. Leaflet was rotating through a/b/c, which OSM
    // no longer wants -- a single host over HTTP/2 is what their tile usage
    // policy now asks for, and it is one connection instead of three.
    tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxzoom: 18,
  },
};

export const BASE_MAP_TYPES = Object.keys(BASE_MAPS) as BaseMapType[];

/** The deepest zoom any base map serves, and so the map's own maximum. */
export const MAX_ZOOM = Math.max(
  ...BASE_MAP_TYPES.map((type) => BASE_MAPS[type].maxzoom),
);
