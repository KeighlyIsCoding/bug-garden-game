import type { GameState } from './types';
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
}

const PUMP_INTERVAL = [null, 600, 300, 120, 45, 0];
const BARROW_CAPACITY = [0, 40, 120, 400];
const BARROW_INTERVAL = [Infinity, 30, 15, 6];
const STAND_RATE = [0, 0.5, 1.5, 4];

export function modifiers(s: Pick<GameState, 'upgrades'>): Modifiers {
  return {
    waterReach: 1 + level(s, 'can'),
    harvestReach: 1 + level(s, 'basket'),
    pumpInterval: PUMP_INTERVAL[level(s, 'pump')] ?? 0,
    barrowCapacity: BARROW_CAPACITY[level(s, 'barrow')] ?? 0,
    barrowInterval: BARROW_INTERVAL[level(s, 'barrow')] ?? Infinity,
    standRate: STAND_RATE[level(s, 'stand')] ?? 0,
    sellMult: 1 + 0.25 * level(s, 'reputation'),
  };
}
