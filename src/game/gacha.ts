import { BUGS, tierOf, type Bug, type Tier } from './bugs';
import { QUALITY_LUCK, type PlantDef, type Quality } from './plants';

export const BASE_WEIGHTS = [62, 22, 10, 4.5, 1.3, 0.2];
export const PITY_LIMIT = 40;
/** Tier that the pity meter guarantees (Epic). */
export const PITY_TIER = 3;

export type Rng = () => number;

export function poolFor(fruit: PlantDef): Bug[] {
  return fruit.order ? BUGS.filter((b) => b.order === fruit.order) : BUGS;
}

export function luckFor(fruit: PlantDef, quality: Quality): number {
  return fruit.luck + QUALITY_LUCK[quality];
}

/**
 * Probability of each tier for a summon with this fruit. Tiers with no species in the pool
 * are dropped. When `pityReady`, only tiers >= Epic (or the best tier available) remain.
 */
export function tierOdds(fruit: PlantDef, quality: Quality, pityReady = false): number[] {
  const pool = poolFor(fruit);
  const present = BASE_WEIGHTS.map((_, t) => pool.some((b) => tierOf(b) === t));
  const luck = luckFor(fruit, quality);
  let weights = BASE_WEIGHTS.map((w, t) => (present[t] ? w * (1 + luck * t) : 0));

  if (pityReady) {
    const best = present.lastIndexOf(true);
    const floor = Math.min(PITY_TIER, best);
    weights = weights.map((w, t) => (t >= floor ? w : 0));
  }
  const total = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => (total > 0 ? w / total : 0));
}

function pickWeighted<T>(items: T[], weight: (item: T) => number, rng: Rng): T {
  const total = items.reduce((s, it) => s + weight(it), 0);
  let r = rng() * total;
  for (const it of items) {
    r -= weight(it);
    if (r < 0) return it;
  }
  return items[items.length - 1];
}

export interface SummonResult {
  bug: Bug;
  tier: Tier;
}

export function summon(
  fruit: PlantDef,
  quality: Quality,
  pity: number,
  owned: (id: string) => boolean,
  rng: Rng = Math.random,
): SummonResult {
  const odds = tierOdds(fruit, quality, pity >= PITY_LIMIT - 1);
  const tier = pickWeighted(
    odds.map((_, t) => t),
    (t) => odds[t],
    rng,
  ) as Tier;
  const candidates = poolFor(fruit).filter((b) => tierOf(b) === tier);
  // Gentle duplicate protection: species you don't own yet are twice as likely.
  const bug = pickWeighted(candidates, (b) => (owned(b.id) ? 1 : 2), rng);
  return { bug, tier };
}

/** Which fruits can summon a given bug (for Bugdex hints). */
export function fruitsForBug(bug: Bug, plants: PlantDef[]): PlantDef[] {
  return plants.filter((p) => p.order === null || p.order === bug.order);
}
