/**
 * The part of the map the app's own chrome covers.
 *
 * The trail sidebar is a panel drawn over the map, not a column beside it: the
 * map's container runs the full width of the window and the leftmost strip of
 * it is simply hidden. Left to itself the camera frames against that whole
 * container, so a trail it centres lands partly -- on a narrow window, wholly --
 * under the panel. Feeding the strip to MapLibre as viewport padding makes
 * every camera move, from fitBounds to a recentre on the user's position, work
 * against the map a reader can actually see.
 */

/** Defined in App.css, where the panel itself reads it for its width. */
const SIDEBAR_WIDTH_TOKEN = '--bm-sidebar-width';

/** Map left visible either side of an inset, so a fit always has somewhere to go. */
const MIN_VISIBLE_WIDTH = 120;

/** The sidebar's width in CSS pixels, or 0 if the token is missing. */
export function readSidebarWidth(): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(
    SIDEBAR_WIDTH_TOKEN,
  );
  const width = Number.parseFloat(raw);

  return Number.isFinite(width) ? width : 0;
}

/**
 * Clamps an inset to the container: padding at least as wide as the map leaves
 * MapLibre nothing to fit a bounding box into, and it answers that by warning
 * and refusing the move.
 */
export function clampInset(inset: number, containerWidth: number): number {
  return Math.max(0, Math.min(inset, containerWidth - MIN_VISIBLE_WIDTH));
}
