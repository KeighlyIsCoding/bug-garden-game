import type { GameState } from './types';

export type UpgradeCategory = 'water' | 'harvest' | 'market';

export interface UpgradeDef {
  id: string;
  name: string;
  icon: string;
  category: UpgradeCategory;
  /** What the upgrade does, in a sentence. */
  summary: string;
  /** One entry per level you can buy. `effect` describes the level once bought. */
  levels: { cost: number; effect: string }[];
  /** Another upgrade that must reach a level before this one can be bought. */
  requires?: { id: string; level: number };
}

/** Each level of an upgrade costs roughly 6–10× the last; the Shed shows the next one. */
export const UPGRADES: UpgradeDef[] = [
  {
    id: 'can',
    name: 'Watering can',
    icon: '🪣',
    category: 'water',
    summary: 'Water and soak a bigger square of plots in one go.',
    levels: [
      { cost: 150, effect: '2×2 reach' },
      { cost: 1_200, effect: '3×3 reach' },
      { cost: 9_000, effect: '4×4 reach' },
    ],
  },
  {
    id: 'pump',
    name: 'Irrigation pump',
    icon: '🚰',
    category: 'water',
    summary: 'Waters every irrigated row on a schedule. Irrigation keeps plants growing but never soaks them.',
    requires: { id: 'can', level: 3 },
    levels: [
      { cost: 4_000, effect: 'every 10 min' },
      { cost: 12_000, effect: 'every 5 min' },
      { cost: 35_000, effect: 'every 2 min' },
      { cost: 90_000, effect: 'every 45 s' },
      { cost: 250_000, effect: 'around the clock' },
    ],
  },
  {
    id: 'basket',
    name: 'Harvest basket',
    icon: '🧺',
    category: 'harvest',
    summary: 'Pick a bigger square of ripe plots in one go.',
    levels: [
      { cost: 250, effect: '2×2 reach' },
      { cost: 2_500, effect: '3×3 reach' },
    ],
  },
  {
    id: 'barrow',
    name: 'Wheelbarrow',
    icon: '🛒',
    category: 'harvest',
    summary: 'Adds a Harvest all button, and goes round picking ripe plants into the barrow until it is full.',
    requires: { id: 'basket', level: 1 },
    levels: [
      { cost: 1_500, effect: 'holds 40, picks every 30 s' },
      { cost: 12_000, effect: 'holds 120, picks every 15 s' },
      { cost: 80_000, effect: 'holds 400, picks every 6 s' },
    ],
  },
  {
    id: 'stand',
    name: 'Fruit stand',
    icon: '🏪',
    category: 'market',
    summary: 'Sells fruit of the qualities you choose, automatically.',
    levels: [
      { cost: 600, effect: 'sells 0.5 fruit/s' },
      { cost: 5_000, effect: 'sells 1.5 fruit/s' },
      { cost: 30_000, effect: 'sells 4 fruit/s' },
    ],
  },
  {
    id: 'reputation',
    name: 'Market reputation',
    icon: '⭐',
    category: 'market',
    summary: 'Buyers pay more for your fruit.',
    levels: [400, 1_600, 6_400, 25_600, 102_400].map((cost, i) => ({ cost, effect: `+${25 * (i + 1)}% sell price` })),
  },
];

export const UPGRADE_BY_ID: Record<string, UpgradeDef> = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

export const level = (s: Pick<GameState, 'upgrades'>, id: string) => s.upgrades[id] ?? 0;

/** Cost of the next level, or null when maxed. */
export function nextCost(s: Pick<GameState, 'upgrades'>, id: string): number | null {
  const def = UPGRADE_BY_ID[id];
  return def?.levels[level(s, id)]?.cost ?? null;
}

export function isUnlocked(s: Pick<GameState, 'upgrades'>, def: UpgradeDef): boolean {
  return !def.requires || level(s, def.requires.id) >= def.requires.level;
}
