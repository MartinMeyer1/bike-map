const EARTH_RADIUS_M = 6371000;

/**
 * Great-circle distance between two points in metres.
 *
 * This was a useCallback inside RouteDrawer; useTrailElevation needs the same
 * arithmetic to turn a GPX track into a distance-indexed elevation profile, so
 * it lives here rather than being written twice.
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
