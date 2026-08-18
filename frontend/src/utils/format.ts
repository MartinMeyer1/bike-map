/**
 * Trail timestamps are rendered the same way everywhere they appear:
 * day-first, dot-separated, fixed width. Not the visitor's locale -- these sit
 * in mono columns beside distances and grades, and 9/19/2025 next to 19.9.2025
 * on the same screen would be worse than one unfamiliar order.
 */
export function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-GB').replace(/\//g, '.');
}
