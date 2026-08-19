import { setWorkerUrl } from "maplibre-gl";

/*
 * MapLibre parses vector tiles in a web worker, and works out where that
 * worker's script lives at runtime:
 *
 *   new URL(`./${'maplibre-gl-worker.mjs'}`, import.meta.url)
 *
 * The filename is a variable, so no bundler can follow it. Vite therefore never
 * emits the worker chunk, and MapLibre ends up asking for a sibling of whatever
 * file it was bundled into -- /node_modules/.vite/deps/maplibre-gl-worker.mjs in
 * dev, /assets/maplibre-gl-worker.mjs in a build. Both 404.
 *
 * Nothing reports this. The worker simply never starts, so every vector tile
 * sits in `loading` for ever: the raster base map still draws, because raster
 * tiles are fetched on the main thread, and the map looks fine apart from
 * having no trails on it and making no requests for them.
 *
 * `?worker&url` makes Vite bundle the worker with its shared chunk and hand
 * back a real URL, in dev and in a build alike.
 */
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

/**
 * Points MapLibre at a worker URL its own resolution cannot find. Must run
 * before the first Map is constructed; safe to call more than once.
 */
export function configureMapWorker(): void {
  setWorkerUrl(workerUrl);
}
