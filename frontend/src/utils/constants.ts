/**
 * The single S-grade difficulty scale.
 *
 * `word` is the colour name on its own, for the six narrow cells of the level
 * picker where "Green - Easy" will not fit; `name` pairs it with the difficulty
 * for the info dialog's legend; `description` is the long form shown under the
 * picker and in that legend.
 */
export const DIFFICULTY_LEVELS = [
  {
    value: 'S0',
    word: 'Green',
    name: 'Green - Easy',
    description:
      'Flat trails through forests or meadows on natural adherent surfaces or flat rock. No steps, rocks, or many roots. Gentle gradient, wide turns. No specific technique required.',
  },
  {
    value: 'S1',
    word: 'Blue',
    name: 'Blue - Easy',
    description:
      'Small obstacles like flat roots, small stones, water channels. Partly unstable ground. Gradients up to 40%. No hairpin turns. Basic MTB knowledge needed: braking technique and good body balance.',
  },
  {
    value: 'S2',
    word: 'Orange',
    name: 'Orange - Intermediate',
    description:
      'Larger roots, stones, steps, and tight turns. Gradients up to 70%. Required: braking technique and body weight transfer to overcome obstacles.',
  },
  {
    value: 'S3',
    word: 'Red',
    name: 'Red - Advanced',
    description:
      'Path obstructed by rocks, roots, large steps. Rocky and slippery terrain, hairpin turns and stairs. Gradient over 70%. Very good MTB mastery required: precise braking and excellent balance.',
  },
  {
    value: 'S4',
    word: 'Purple',
    name: 'Purple - Expert',
    description:
      'Very steep and heavily obstructed terrain. Steep sections, tight hairpin turns, large steps. Trial techniques, front and rear wheel pivots, perfect braking essential. Only for extreme mountain bikers! Bike can hardly be pushed/carried.',
  },
  {
    value: 'S5',
    word: 'Black',
    name: 'Black - Extreme',
    description:
      'Very heavily obstructed terrain with large climbs. Loose terrain with scree/large obstacles like tree trunks and consecutive high steps. Little momentum, short braking distance. Reserved only for extreme mountain bikers! Bike can hardly be pushed/carried.',
  },
] as const;

export const AVAILABLE_TAGS = [
  'Flow', 'Tech', 'Steep', 'Fast', 'Rocks', 'Roots', 'Jump',
  'Drop', 'Bermed', 'Natural', 'Switchbacks', 'Loose', 'Sketchy'
] as const;
