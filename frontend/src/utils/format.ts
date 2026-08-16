/** Trail timestamps are rendered the same way everywhere they appear. */
export function formatDate(value: string): string {
  return new Date(value).toLocaleDateString();
}
