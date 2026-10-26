import { beforeEach, describe, expect, it } from 'vitest';
import { EXPANSION_ORDER, cellId, newPlant } from './garden';
import { QUALITY_YIELD, fruitKey } from './plants';
import {
  DIG_COMPOST,
  LAND_BASE_PRICE,
  MAX_PLOTS,
  SAVE_VERSION,
  TOPDRESS_COMPOST,
  VIGOR_FLOOR,
  deserialize,
  landPrice,
  newGame,
  nextLand,
  reducer,
  setRng,
  type GameState,
} from './state';

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}
beforeEach(() => setRng(seeded(7)));

const withPlant = (s: GameState, plotId: number, kind = 'apple', extra = {}): GameState => ({
  ...s,
  plots: s.plots.map((p) => (p.id === plotId ? { ...p, weeds: 0, plant: { ...newPlant(kind), ...extra } } : p)),
});

describe('grid & land', () => {
  it('starts as a 3×2 bed and sells land in expansion order', () => {
    let s = { ...newGame(0), coins: 1_000_000 };
    expect(s.plots.map((p) => [p.x, p.y])).toEqual([[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]]);
    expect(nextLand(s.plots)).toEqual({ x: 3, y: 0 });
    s = reducer(s, { type: 'buyLand', now: 0 });
    expect(s.plots.some((p) => p.id === cellId(3, 0))).toBe(true);
    expect(nextLand(s.plots)).toEqual({ x: 3, y: 1 });
  });

  it('gets steadily pricier and stops at the full grid', () => {
    expect(landPrice(6)).toBe(LAND_BASE_PRICE);
    expect(landPrice(12)).toBeGreaterThan(landPrice(11));
    let s = { ...newGame(0), coins: 1e12 };
    for (let i = 0; i < 60; i++) s = reducer(s, { type: 'buyLand', now: 0 });
    expect(s.plots).toHaveLength(MAX_PLOTS);
    expect(new Set(s.plots.map((p) => p.id)).size).toBe(MAX_PLOTS);
    expect(EXPANSION_ORDER).toHaveLength(MAX_PLOTS);
  });

  it('refuses land you cannot afford', () => {
    const s = reducer({ ...newGame(0), coins: 5 }, { type: 'buyLand', now: 0 });
    expect(s.plots).toHaveLength(6);
    expect(s.coins).toBe(5);
  });
});

describe('perennials', () => {
  it('never despawn: vigor wears down to a floor', () => {
    let s = withPlant(newGame(0), 0, 'apple', { growth: 1 });
    for (let i = 0; i < 20; i++) {
      s = { ...s, plots: s.plots.map((p) => (p.id === 0 ? { ...p, plant: { ...p.plant!, growth: 1 } } : p)) };
      s = reducer(s, { type: 'use', plotId: 0, tool: 'harvest', now: 0 });
    }
    const plant = s.plots[0].plant!;
    expect(plant).not.toBeNull();
    expect(plant.harvests).toBe(20);
    expect(plant.vigor).toBeCloseTo(VIGOR_FLOOR);
  });

  it('better quality gives more fruit', () => {
    const total = (care: number, fert: boolean) => {
      let fruit = 0;
      for (let i = 0; i < 200; i++) {
        let s = withPlant(newGame(0), 0, 'apple', { growth: 1, careGood: care, careTotal: 1, fertilizedThisCycle: fert });
        s = { ...s, fruits: {} };
        s = reducer(s, { type: 'use', plotId: 0, tool: 'harvest', now: 0 });
        fruit += Object.values(s.fruits).reduce((a, b) => a + b, 0);
      }
      return fruit / 200;
    };
    const normal = total(0.1, false);
    const fine = total(0.7, false);
    const perfect = total(0.95, true);
    expect(normal).toBeCloseTo(QUALITY_YIELD.normal, 0);
    expect(fine).toBeGreaterThan(normal);
    expect(perfect).toBeGreaterThan(fine);
  });

  it('top-dressing spends compost to restore vigor', () => {
    let s = withPlant({ ...newGame(0), compost: 5 }, 0, 'apple', { vigor: 0.5 });
    s = reducer(s, { type: 'topDress', plotId: 0, now: 0 });
    expect(s.plots[0].plant!.vigor).toBeCloseTo(0.75);
    expect(s.compost).toBe(5 - TOPDRESS_COMPOST);
  });

  it('digging up clears the plot and gives compost', () => {
    let s = withPlant(newGame(0), 0);
    s = reducer(s, { type: 'digUp', plotId: 0, now: 0 });
    expect(s.plots[0].plant).toBeNull();
    expect(s.compost).toBe(DIG_COMPOST);
  });
});

describe('save migration', () => {
  // A save in the format the game wrote before this update (version 1).
  const v1 = {
    version: 1,
    lastTick: 0,
    coins: 123,
    fertilizer: 4,
    compost: 2,
    seeds: { apple: 1 },
    fruits: { [fruitKey('apple', 'fine')]: 5 },
    plots: [
      { id: 0, moisture: 0.5, weeds: 0, plant: { kind: 'apple', growth: 0.3, harvestsLeft: 1, careGood: 1, careTotal: 2, fertilizedUntil: 0, fertilizedThisCycle: false } },
      ...Array.from({ length: 7 }, (_, i) => ({ id: i + 1, moisture: 0, weeds: 2, plant: null })),
    ],
    collection: { 'some-bug-that-does-not-exist': { count: 1, firstAt: 0 } },
    pity: 3,
    totalSummons: 9,
    shop: { slots: [], refreshedAt: 0 },
  };

  it('keeps progress and lays old plots onto the grid', () => {
    const s = deserialize(JSON.stringify(v1), 1000);
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.coins).toBe(123);
    expect(s.fruits[fruitKey('apple', 'fine')]).toBe(5);
    expect(s.pity).toBe(3);
    expect(s.plots).toHaveLength(8);
    expect(s.plots.map((p) => p.id)).toEqual(EXPANSION_ORDER.slice(0, 8).map((c) => cellId(c.x, c.y)).sort((a, b) => a - b));
    const apple = s.plots.find((p) => p.plant)!.plant!;
    expect(apple.kind).toBe('apple');
    expect(apple.vigor).toBe(1);
    expect(apple.harvests).toBe(0);
    expect('harvestsLeft' in apple).toBe(false);
  });
});
