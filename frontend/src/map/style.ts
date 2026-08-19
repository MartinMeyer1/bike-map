import type { StyleSpecification } from "maplibre-gl";
import { BASE_MAPS, BASE_MAP_TYPES, BaseMapType } from "./basemaps";

/**
 * The initial style: the raster base maps and nothing else.
 *
 * Trails, the drawing overlay and the GPS accuracy disc are added by the
 * components that own them, so that each one's lifetime is its component's
 * lifetime -- the trail layers really are removed while drawing is active, the
 * same way the old Leaflet layer was.
 */
export function buildStyle(activeBaseMap: BaseMapType): StyleSpecification {
  const style: StyleSpecification = {
    version: 8,
    sources: {},
    layers: [],
  };

  for (const type of BASE_MAP_TYPES) {
    const config = BASE_MAPS[type];

    style.sources[config.sourceId] = {
      type: "raster",
      tiles: config.tiles,
      tileSize: 256,
      maxzoom: config.maxzoom,
      attribution: config.attribution,
    };

    style.layers.push({
      id: config.layerId,
      type: "raster",
      source: config.sourceId,
      layout: { visibility: type === activeBaseMap ? "visible" : "none" },
    });
  }

  return style;
}
