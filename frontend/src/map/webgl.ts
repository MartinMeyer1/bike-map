/**
 * MapLibre 6 renders through WebGL2 only -- its context type is fixed, and the
 * `supported()` helper older versions exported is gone. Leaflet needed no GPU
 * at all, so this is the one capability the migration costs us, and the app has
 * to say so rather than presenting an empty grey rectangle.
 */
export function isWebGL2Available(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return canvas.getContext("webgl2") !== null;
  } catch {
    // Some hardened browsers throw rather than returning null.
    return false;
  }
}
