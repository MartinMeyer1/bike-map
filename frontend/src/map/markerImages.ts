import type { Map as MapLibreMap } from "maplibre-gl";
import { getLevelTint, getToken } from "../utils/colors";

/**
 * Start and finish markers for a trail's line, as sprite images.
 *
 * The artwork is unchanged from the Leaflet divIcons these replace: a hairline
 * ink ring on a disc tinted with the trail's own difficulty colour, with a
 * matching collar so the ring stays legible against dark terrain. Start carries
 * a play triangle, finish a checkered fill.
 *
 * What changed is where they live. Each one used to be a DOM element carrying
 * its own inline SVG, two per trail, which is roughly 1600 absolutely
 * positioned nodes across a cantonal view. Registered here instead, they become
 * entries in MapLibre's sprite atlas and are drawn by a single symbol layer.
 *
 * The pattern and filter definitions used to be a single hidden <svg> shared by
 * the whole document, because hundreds of markers each repeating them would
 * have meant hundreds of colliding element ids. That constraint is gone: every
 * image is rasterised from its own standalone document, so the ids are local
 * and the defs are simply inlined.
 */

const LEVELS = ["S0", "S1", "S2", "S3", "S4", "S5"] as const;

/**
 * Levels come out of a CHECK-constrained column so they are always one of the
 * six, but the style expression falls back to this name rather than asking for
 * an image that was never registered.
 */
const UNKNOWN_LEVEL = "unknown";

const IMAGE_LEVELS = [...LEVELS, UNKNOWN_LEVEL];

type MarkerRole = "start" | "end";

const ROLES: MarkerRole[] = ["start", "end"];

/**
 * The mockup's footprint, in CSS pixels at `icon-size: 1`. The layer scales it
 * down as the map pulls back rather than swapping in a smaller drawing.
 */
export const MARKER_SIZE = 28;

/** Rasterised at 2x so the icons stay sharp on a retina screen. */
const PIXEL_RATIO = 2;

/**
 * Two variants per marker.
 *
 * `lg` is the drawing as designed. `sm` drops the play triangle, which closes
 * up into a smudge once the icon is scaled below roughly 22px -- the checkered
 * finish stays readable at any size and still tells the two ends apart. The
 * layer picks between them by zoom, which is the only reason both exist: a
 * sprite image cannot vary with the camera, so the variation has to be baked
 * into two names.
 */
type MarkerVariant = "sm" | "lg";

const VARIANTS: MarkerVariant[] = ["sm", "lg"];

/** Below this zoom the icon is small enough that the glyph is dropped. */
export const MARKER_GLYPH_MIN_ZOOM = 12;

export function endpointImageId(
  role: MarkerRole | string,
  level: string,
  variant: MarkerVariant,
): string {
  return `trail-${role}-${level}-${variant}`;
}

function markerSvg(
  level: string,
  role: MarkerRole,
  variant: MarkerVariant,
): string {
  const tint = getLevelTint(level);
  const ink = getToken("--ink") || "#26231d";
  const px = MARKER_SIZE * PIXEL_RATIO;

  const chequerId = "chequer";
  const shadowId = "shadow";

  const fill = role === "end" ? `url(#${chequerId})` : tint;

  const glyph =
    role === "start" && variant === "lg"
      ? `<path d="M11.5 9.6 L19.2 14 L11.5 18.4 Z" fill="${ink}"></path>`
      : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${MARKER_SIZE} ${MARKER_SIZE}">
      <defs>
        <pattern id="${chequerId}" width="11" height="11"
                 patternUnits="userSpaceOnUse" patternTransform="translate(1.5 1.5)">
          <rect width="11" height="11" fill="${tint}"></rect>
          <rect width="5.5" height="5.5" fill="${ink}"></rect>
          <rect x="5.5" y="5.5" width="5.5" height="5.5" fill="${ink}"></rect>
        </pattern>
        <filter id="${shadowId}" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.1"
                        flood-color="${ink}" flood-opacity="0.45"></feDropShadow>
        </filter>
      </defs>
      <g filter="url(#${shadowId})">
        <circle cx="14" cy="14" r="9.4" fill="${tint}" stroke="${tint}" stroke-width="3.4"></circle>
        <circle cx="14" cy="14" r="9.4" fill="${fill}" stroke="${ink}" stroke-width="1.7"></circle>
        ${glyph}
      </g>
    </svg>`;
}

function decodeSvg(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("Failed to rasterise a trail marker"));
    // A data URL rather than a blob URL: the markup is small, and this avoids
    // having to revoke anything once the sprite has taken a copy.
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

/**
 * Registers every marker image with the map's sprite.
 *
 * Six levels plus a fallback, two ends, two variants: 28 images, once, for the
 * lifetime of the map. Called on `load` and again after a style reload, since
 * the sprite does not survive one.
 */
export async function registerEndpointImages(map: MapLibreMap): Promise<void> {
  await Promise.all(
    IMAGE_LEVELS.flatMap((level) =>
      ROLES.flatMap((role) =>
        VARIANTS.map(async (variant) => {
          const id = endpointImageId(role, level, variant);

          if (map.hasImage(id)) {
            return;
          }

          const image = await decodeSvg(markerSvg(level, role, variant));

          // The map may have been torn down while the SVG was decoding.
          if (map.hasImage(id)) {
            return;
          }

          map.addImage(id, image, { pixelRatio: PIXEL_RATIO });
        }),
      ),
    ),
  );
}

/** The set of levels that have their own images, for the style's fallback. */
export const KNOWN_LEVELS: readonly string[] = LEVELS;
export const FALLBACK_LEVEL = UNKNOWN_LEVEL;
