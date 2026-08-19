import { createContext } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";

/**
 * The map instance, published to the components that draw on it.
 *
 * Only ever holds a map that has fired `load`: Map.tsx does not render this
 * provider until then, so a consumer can add a source or a layer in its first
 * effect without checking whether the style is ready.
 */
export const MapContext = createContext<MapLibreMap | null>(null);
