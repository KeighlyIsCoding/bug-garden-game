import { describe, expect, it, beforeEach } from 'vitest';
import { BUGS, ORDERS, rareShare, tierOf } from './bugs';
import { PITY_LIMIT, summon, tierOdds } from './gacha';
import { ORDER_SEED_TIERS, PLANT_BY_ID, PLANTS, fruitKey } from './plants';
import { REGROW_FROM, advance, deserialize, newGame, qualityFor, reducer, serialize, setRng, type GameState } from './state';

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

beforeEach(() => setRng(seeded(42)));

describe('bug data', () => {
  it('has species in every order with unique ids', () => {
    for (const order of ORDERS) expect(BUGS.some((b) => b.order === order)).toBe(true);
    expect(new Set(BUGS.map((b) => b.id)).size).toBe(BUGS.length);
  });

  it('maps conservation status to rarity tiers', () => {
    const byStatus = (s: string) => BUGS.find((b) => b.status === s)!;
    expect(tierOf(byStatus('LC'))).toBe(0);
    expect(tierOf(byStatus('VU'))).toBe(2);
    expect(tierOf(byStatus('CR'))).toBe(4);
    expect(tierOf(byStatus('EX'))).toBe(5);
  });
});

describe('seed scarcity', () => {
  it('gives orders with a larger share of rare bugs scarcer seeds', () => {
    for (const a of ORDERS)
      for (const b of ORDERS)
        if (rareShare(a) < rareShare(b)) expect(ORDER_SEED_TIERS[a]).toBeLessThanOrEqual(ORDER_SEED_TIERS[b]);
  });
});

describe('gacha', () => {
  it('odds sum to 1 and luck shifts weight to rarer tiers', () => {
    const apple = PLANT_BY_ID.apple;
    const star = PLANT_BY_ID.starfruit;
    const a = tierOdds(apple, 'normal');
    const s = tierOdds(star, 'perfect');
    expect(a.reduce((x, y) => x + y, 0)).toBeCloseTo(1);
    expect(s[0]).toBeLessThan(a[0]);
    expect(s[4]).toBeGreaterThan(a[4]);
  });

  it('order fruits only summon from their order', () => {
    const fig = PLANT_BY_ID.fig;
    for (let i = 0; i < 200; i++) expect(summon(fig, 'normal', 0, () => false).bug.order).toBe('Hymenoptera');
  });

  it('drops tiers absent from the pool', () => {
    const grape = PLANTS.find((p) => p.order === 'Hemiptera')!;
    const odds = tierOdds(grape, 'normal');
    expect(odds[5]).toBe(0);
  });

  it('pity guarantees Epic or better when available', () => {
    const apple = PLANT_BY_ID.apple;
    for (let i = 0; i < 100; i++) expect(summon(apple, 'normal', PITY_LIMIT - 1, () => false).tier).toBeGreaterThanOrEqual(3);
  });
});

describe('garden', () => {
  function plantAt(s: GameState, plotId: number, seed: string, now: number) {
    s = { ...s, plots: s.plots.map((p) => (p.id === plotId ? { ...p, weeds: 0 } : p)) };
    return reducer(s, { type: 'use', plotId, tool: 'plant', seed, now });
  }

  it('plants, grows with water, and harvests fruit', () => {
    let now = 1_000_000;
    let s = newGame(now);
    s = plantAt(s, 0, 'apple', now);
    expect(s.plots[0].plant?.kind).toBe('apple');
    expect(s.seeds.apple).toBe(2);
    // Keep it watered and weed-free every few seconds until ripe.
    for (let i = 0; i < 200 && !(s.plots[0].plant!.growth >= 1); i++) {
      now += 5000;
      s = reducer(s, { type: 'tick', now });
      s = { ...s, plots: s.plots.map((p) => (p.id === 0 ? { ...p, weeds: 0, moisture: 1 } : p)) };
    }
    expect(s.plots[0].plant!.growth).toBe(1);
    expect(qualityFor(s.plots[0].plant!)).toBe('fine');
    const before = s.fruits[fruitKey('apple', 'fine')] ?? 0;
    s = reducer(s, { type: 'use', plotId: 0, tool: 'harvest', now });
    expect(s.fruits[fruitKey('apple', 'fine')]).toBeGreaterThan(before);
    // Perennial: it stays in the ground, regrows from flowering, and loses a little vigor.
    expect(s.plots[0].plant?.harvests).toBe(1);
    expect(s.plots[0].plant?.growth).toBeCloseTo(REGROW_FROM);
    expect(s.plots[0].plant?.vigor).toBeLessThan(1);
  });

  it('dry plants grow much slower', () => {
    const now = 0;
    let wet = plantAt(newGame(now), 0, 'apple', now);
    let dry = wet;
    wet = { ...wet, plots: wet.plots.map((p) => ({ ...p, moisture: 1 })) };
    wet = advance(wet, 20_000);
    dry = advance(dry, 20_000);
    expect(wet.plots[0].plant!.growth).toBeGreaterThan(dry.plots[0].plant!.growth * 3);
  });

  it('weeding gives compost and compost makes fertilizer', () => {
    let s = newGame(0);
    s = { ...s, plots: s.plots.map((p) => ({ ...p, weeds: 3 })) };
    for (const p of s.plots) s = reducer(s, { type: 'pullWeed', plotId: p.id, now: 0 });
    expect(s.compost).toBe(6);
    expect(s.plots.every((p) => p.weeds === 2)).toBe(true);
    s = reducer(s, { type: 'makeFertilizer' });
    expect(s.fertilizer).toBe(3);
    expect(s.compost).toBe(3);
  });
});

describe('summon + collection', () => {
  it('consumes fruit, adds the bug and pays for new species', () => {
    let s = newGame(0);
    const coins = s.coins;
    s = reducer(s, { type: 'summon', fruitKey: fruitKey('apple', 'normal'), now: 0 });
    expect(s.fruits[fruitKey('apple', 'normal')]).toBe(1);
    expect(Object.keys(s.collection)).toHaveLength(1);
    expect(s.coins).toBeGreaterThan(coins);
    expect(s.lastSummon?.isNew).toBe(true);
  });

  it('round-trips through save/load', () => {
    let s = newGame(0);
    s = reducer(s, { type: 'summon', fruitKey: fruitKey('apple', 'normal'), now: 0 });
    const loaded = deserialize(serialize(s), 10);
    expect(loaded.collection).toEqual(s.collection);
    expect(loaded.coins).toBe(s.coins);
  });
});
