/**
 * Trail-line colours for the map.
 *
 * The values live as :root custom properties in App.css so that the badges and
 * the map lines cannot drift apart — they used to disagree, with four separate
 * hardcoded copies of the scale. Reading them costs a getComputedStyle call, so
 * the results are cached after the first lookup.
 */
const cache = new Map<string, string>();

function token(name: string): string {
  const cached = cache.get(name);
  if (cached !== undefined) {
    return cached;
  }

  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();

  // Don't cache a miss: the stylesheet may simply not have been applied yet.
  if (value) {
    cache.set(name, value);
  }

  return value;
}

export function getLevelColor(level: string): string {
  const fallback = token('--level-unknown') || '#6c757d';
  if (!/^S[0-5]$/.test(level)) {
    return fallback;
  }

  return token(`--level-${level.toLowerCase()}`) || fallback;
}
