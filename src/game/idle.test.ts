import { beforeEach, describe, expect, it } from 'vitest';
import { BUGS, bugsInOrder } from './bugs';
import { ORDER_COMPLETE_BONUS, PER_SPECIES_BONUS, bugdexBonuses } from './bonuses';
import { newPlant } from './garden';
import { fruitKey } from './plants';
import {
  ACHIEVEMENT_BONUS,
  BUTTERFLY_STAY_SECONDS,
  OFFLINE_BASE_SECONDS,
  butterflyVisible,
  deserialize,
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
beforeEach(() => setRng(seeded(5)));

const own = (ids: string[]): GameState['collection'] => Object.fromEntries(ids.map((id) => [id, { count: 1, firstAt: 0 }]));

describe('bugdex bonuses', () => {
  it('each species helps its order’s stat, and a full order adds a bonus', () => {
    const bees = bugsInOrder('Hymenoptera');
    expect(bugdexBonuses(own([bees[0].id])).yield).toBeCloseTo(PER_SPECIES_BONUS);
    expect(bugdexBonuses(own(bees.map((b) => b.id))).yield).toBeCloseTo(bees.length * PER_SPECIES_BONUS + ORDER_COMPLETE_BONUS);
    expect(bugdexBonuses(own(bees.map((b) => b.id))).growth).toBe(0);
  });

  it('feed into the garden: beetles slow weeds, stick insects extend time away', () => {
    const beetles = own(bugsInOrder('Coleoptera').map((b) => b.id));
    expect(modifiers({ upgrades: {}, collection: beetles }).weedIntervalMult).toBeGreaterThan(1);
    const sticks = own(bugsInOrder('Phasmatodea').map((b) => b.id));
    expect(modifiers({ upgrades: {}, collection: sticks }).offlineSeconds).toBeGreaterThan(OFFLINE_BASE_SECONDS);
  });
});

describe('achievements', () => {
  it('unlock from lifetime stats, once, and raise yield', () => {
    let s = newGame(0);
    s = { ...s, stats: { ...s.stats, weedsPulled: 99 } };
    s = { ...s, plots: s.plots.map((p, i) => (i === 0 ? { ...p, weeds: 1 } : p)) };
    s = reducer(s, { type: 'pullWeed', plotId: s.plots[0].id, now: 0 });
    expect(s.achievements).toContain('weeds-100');
    expect(modifiers(s).yieldMult).toBeCloseTo(1 + ACHIEVEMENT_BONUS);
    const again = reducer(s, { type: 'tick', now: 1000 });
    expect(again.achievements.filter((a) => a === 'weeds-100')).toHaveLength(1);
  });

  it('count coins from every source toward lifetime earnings', () => {
    let s = { ...newGame(0), fruits: { [fruitKey('apple', 'normal')]: 5 } };
    s = reducer(s, { type: 'sellFruit', key: fruitKey('apple', 'normal'), count: 5 });
    expect(s.stats.coinsEarned).toBe(15);
    s = reducer({ ...s, coins: 0 }, { type: 'buySeed', plantId: 'apple' }); // spending doesn't reduce earnings
    expect(s.stats.coinsEarned).toBe(15);
  });
});

describe('golden butterfly', () => {
  it('appears on schedule, stays a few seconds, then flies off', () => {
    let s = newGame(0);
    const at = s.butterfly.nextAt;
    s = reducer(s, { type: 'tick', now: at - 1000 });
    expect(butterflyVisible(s, at - 1000)).toBe(false);
    s = reducer(s, { type: 'tick', now: at });
    expect(butterflyVisible(s, at)).toBe(true);
    const gone = reducer(s, { type: 'tick', now: at + (BUTTERFLY_STAY_SECONDS + 1) * 1000 });
    expect(gone.butterfly.shownAt).toBeNull();
    expect(gone.butterfly.nextAt).toBeGreaterThan(at + 60_000);
  });

  it('can be caught for a reward, and counts toward achievements', () => {
    const rewards = new Set<string>();
    for (let i = 0; i < 40; i++) {
      let s = newGame(0);
      s = { ...s, plots: s.plots.map((p) => ({ ...p, plant: { ...newPlant('apple'), growth: 0.5 } })) };
      const at = s.butterfly.nextAt;
      s = reducer(s, { type: 'tick', now: at });
      const caught = reducer(s, { type: 'catchButterfly', now: at + 1000 });
      expect(caught.stats.butterflies).toBe(1);
      expect(caught.butterfly.shownAt).toBeNull();
      if (caught.plots[0].plant!.growth > 0.6) rewards.add('bloom');
      if (caught.plots.every((p) => p.soakedUntil > at)) rewards.add('rain');
      if (caught.coins > s.coins) rewards.add('purse');
      if (Object.values(caught.seeds).reduce((a, b) => a + b, 0) > Object.values(s.seeds).reduce((a, b) => a + b, 0)) rewards.add('seeds');
    }
    expect([...rewards].sort()).toEqual(['bloom', 'purse', 'rain', 'seeds']);
  });

  it('does nothing when there is no butterfly', () => {
    const s = newGame(0);
    const after = reducer(s, { type: 'catchButterfly', now: 1000 });
    expect(after.stats.butterflies).toBe(0);
    expect(after.coins).toBe(s.coins);
  });
});

describe('time away', () => {
  it('grows for up to 8 hours and sums up what happened', () => {
    let s = newGame(0);
    s = { ...s, upgrades: { basket: 1, barrow: 1 }, plots: s.plots.map((p) => ({ ...p, weeds: 0, plant: newPlant('apple') })) };
    const loaded = deserialize(serialize(s), 12 * 3600 * 1000);
    expect(loaded.lastTick).toBe(12 * 3600 * 1000);
    expect(loaded.awaySummary).not.toBeNull();
    expect(loaded.awaySummary!.capped).toBe(true);
    expect(loaded.awaySummary!.fruit).toBeGreaterThan(0);
    expect(loaded.awaySummary!.barrowFull).toBe(true);
    expect(reducer(loaded, { type: 'dismissAway' }).awaySummary).toBeNull();
  });

  it('shows no summary after a short break, and never saves it', () => {
    const s = newGame(0);
    expect(deserialize(serialize(s), 60_000).awaySummary).toBeNull();
    expect(serialize({ ...s, awaySummary: { seconds: 1, capped: false, coins: 0, fruit: 0, weeds: 0, ripe: 0, barrowFull: false } })).not.toContain('awaySummary');
  });

  it('every species is counted', () => {
    expect(Object.keys(bugdexBonuses(own(BUGS.map((b) => b.id)))).length).toBe(12);
  });
});
