import { beforeEach, describe, expect, it } from 'vitest';
import { cellId, newPlant } from './garden';
import { FRUIT_SELL_PRICE, fruitKey } from './plants';
import { areaCells, countFruit, deserialize, irrigationRowPrice, modifiers, newGame, reducer, serialize, setRng, type GameState } from './state';

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}
beforeEach(() => setRng(seeded(3)));

const rich = (upgrades: Record<string, number> = {}): GameState => {
  let s: GameState = { ...newGame(0), coins: 1e9, upgrades };
  for (let i = 0; i < 18; i++) s = reducer(s, { type: 'buyLand', now: 0 });
  return { ...s, plots: s.plots.map((p) => ({ ...p, weeds: 0 })), notices: [] };
};
const ripeEverywhere = (s: GameState): GameState => ({
  ...s,
  plots: s.plots.map((p) => ({ ...p, plant: { ...newPlant('apple'), growth: 1 } })),
});

describe('reach', () => {
  it('odd squares centre on the plot, even ones start at it, and both stay in the grid', () => {
    expect(areaCells(2, 2, 3).sort((a, b) => a - b)).toEqual(
      [cellId(1, 1), cellId(2, 1), cellId(3, 1), cellId(1, 2), cellId(2, 2), cellId(3, 2), cellId(1, 3), cellId(2, 3), cellId(3, 3)].sort((a, b) => a - b),
    );
    expect(areaCells(0, 0, 3)).toContain(cellId(2, 2)); // shifted in from the corner
    expect(areaCells(5, 0, 2)).toEqual([cellId(4, 0), cellId(5, 0), cellId(4, 1), cellId(5, 1)]);
  });

  it('a bigger can waters and soaks the whole square', () => {
    let s = rich({ can: 2 }); // 3×3
    s = reducer(s, { type: 'use', plotId: cellId(1, 1), tool: 'water', now: 1000 });
    const watered = s.plots.filter((p) => p.moisture === 1);
    expect(watered).toHaveLength(9);
    expect(watered.every((p) => p.soakedUntil > 1000)).toBe(true);
  });

  it('a bigger basket harvests the whole square', () => {
    let s = ripeEverywhere(rich({ basket: 1 }));
    s = reducer(s, { type: 'use', plotId: cellId(0, 0), tool: 'harvest', now: 0 });
    expect(s.plots.filter((p) => p.plant!.growth < 1)).toHaveLength(4);
  });
});

describe('shed', () => {
  it('upgrades cost coins, go up a level, and respect their requirements', () => {
    let s: GameState = { ...newGame(0), coins: 100_000 };
    s = reducer(s, { type: 'buyUpgrade', id: 'pump', now: 0 });
    expect(s.upgrades.pump).toBeUndefined(); // needs the 4×4 can first
    for (let i = 0; i < 3; i++) s = reducer(s, { type: 'buyUpgrade', id: 'can', now: 0 });
    expect(modifiers(s).waterReach).toBe(4);
    s = reducer(s, { type: 'buyUpgrade', id: 'can', now: 0 }); // maxed: no-op
    expect(s.upgrades.can).toBe(3);
    const before = s.coins;
    s = reducer(s, { type: 'buyUpgrade', id: 'pump', now: 0 });
    expect(s.upgrades.pump).toBe(1);
    expect(s.coins).toBe(before - 4_000);
  });
});

describe('irrigation', () => {
  it('drip lines get pricier, and the pump waters irrigated rows on schedule', () => {
    let s = rich({ can: 3, pump: 1 }); // every 10 min
    s = { ...s, plots: s.plots.map((p) => ({ ...p, moisture: 0 })), irrigatedAt: 0 };
    s = reducer(s, { type: 'irrigateRow', row: 0, now: 0 });
    expect(s.irrigatedRows).toEqual([0]);
    expect(irrigationRowPrice(1)).toBeGreaterThan(irrigationRowPrice(0));
    s = reducer(s, { type: 'tick', now: 599_000 });
    expect(s.plots.filter((p) => p.y === 0).every((p) => p.moisture === 0)).toBe(true);
    s = reducer(s, { type: 'tick', now: 601_000 });
    expect(s.plots.filter((p) => p.y === 0).every((p) => p.moisture > 0.9)).toBe(true);
    expect(s.plots.filter((p) => p.y === 1).every((p) => p.moisture === 0)).toBe(true);
    // Irrigation keeps plants growing, but never soaks.
    expect(s.plots.every((p) => p.soakedUntil === 0)).toBe(true);
  });

  it('round-the-clock irrigation never lets a row dry out', () => {
    let s = { ...rich({ can: 3, pump: 5 }), irrigatedRows: [1] };
    s = reducer(s, { type: 'tick', now: 3_600_000 });
    expect(s.plots.filter((p) => p.y === 1).every((p) => p.moisture === 1)).toBe(true);
    expect(s.plots.filter((p) => p.y === 0).every((p) => p.moisture === 0)).toBe(true);
  });
});

describe('wheelbarrow & stand', () => {
  it('the barrow picks ripe plants until full, then waits to be emptied', () => {
    let s = ripeEverywhere({ ...rich({ basket: 1, barrow: 1 }), barrowAt: 0 }); // holds 40
    s = reducer(s, { type: 'tick', now: 31_000 });
    const n = countFruit(s.barrow);
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThanOrEqual(40 + 3); // the last plant can overfill by its yield
    const fruitBefore = countFruit(s.fruits);
    s = reducer(s, { type: 'emptyBarrow', now: 31_000 });
    expect(countFruit(s.barrow)).toBe(0);
    expect(countFruit(s.fruits)).toBe(fruitBefore + n);
  });

  it('harvest all only comes with the wheelbarrow', () => {
    const locked = reducer(ripeEverywhere(rich()), { type: 'harvestAll', now: 0 });
    expect(locked.plots.every((p) => p.plant!.growth === 1)).toBe(true);
    const unlocked = reducer(ripeEverywhere(rich({ basket: 1, barrow: 1 })), { type: 'harvestAll', now: 0 });
    expect(unlocked.plots.every((p) => p.plant!.growth < 1)).toBe(true);
  });

  it('the stand sells the chosen qualities, and reputation raises prices', () => {
    const start = (rep: number): GameState => ({
      ...newGame(0),
      coins: 0,
      upgrades: { stand: 1, reputation: rep },
      fruits: { [fruitKey('apple', 'normal')]: 100, [fruitKey('apple', 'fine')]: 100 },
      stand: { qualities: ['normal'], carry: 0 },
    });
    const plain = reducer(start(0), { type: 'tick', now: 20_000 }); // 0.5/s × 20s = 10 fruit
    expect(plain.fruits[fruitKey('apple', 'normal')]).toBe(90);
    expect(plain.fruits[fruitKey('apple', 'fine')]).toBe(100);
    expect(plain.coins).toBeCloseTo(10 * FRUIT_SELL_PRICE[0]);
    const famous = reducer(start(2), { type: 'tick', now: 20_000 });
    expect(famous.coins).toBeCloseTo(10 * FRUIT_SELL_PRICE[0] * 1.5);
  });
});

describe('saves from before the shed', () => {
  it('load with every new field defaulted', () => {
    const { upgrades: _u, irrigatedRows: _r, irrigatedAt: _i, barrow: _b, barrowAt: _a, stand: _s, ...old } = JSON.parse(serialize(newGame(0)));
    old.plots = old.plots.map(({ soakedUntil: _x, ...p }: Record<string, unknown>) => p);
    const s = reducer(deserialize(JSON.stringify(old), 5000), { type: 'tick', now: 10_000 });
    expect(s.upgrades).toEqual({});
    expect(s.irrigatedRows).toEqual([]);
    expect(s.stand.qualities).toEqual(['normal']);
    expect(s.plots.every((p) => p.soakedUntil === 0)).toBe(true);
  });
});
