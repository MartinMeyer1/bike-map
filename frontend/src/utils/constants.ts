export const DIFFICULTY_LEVELS = [
  { value: 'S0', label: 'S0 (Green - Easy)' },
  { value: 'S1', label: 'S1 (Blue - Easy)' },
  { value: 'S2', label: 'S2 (Orange - Intermediate)' },
  { value: 'S3', label: 'S3 (Red - Advanced)' },
  { value: 'S4', label: 'S4 (Purple - Expert)' },
  { value: 'S5', label: 'S5 (Black - Extreme)' },
] as const;

export const AVAILABLE_TAGS = [
  'Flow', 'Tech', 'Steep', 'Fast', 'Rocks', 'Roots', 'Jump', 
  'Drop', 'Bermed', 'Natural', 'Switchbacks', 'Loose', 'Sketchy'
] as const;

export type DifficultyLevel = typeof DIFFICULTY_LEVELS[number]['value'];
export type AvailableTag = typeof AVAILABLE_TAGS[number];