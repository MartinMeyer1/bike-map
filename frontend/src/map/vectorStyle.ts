import type { SourceSpecification, StyleSpecification } from "maplibre-gl";
import { BaseMapDef, BaseMapId } from "./basemaps";
import { TERRAIN, TERRAIN_DEM } from "./mapTheme";

/**
 * Turns a base map into a style MapLibre can be handed.
 *
 * A raster base map is synthesised here from two lines of configuration. A
 * vector one is the provider's own style document, fetched and used as it is
 * served -- the only edit made to one is the terrain block the 3D maps need, and
 * only because two of the four vector entries are the same style with and
 * without it.
 */

/**
 * Styles are ~100KB of JSON and never change within a session, so switching
 * back and forth refetches nothing. Keyed by base map rather than by URL: the
 * two swisstopo entries share a URL but not the terrain block.
 */
const cache = new Map<BaseMapId, StyleSpecification>();

export async function loadBaseStyle(
  def: BaseMapDef,
): Promise<StyleSpecification> {
  const cached = cache.get(def.id);

  if (cached) {
    return clone(cached);
  }

  const style =
    def.source.kind === "raster"
      ? rasterStyle(def)
      : withTerrain(await fetchStyle(def.source.styleUrl), def.source.terrain);

  cache.set(def.id, style);

  return clone(style);
}

/**
 * MapLibre takes ownership of the style object it is given and edits it in
 * place, so the cache hands out copies rather than the thing it is holding.
 */
function clone(style: StyleSpecification): StyleSpecification {
  return structuredClone(style);
}

function rasterStyle(def: BaseMapDef): StyleSpecification {
  if (def.source.kind !== "raster") {
    throw new Error(`${def.id} is not a raster base map`);
  }

  const { tiles, attribution } = def.source;

  return {
    version: 8,
    sources: {
      [`basemap-${def.id}`]: {
        type: "raster",
        tiles,
        tileSize: 256,
        maxzoom: def.maxzoom,
        attribution,
      },
    },
    layers: [
      {
        id: `basemap-${def.id}-layer`,
        type: "raster",
        source: `basemap-${def.id}`,
      },
    ],
  };
}

async function fetchStyle(url: string): Promise<StyleSpecification> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Base map style ${url} returned ${response.status}`);
  }

  return (await response.json()) as StyleSpecification;
}

/**
 * Maptoolkit's `-3d` styles arrive with both the DEM source and the terrain
 * block, and differ from their flat counterparts in nothing else. Swisstopo's
 * style has neither and publishes no elevation of its own, so both are added.
 */
function withTerrain(
  style: StyleSpecification,
  terrain: boolean,
): StyleSpecification {
  if (!terrain) {
    delete style.terrain;

    return style;
  }

  if (!style.sources[TERRAIN_DEM.id]) {
    style.sources[TERRAIN_DEM.id] = TERRAIN_DEM.spec as SourceSpecification;
  }

  style.terrain = {
    source: TERRAIN_DEM.id,
    exaggeration: TERRAIN.exaggeration,
  };

  return style;
}
