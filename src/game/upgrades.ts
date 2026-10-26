import type { GameState } from './types';

export type UpgradeCategory = 'water' | 'weed' | 'harvest' | 'soil' | 'market';

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
    id: 'glove',
    name: 'Gardening glove',
    icon: '🧤',
    category: 'weed',
    summary: 'Pull more weeds with one pull. Keyboard: weeds in the same square share one tug count.',
    levels: [
      { cost: 300, effect: 'pulls every weed in the plot' },
      { cost: 3_000, effect: 'pulls every weed in a 2×2 square' },
      { cost: 20_000, effect: 'pulls every weed in a 3×3 square' },
    ],
  },
  {
    id: 'clippers',
    name: 'Clippers',
    icon: '✂️',
    category: 'weed',
    summary: 'A Clip tool: clears weeds instantly, but leaves the roots, so they grow back twice as fast for 3 minutes. No compost.',
    levels: [
      { cost: 800, effect: 'clips one plot' },
      { cost: 7_000, effect: 'clips a 2×2 square' },
    ],
  },
  {
    id: 'sprayer',
    name: 'Herbicide sprayer',
    icon: '🧴',
    category: 'weed',
    summary: 'Lets you buy herbicide at the market and spray it: weeds come back 3× slower for 10 minutes, but that crop drops a quality tier.',
    requires: { id: 'clippers', level: 1 },
    levels: [{ cost: 2_500, effect: 'herbicide for sale' }],
  },
  {
    id: 'patrol',
    name: 'Beetle patrol',
    icon: '🪲',
    category: 'weed',
    summary: 'Ground beetles patrol the garden and eat a weed from every plot on each round. No compost: the beetles eat them.',
    requires: { id: 'glove', level: 2 },
    levels: [
      { cost: 60_000, effect: 'a round every 2 minutes' },
      { cost: 240_000, effect: 'a round every minute' },
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
    id: 'trowel',
    name: 'Trowel',
    icon: '🥄',
    category: 'soil',
    summary: 'Dig plants up carefully: half the time you get the seed back.',
    levels: [{ cost: 500, effect: '50% seed back when digging up' }],
  },
  {
    id: 'tumbler',
    name: 'Compost tumbler',
    icon: '🛢️',
    category: 'soil',
    summary: 'Better fertilizer from less compost.',
    levels: [
      { cost: 3_000, effect: '2 compost per fertilizer' },
      { cost: 25_000, effect: 'turns compost over 10 into fertilizer by itself' },
    ],
  },
  {
    id: 'prize',
    name: 'Show ribbon',
    icon: '🎗️',
    category: 'soil',
    summary: 'Unlocks Prize fruit (4 per harvest): 95% care, fertilized, and hand-watered at least once that crop.',
    levels: [{ cost: 15_000, effect: 'Prize fruit unlocked' }],
  },
  {
    id: 'heirloom',
    name: 'Heirloom stock',
    icon: '🏺',
    category: 'soil',
    summary: 'Unlocks Heirloom fruit (5 per harvest): Prize conditions, 98% care, and a vigorous plant (80%+).',
    requires: { id: 'prize', level: 1 },
    levels: [{ cost: 120_000, effect: 'Heirloom fruit unlocked' }],
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
