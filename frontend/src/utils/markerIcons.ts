import L from "leaflet";
import { getLevelTint, getToken } from "./colors";

/**
 * Start and finish markers for a trail's line.
 *
 * Both are the same object -- a hairline ink ring on a disc tinted with the
 * trail's own difficulty colour, with a matching collar so the ring stays
 * legible against dark terrain. Start carries a play triangle, finish a
 * checkered fill. They replaced a pair of emoji images (a rock hand and a beer),
 * which had no relationship to the line they sat on and no way to tell you which
 * end you were looking at once two trails met.
 */

const SIZES = [16, 22, 28] as const;
const VIEWBOX = 28;
const DEFS_ID = "bikemap-marker-defs";

/** Leaflet's default divIcon paints a white box; this class undoes that. */
export const MARKER_CLASS = "bikemap-marker";

const LEVELS = ["S0", "S1", "S2", "S3", "S4", "S5"] as const;

function chequerId(level: string): string {
  return `bikemap-chequer-${level.toLowerCase()}`;
}

const SHADOW_ID = "bikemap-marker-shadow";

/**
 * The checkered fills and the drop shadow are defined once for the document and
 * referenced by every marker, rather than repeated inside each icon: markers
 * number in the hundreds, and duplicating a pattern definition per marker would
 * mean hundreds of colliding element ids.
 */
function ensureDefs(): void {
  if (document.getElementById(DEFS_ID)) {
    return;
  }

  const ink = getToken("--ink") || "#26231d";

  const patterns = LEVELS.map((level) => {
    const tint = getLevelTint(level);
    return `
      <pattern id="${chequerId(level)}" width="11" height="11"
               patternUnits="userSpaceOnUse" patternTransform="translate(1.5 1.5)">
        <rect width="11" height="11" fill="${tint}"></rect>
        <rect width="5.5" height="5.5" fill="${ink}"></rect>
        <rect x="5.5" y="5.5" width="5.5" height="5.5" fill="${ink}"></rect>
      </pattern>`;
  }).join("");

  const host = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  host.id = DEFS_ID;
  host.setAttribute("aria-hidden", "true");
  host.setAttribute("width", "0");
  host.setAttribute("height", "0");
  host.style.position = "absolute";
  host.style.overflow = "hidden";
  host.innerHTML = `
    <defs>
      ${patterns}
      <filter id="${SHADOW_ID}" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="1" stdDeviation="1.1"
                      flood-color="${ink}" flood-opacity="0.45"></feDropShadow>
      </filter>
    </defs>`;

  document.body.appendChild(host);
}

function markerSvg(level: string, size: number, kind: "start" | "end"): string {
  const tint = getLevelTint(level);
  const ink = getToken("--ink") || "#26231d";
  const fill = kind === "end" ? `url(#${chequerId(level)})` : tint;

  // The play triangle is dropped at the smaller size, where it would close up
  // into a smudge; the checkered finish stays readable and still tells the ends
  // apart.
  const glyph =
    kind === "start" && size > 22
      ? `<path d="M11.5 9.6 L19.2 14 L11.5 18.4 Z" fill="${ink}"></path>`
      : "";

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${VIEWBOX} ${VIEWBOX}">
      <g filter="url(#${SHADOW_ID})">
        <circle cx="14" cy="14" r="9.4" fill="${tint}" stroke="${tint}" stroke-width="3.4"></circle>
        <circle cx="14" cy="14" r="9.4" fill="${fill}" stroke="${ink}" stroke-width="1.7"></circle>
        ${glyph}
      </g>
    </svg>`;
}

/**
 * L.DivIcon holds no per-marker state -- Leaflet clones its html for each marker
 * -- so one instance per level, size and end backs every marker that looks like
 * it. Six levels by two ends at three sizes is 36 icons for the app's lifetime.
 */
const iconCache = new Map<string, L.DivIcon>();

function icon(level: string, size: number, kind: "start" | "end"): L.DivIcon {
  const key = `${kind}|${level}|${size}`;
  const cached = iconCache.get(key);
  if (cached) {
    return cached;
  }

  ensureDefs();

  const half = size / 2;
  const created = L.divIcon({
    html: markerSvg(level, size, kind),
    className: MARKER_CLASS,
    iconSize: [size, size],
    iconAnchor: [half, half],
    popupAnchor: [0, -half],
  });

  iconCache.set(key, created);

  return created;
}

export function startIcon(level: string, size: number): L.DivIcon {
  return icon(level, size, "start");
}

export function endIcon(level: string, size: number): L.DivIcon {
  return icon(level, size, "end");
}

/**
 * Markers are drawn at their design size once the map is close enough to be
 * looking at trails, and shrink as it pulls back.
 *
 * The mockup specifies a single 28px footprint, drawn over a handful of trails.
 * A cantonal view here holds several hundred, where fixed 28px discs bury the
 * terrain the map exists to show -- so the footprint is honoured from z12 in,
 * and below that the marker recedes to a dot that only says "an end is here",
 * leaving the trail's own line to carry it.
 */
export function markerSizeForZoom(zoom: number): number {
  // z10 is where the app opens, showing most of Valais and close to a thousand
  // trail ends; the old icons were 15px there, and going bigger would have made
  // the first thing anyone sees busier than what this replaced.
  if (zoom < 11) {
    return SIZES[0];
  }

  return zoom < 12 ? SIZES[1] : SIZES[2];
}
