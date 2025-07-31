export function getLevelColor(level: string): string {
  switch (level) {
    case 'S0': return '#28a745'; // Green
    case 'S1': return '#007bff'; // Blue
    case 'S2': return '#fd7e14'; // Orange
    case 'S3': return '#dc3545'; // Red
    case 'S4': return '#6f42c1'; // Purple
    case 'S5': return '#343a40'; // Black
    default: return '#6c757d'; // Gray
  }
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

export function rgbToHex(r: number, g: number, b: number): string {
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}