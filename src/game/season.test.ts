import { beforeEach, describe, expect, it } from 'vitest';
import { BUGS } from './bugs';
import {
  GOLDEN_SEED_BONUS,
  GOLDEN_SEED_DIVISOR,
  OFFLINE_BASE_SECONDS,
  SEASON_MIN_PLOTS,
  deserialize,
  goldenSeedsFor,
  modifiers,
  newGame,
  reducer,
  serialize,
  setRng,
  type GameState,
} from './state';

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}
beforeEach(() => setRng(seeded(9)));

/** A season-1 garden of `plots` plots that has earned `earned` coins. */
function grown(plots: number, earned: number): GameState {
  let s: GameState = { ...newGame(0), coins: 1e12 };
  for (let i = 6; i < plots; i++) s = reducer(s, { type: 'buyLand', now: 0 });
  return {
    ...s,
    coins: 5000,
    upgrades: { can: 3, glove: 2 },
    collection: { [BUGS[0].id]: { count: 2, firstAt: 0 } },
    achievements: ['plots-12'],
    stats: { ...s.stats, coinsEarned: earned },
    notices: [],
  };
}

describe('new season', () => {
  it('needs a big enough garden', () => {
    const s = grown(SEASON_MIN_PLOTS - 1, 1e6);
    expect(reducer(s, { type: 'newSeason', now: 0 }).season.number).toBe(1);
  });

  it('banks Golden Seeds and resets the garden, keeping the Bugdex and achievements', () => {
    const s = grown(SEASON_MIN_PLOTS, 100 * GOLDEN_SEED_DIVISOR); // sqrt(100) = 10 seeds
    expect(goldenSeedsFor(s)).toBe(10);
    const next = reducer(s, { type: 'newSeason', now: 0 });
    expect(next.season).toMatchObject({ number: 2, goldenSeeds: 10, totalGoldenSeeds: 10, startEarned: s.stats.coinsEarned });
    expect(next.plots).toHaveLength(6);
    expect(next.coins).toBe(newGame(0).coins);
    expect(next.upgrades).toEqual({});
    expect(next.collection).toEqual(s.collection);
    expect(next.achievements).toContain('plots-12');
    expect(next.achievements).toContain('season-2');
    expect(next.stats.coinsEarned).toBe(s.stats.coinsEarned);
    // Seeds earned next season only count coins earned from now on.
    expect(goldenSeedsFor(next)).toBe(0);
  });

  it('unspent Golden Seeds speed up growth and yield', () => {
    const s = { ...newGame(0), season: { ...newGame(0).season, goldenSeeds: 10 } };
    const m = modifiers(s);
    expect(m.growthMult).toBeCloseTo(1 + 10 * GOLDEN_SEED_BONUS);
    expect(m.yieldMult).toBeCloseTo(1 + 10 * GOLDEN_SEED_BONUS);
  });
});

describe('perks', () => {
  it('cost Golden Seeds, are kept for good, and shape the next season', () => {
    let s = grown(SEASON_MIN_PLOTS, 1e6);
    s = { ...s, season: { ...s.season, goldenSeeds: 30 } };
    for (const id of ['early-can', 'big-start', 'old-pipes', 'long-nap']) s = reducer(s, { type: 'buyPerk', id });
    expect(s.season.goldenSeeds).toBe(30 - 3 - 6 - 10 - 4);
    expect(reducer(s, { type: 'buyPerk', id: 'early-can' }).season.goldenSeeds).toBe(s.season.goldenSeeds); // can't buy twice
    expect(modifiers(s).offlineSeconds).toBe(OFFLINE_BASE_SECONDS + 4 * 3600);
    const next = reducer(s, { type: 'newSeason', now: 0 });
    expect(next.plots).toHaveLength(12);
    expect(next.upgrades).toMatchObject({ can: 1, pump: 1 });
    expect(next.irrigatedRows).toEqual([0]);
    expect(next.season.perks).toHaveLength(4);
  });

  it('cannot be bought without enough seeds', () => {
    const s = reducer(newGame(0), { type: 'buyPerk', id: 'ribbon' });
    expect(s.season.perks).toEqual([]);
  });
});

describe('saves from before seasons', () => {
  it('load as season 1', () => {
    const { season: _s, patrolAt: _p, ...old } = JSON.parse(serialize(newGame(0)));
    const s = deserialize(JSON.stringify(old), 1000);
    expect(s.season).toEqual({ number: 1, goldenSeeds: 0, totalGoldenSeeds: 0, perks: [], startEarned: 0 });
    expect(typeof s.patrolAt).toBe('number');
  });
});
