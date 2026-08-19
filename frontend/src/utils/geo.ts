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

/**
 * A circle of `radiusMeters` around a point, as polygon ring coordinates in
 * [lng, lat] order.
 *
 * MapLibre's `circle` layer sizes its radius in screen pixels, so a GPS
 * accuracy disc -- which is a distance on the ground -- has to be a real
 * polygon if it is to stay honest as the map zooms. Points are placed by
 * bearing along a great circle, so the ring stays correct at any latitude
 * rather than drifting the way a flat degrees-per-metre approximation does.
 */
export function circlePolygon(
  lat: number,
  lng: number,
  radiusMeters: number,
  steps = 64,
): Array<[number, number]> {
  const angular = radiusMeters / EARTH_RADIUS_M;
  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;

  const ring: Array<[number, number]> = [];

  for (let i = 0; i <= steps; i++) {
    const bearing = (2 * Math.PI * i) / steps;

    const pointLat = Math.asin(
      Math.sin(latRad) * Math.cos(angular) +
        Math.cos(latRad) * Math.sin(angular) * Math.cos(bearing),
    );

    const pointLng =
      lngRad +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angular) * Math.cos(latRad),
        Math.cos(angular) - Math.sin(latRad) * Math.sin(pointLat),
      );

    ring.push([(pointLng * 180) / Math.PI, (pointLat * 180) / Math.PI]);
  }

  return ring;
}
