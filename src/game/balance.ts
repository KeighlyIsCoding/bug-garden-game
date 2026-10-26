/**
 * Simulated players for balance testing. They play through the real reducer, so pacing numbers
 * reflect the actual rules. Used by balance.test.ts; also handy for quick experiments.
 */
import { isRipe } from './garden';
import { PLANTS, SEED_PRICE } from './plants';
import { UPGRADES, capsuleCost, irrigationRowPrice, isUnlocked, landPrice, level, nextCost, nextLand, newGame, reducer } from './state';
import type { Action, GameState } from './types';

export interface BotOptions {
  /** Seconds between check-ins. */
  every: number;
  /** Total simulated seconds. */
  duration: number;
  /** Does the bot water, weed and fertilize by hand? */
  tends: boolean;
}

export interface SimResult {
  state: GameState;
  /** Seconds at which the garden first reached each plot count. */
  plotsAt: Record<number, number>;
  /** Fruit harvested per check-in window, for measuring output over time. */
  fruitLog: { t: number; fruit: number }[];
}

const fruitTotal = (s: GameState) => Object.values(s.fruits).reduce((a, b) => a + b, 0);

/** One check-in by a sensible player: harvest, care, replant, turn fruit into coins, expand. */
function checkIn(s: GameState, now: number, tends: boolean): { s: GameState; harvested: number } {
  const act = (a: Action) => (s = reducer(s, a));
  let harvested = 0;
  act({ type: 'tick', now });
  for (const plot of s.plots) {
    const p = () => s.plots.find((q) => q.id === plot.id)!;
    if (p().plant && isRipe(p().plant!)) {
      const before = fruitTotal(s);
      act({ type: 'use', plotId: plot.id, tool: 'harvest', now });
      harvested += fruitTotal(s) - before;
    }
    if (tends) {
      while (p().weeds > 0) act({ type: 'pullWeed', plotId: plot.id, now });
      if (p().moisture < 0.3) act({ type: 'use', plotId: plot.id, tool: 'water', now });
      const plant = p().plant;
      if (plant && !plant.fertilizedThisCycle && !isRipe(plant)) {
        if (s.fertilizer === 0 && s.compost >= 3) act({ type: 'makeFertilizer' });
        if (s.fertilizer > 0) act({ type: 'use', plotId: plot.id, tool: 'fertilize', now });
      }
      if (plant && plant.vigor < 0.7 && s.compost >= 2) act({ type: 'topDress', plotId: plot.id, now });
    }
    if (!p().plant && p().weeds === 0) {
      let seed = PLANTS.find((d) => (s.seeds[d.id] ?? 0) > 0)?.id;
      if (!seed && s.coins >= SEED_PRICE[0]) {
        act({ type: 'buySeed', plantId: 'apple' });
        seed = 'apple';
      }
      if (seed) act({ type: 'use', plotId: plot.id, tool: 'plant', seed, now });
    }
  }
  // A balanced player: sell all Normal fruit and half the Fine for coins; summon with the rest (more luck).
  const cost = () => capsuleCost(Object.keys(s.collection).length);
  for (const [key, n] of Object.entries(s.fruits)) {
    if (key.endsWith(':normal')) act({ type: 'sellFruit', key, count: n });
    else if (key.endsWith(':fine') && n >= 2) act({ type: 'sellFruit', key, count: Math.floor(n / 2) });
  }
  for (const key of Object.keys(s.fruits)) while ((s.fruits[key] ?? 0) >= cost()) act({ type: 'summon', fruitKey: key, now });
  act({ type: 'releaseAllDuplicates' });
  // Spend on whatever is cheapest: land, the next level of an upgrade, or a drip line.
  for (;;) {
    const options: { cost: number; action: Action }[] = [];
    if (nextLand(s.plots)) options.push({ cost: landPrice(s.plots.length), action: { type: 'buyLand', now } });
    for (const u of UPGRADES) {
      const cost = nextCost(s, u.id);
      if (cost !== null && isUnlocked(s, u)) options.push({ cost, action: { type: 'buyUpgrade', id: u.id, now } });
    }
    const dry = [...new Set(s.plots.map((p) => p.y))].find((y) => !s.irrigatedRows.includes(y));
    if (level(s, 'pump') > 0 && dry !== undefined)
      options.push({ cost: irrigationRowPrice(s.irrigatedRows.length), action: { type: 'irrigateRow', row: dry, now } });
    const best = options.sort((a, b) => a.cost - b.cost)[0];
    if (!best || best.cost > s.coins) break;
    act(best.action);
  }
  if (Object.keys(s.barrow).length) act({ type: 'emptyBarrow', now });
  return { s, harvested };
}

export function simulate(opts: BotOptions, start = 0): SimResult {
  let s = newGame(start);
  const plotsAt: Record<number, number> = { [s.plots.length]: 0 };
  const fruitLog: SimResult['fruitLog'] = [];
  for (let t = opts.every; t <= opts.duration; t += opts.every) {
    const r = checkIn(s, start + t * 1000, opts.tends);
    s = { ...r.s, notices: [] };
    fruitLog.push({ t, fruit: r.harvested });
    plotsAt[s.plots.length] ??= t;
  }
  return { state: s, plotsAt, fruitLog };
}

/** First time (seconds) the garden had at least `n` plots, or Infinity. */
export function timeToPlots(r: SimResult, n: number): number {
  const hits = Object.entries(r.plotsAt).filter(([k]) => Number(k) >= n).map(([, t]) => t);
  return hits.length ? Math.min(...hits) : Infinity;
}
