import { beforeEach, describe, expect, it } from 'vitest';
import { cellId, newPlant } from './garden';
import { QUALITY_YIELD } from './plants';
import { WEED_INTERVAL, modifiers, newGame, qualityFor, reducer, setRng, type GameState, type Plant } from './state';

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}
beforeEach(() => setRng(seeded(11)));

const garden = (upgrades: Record<string, number> = {}, weeds = 3): GameState => {
  let s: GameState = { ...newGame(0), coins: 1e9, upgrades };
  for (let i = 0; i < 6; i++) s = reducer(s, { type: 'buyLand', now: 0 }); // 12 plots: rows 1–2 full width
  return { ...s, compost: 0, plots: s.plots.map((p) => ({ ...p, weeds })), notices: [] };
};
const plant = (extra: Partial<Plant> = {}): Plant => ({ ...newPlant('apple'), growth: 1, careGood: 1, careTotal: 1, ...extra });

describe('glove', () => {
  it('pulls every weed in the plots it reaches, with compost for each', () => {
    let s = garden({ glove: 2 });
    s = reducer(s, { type: 'pullWeeds', plotIds: [cellId(0, 0), cellId(1, 0), cellId(0, 1), cellId(1, 1)], now: 0 });
    expect(s.plots.filter((p) => p.weeds === 0)).toHaveLength(4);
    expect(s.compost).toBe(12);
    expect(modifiers(s).gloveReach).toBe(2);
  });
});

describe('clippers', () => {
  it('clear weeds instantly, give no compost, and the weeds come back faster', () => {
    let s = garden({ clippers: 1 });
    s = reducer(s, { type: 'use', plotId: cellId(0, 0), tool: 'clip', now: 0 });
    const plot = s.plots.find((p) => p.id === cellId(0, 0))!;
    expect(plot.weeds).toBe(0);
    expect(plot.cutUntil).toBeGreaterThan(0);
    expect(s.compost).toBe(0);
    // Weeds regrow on clipped plots about twice as often as on fresh, weed-free ones.
    const regrow = (cut: boolean) => {
      let total = 0;
      for (let i = 0; i < 400; i++) {
        let t: GameState = { ...garden({}, 0), lastTick: 0 };
        t = { ...t, plots: t.plots.map((p) => ({ ...p, cutUntil: cut ? 1e12 : 0 })) };
        t = reducer(t, { type: 'tick', now: (WEED_INTERVAL / 4) * 1000 });
        total += t.plots.reduce((a, p) => a + p.weeds, 0);
      }
      return total;
    };
    expect(regrow(true)).toBeGreaterThan(regrow(false) * 1.6);
  });

  it('only work once bought', () => {
    const s = reducer(garden(), { type: 'use', plotId: cellId(0, 0), tool: 'clip', now: 0 });
    expect(s.plots.find((p) => p.id === cellId(0, 0))!.weeds).toBe(3);
  });
});

describe('herbicide', () => {
  it('needs the sprayer, costs a dose, kills weeds and costs the crop a quality tier', () => {
    let s = garden({ clippers: 1 });
    s = reducer(s, { type: 'buyHerbicide' });
    expect(s.herbicide).toBe(0); // no sprayer yet
    s = { ...s, upgrades: { ...s.upgrades, sprayer: 1 } };
    s = reducer(s, { type: 'buyHerbicide' });
    expect(s.herbicide).toBe(1);
    s = { ...s, plots: s.plots.map((p) => (p.id === 0 ? { ...p, plant: plant({ fertilizedThisCycle: true }) } : p)) };
    expect(qualityFor(s.plots[0].plant!)).toBe('perfect');
    s = reducer(s, { type: 'use', plotId: 0, tool: 'spray', now: 0 });
    expect(s.herbicide).toBe(0);
    expect(s.plots[0].weeds).toBe(0);
    expect(s.plots[0].herbicideUntil).toBeGreaterThan(0);
    expect(qualityFor(s.plots[0].plant!)).toBe('fine');
  });
});

describe('quality tiers', () => {
  const prizeReady = plant({ fertilizedThisCycle: true, soakedThisCycle: true });

  it('Prize and Heirloom only exist once unlocked', () => {
    expect(qualityFor(prizeReady)).toBe('perfect');
    expect(qualityFor(prizeReady, 'prize')).toBe('prize');
    expect(qualityFor(prizeReady, 'heirloom')).toBe('heirloom');
    expect(qualityFor({ ...prizeReady, vigor: 0.5 }, 'heirloom')).toBe('prize'); // needs a vigorous plant
    expect(qualityFor({ ...prizeReady, soakedThisCycle: false }, 'heirloom')).toBe('perfect'); // needs hand-watering
    expect(QUALITY_YIELD.heirloom).toBeGreaterThan(QUALITY_YIELD.prize);
  });

  it('hand-watering marks the crop as soaked, and harvesting resets it', () => {
    let s = garden({ prize: 1 }, 0);
    s = { ...s, plots: s.plots.map((p) => (p.id === 0 ? { ...p, plant: plant({ growth: 0.5, fertilizedThisCycle: true }) } : p)) };
    s = reducer(s, { type: 'use', plotId: 0, tool: 'water', now: 0 });
    expect(s.plots[0].plant!.soakedThisCycle).toBe(true);
    s = { ...s, plots: s.plots.map((p) => (p.id === 0 ? { ...p, plant: { ...p.plant!, growth: 1 } } : p)) };
    s = reducer(s, { type: 'use', plotId: 0, tool: 'harvest', now: 0 });
    expect(Object.keys(s.fruits).some((k) => k.endsWith(':prize'))).toBe(true);
    expect(s.plots[0].plant!.soakedThisCycle).toBe(false);
  });
});

describe('soil', () => {
  it('the trowel sometimes gives the seed back', () => {
    let backs = 0;
    for (let i = 0; i < 200; i++) {
      let s: GameState = { ...garden({ trowel: 1 }, 0), seeds: {} };
      s = { ...s, plots: s.plots.map((p) => (p.id === 0 ? { ...p, plant: plant() } : p)) };
      s = reducer(s, { type: 'digUp', plotId: 0, now: 0 });
      backs += s.seeds.apple ?? 0;
    }
    expect(backs).toBeGreaterThan(70);
    expect(backs).toBeLessThan(130);
  });

  it('the tumbler makes fertilizer cheaper, then makes it by itself above a reserve', () => {
    let s = { ...garden({ tumbler: 1 }), compost: 4, fertilizer: 0 };
    s = reducer(s, { type: 'makeFertilizer' });
    expect(s.compost).toBe(2);
    s = { ...s, upgrades: { tumbler: 2 }, compost: 17, lastTick: 0 };
    s = reducer(s, { type: 'tick', now: 1000 });
    expect(s.compost).toBe(11);
    expect(s.fertilizer).toBe(4);
  });
});
