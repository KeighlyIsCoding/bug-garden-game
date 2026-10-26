import { ACHIEVEMENT_BONUS } from './achievements';
import { bugdexBonuses } from './bonuses';
import type { Quality } from './plants';
import type { GameState } from './types';
import { COMPOST_PER_FERTILIZER, OFFLINE_BASE_SECONDS, TROWEL_SEED_CHANCE } from './tuning';
import { level } from './upgrades';

/**
 * Everything upgrades (and later, the Bugdex and seasons) change about the garden, worked out
 * in one place. The simulation and the reducer read these numbers instead of upgrade levels.
 */
export interface Modifiers {
  /** Side of the square the watering can covers. */
  waterReach: number;
  /** Side of the square the harvest basket covers. */
  harvestReach: number;
  /** Seconds between pump runs; 0 = always on; null = no pump. */
  pumpInterval: number | null;
  barrowCapacity: number;
  /** Seconds between wheelbarrow rounds; Infinity = no barrow. */
  barrowInterval: number;
  /** Fruit the stand sells per second. */
  standRate: number;
  /** Multiplier on coins from selling fruit. */
  sellMult: number;
  /** Glove: 0 = one weed per pull; 1 = the whole plot; 2+ = a square that size. */
  gloveReach: number;
  /** Side of the square the clippers cover; 0 = no clippers. */
  clipReach: number;
  canSpray: boolean;
  /** Best quality a harvest can reach. */
  qualityCap: Quality;
  digSeedChance: number;
  compostPerFertilizer: number;
  autoTumble: boolean;
  // From the Bugdex (and achievements). All start at 1 (or 0 for chances).
  growthMult: number;
  yieldMult: number;
  /** Multiplier on the time between new weeds. */
  weedIntervalMult: number;
  /** Multiplier on how long moisture lasts. */
  moistureMult: number;
  /** Multiplier on vigor lost per harvest. */
  vigorDecayMult: number;
  /** Extra compost per weed pulled, as a fraction (0.1 = +10%). */
  compostBonus: number;
  fertilizerMult: number;
  seedDropMult: number;
  /** Seconds the garden keeps growing while the game is closed. */
  offlineSeconds: number;
  /** Multiplier on how often golden butterflies come. */
  butterflyRate: number;
}

const PUMP_INTERVAL = [null, 600, 300, 120, 45, 0];
const BARROW_CAPACITY = [0, 40, 120, 400];
const BARROW_INTERVAL = [Infinity, 30, 15, 6];
const STAND_RATE = [0, 0.5, 1.5, 4];

type ModSource = Pick<GameState, 'upgrades'> & Partial<Pick<GameState, 'collection' | 'achievements'>>;

export function modifiers(s: ModSource): Modifiers {
  const dex = bugdexBonuses(s.collection);
  const achieved = (s.achievements?.length ?? 0) * ACHIEVEMENT_BONUS;
  return {
    waterReach: 1 + level(s, 'can'),
    harvestReach: 1 + level(s, 'basket'),
    pumpInterval: PUMP_INTERVAL[level(s, 'pump')] ?? 0,
    barrowCapacity: Math.round((BARROW_CAPACITY[level(s, 'barrow')] ?? 0) * (1 + dex.barrow)),
    barrowInterval: BARROW_INTERVAL[level(s, 'barrow')] ?? Infinity,
    standRate: STAND_RATE[level(s, 'stand')] ?? 0,
    sellMult: (1 + 0.25 * level(s, 'reputation')) * (1 + dex.sellPrice),
    gloveReach: level(s, 'glove'),
    clipReach: level(s, 'clippers'),
    canSpray: level(s, 'sprayer') > 0,
    qualityCap: level(s, 'heirloom') > 0 ? 'heirloom' : level(s, 'prize') > 0 ? 'prize' : 'perfect',
    digSeedChance: level(s, 'trowel') > 0 ? TROWEL_SEED_CHANCE : 0,
    compostPerFertilizer: level(s, 'tumbler') > 0 ? 2 : COMPOST_PER_FERTILIZER,
    autoTumble: level(s, 'tumbler') > 1,
    growthMult: 1 + dex.growth,
    yieldMult: (1 + dex.yield) * (1 + achieved),
    weedIntervalMult: 1 + dex.weedSlow,
    moistureMult: 1 + dex.moisture,
    vigorDecayMult: 1 / (1 + dex.vigorKeep),
    compostBonus: dex.compost,
    fertilizerMult: 1 + dex.fertilizer,
    seedDropMult: 1 + dex.seeds,
    offlineSeconds: OFFLINE_BASE_SECONDS * (1 + dex.offline),
    butterflyRate: 1 + dex.butterflies,
  };
}
