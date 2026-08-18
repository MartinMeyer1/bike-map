import { useEffect, useState } from 'react';
import { Trail } from '../types';
import { PocketBaseService } from '../services/pocketbase';
import { parseGPXDetailed } from '../utils/gpxGenerator';
import { haversineDistance } from '../utils/geo';

export interface ElevationSample {
  /** Metres from the start of the track. */
  distance: number;
  elevation: number;
}

/**
 * Points in the drawn silhouette. The GPX can carry thousands of track points;
 * at the width the profile is drawn -- a few hundred CSS pixels -- anything past
 * this is invisible detail that still costs SVG path data.
 */
const SAMPLE_COUNT = 120;

/**
 * The backend does compute a full elevation profile (backend/utils/gpx.go writes
 * it to elevation_data), but it reaches neither the MVT tiles, which carry only
 * gain/loss/min/max/start/end, nor the PocketBase trail record. Rather than
 * widen the tile schema, the profile is derived here from the GPX the trail
 * already stores and everything already downloads on demand.
 *
 * Cached across mounts: selecting a trail, panning away and selecting it again
 * is a common enough loop that re-fetching would be noticeable, and a stored
 * GPX only changes when the trail is edited (which changes the file name too).
 */
const cache = new Map<string, ElevationSample[]>();
const inFlight = new Map<string, Promise<ElevationSample[]>>();

/** Even buckets by distance, each averaging the points that land in it. */
function downsample(
  points: Array<{ distance: number; elevation: number }>,
): ElevationSample[] {
  if (points.length <= SAMPLE_COUNT) {
    return points;
  }

  const total = points[points.length - 1].distance;
  if (total <= 0) {
    return points.slice(0, SAMPLE_COUNT);
  }

  const bucketWidth = total / SAMPLE_COUNT;
  const samples: ElevationSample[] = [];
  let cursor = 0;

  for (let bucket = 0; bucket < SAMPLE_COUNT; bucket++) {
    const end = (bucket + 1) * bucketWidth;
    let sum = 0;
    let count = 0;

    while (cursor < points.length && points[cursor].distance <= end) {
      sum += points[cursor].elevation;
      count++;
      cursor++;
    }

    if (count > 0) {
      samples.push({ distance: end - bucketWidth / 2, elevation: sum / count });
    } else if (samples.length > 0) {
      // A gap wider than one bucket: hold the last reading rather than drop a
      // point, so the silhouette keeps its horizontal scale.
      samples.push({ distance: end - bucketWidth / 2, elevation: samples[samples.length - 1].elevation });
    }
  }

  return samples;
}

async function loadProfile(trail: Trail): Promise<ElevationSample[]> {
  const response = await fetch(PocketBaseService.getTrailFileUrl(trail));
  if (!response.ok) {
    throw new Error(`GPX request failed: ${response.status}`);
  }

  const { route } = parseGPXDetailed(await response.text());

  const points: Array<{ distance: number; elevation: number }> = [];
  let distance = 0;

  route.forEach((point, index) => {
    if (index > 0) {
      const previous = route[index - 1];
      distance += haversineDistance(previous.lat, previous.lng, point.lat, point.lng);
    }

    // Tracks drawn without elevation exist; they simply have no profile.
    if (point.ele !== undefined && Number.isFinite(point.ele)) {
      points.push({ distance, elevation: point.ele });
    }
  });

  return points.length >= 2 ? downsample(points) : [];
}

/**
 * The trail's elevation silhouette, or null while it is unknown. A trail whose
 * GPX carries no elevation, or whose GPX cannot be read, resolves to an empty
 * array -- the caller draws nothing rather than reporting an error, since the
 * profile is decoration around metadata that loaded fine.
 */
export function useTrailElevation(trail: Trail | null): ElevationSample[] | null {
  const key = trail ? `${trail.id}/${trail.file}` : null;

  // Switching trails resets the profile during render rather than in an effect,
  // so a stale silhouette is never painted for one frame under the new trail's
  // name. See https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [loaded, setLoaded] = useState<{
    key: string | null;
    samples: ElevationSample[] | null;
  }>({ key, samples: key ? cache.get(key) ?? null : null });

  if (loaded.key !== key) {
    setLoaded({ key, samples: key ? cache.get(key) ?? null : null });
  }

  useEffect(() => {
    // Nothing to fetch: no trail, or the cache already answered above.
    if (!trail || !key || cache.has(key)) {
      return;
    }

    let active = true;
    let request = inFlight.get(key);

    if (!request) {
      request = loadProfile(trail)
        .catch((error) => {
          console.warn('Could not read the elevation profile:', error);
          return [] as ElevationSample[];
        })
        .then((result) => {
          cache.set(key, result);
          inFlight.delete(key);
          return result;
        });

      inFlight.set(key, request);
    }

    request.then((result) => {
      if (active) {
        setLoaded({ key, samples: result });
      }
    });

    return () => {
      active = false;
    };
  }, [trail, key]);

  return loaded.samples;
}
