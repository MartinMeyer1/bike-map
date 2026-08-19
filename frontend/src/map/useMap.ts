import { useContext } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { MapContext } from "./MapContext";

/** The loaded map instance. Throws if used outside the map's subtree. */
export function useMap(): MapLibreMap {
  const map = useContext(MapContext);

  if (!map) {
    throw new Error("useMap must be used inside <Map>");
  }

  return map;
}
