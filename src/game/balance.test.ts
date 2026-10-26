import { beforeEach, describe, expect, it } from 'vitest';
import { fruitBetween, lateGame, simulate, simulateSeasons, timeToPlots } from './balance';
import { setRng } from './state';

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}
beforeEach(() => setRng(seeded(1)));

const HOUR = 3600;
const fruitRate = (log: { t: number; fruit: number }[], from: number, to: number) =>
  log.filter((f) => f.t > from && f.t <= to).reduce((a, b) => a + b.fruit, 0) / (to - from);

/**
 * Pacing guardrails. The bot checks in every 5 seconds and plays well, so these are the
 * fastest a player could reasonably go. If a tuning change breaks one, rethink the change.
 */
describe('balance: active player', () => {
  const run = () => simulate({ every: 5, duration: HOUR, tends: true });

  it('buys the first new plot within a couple of minutes', () => {
    expect(timeToPlots(run(), 7)).toBeLessThan(3 * 60);
  });

  it('reaches 12 plots in minutes, not seconds', () => {
    const t = timeToPlots(run(), 12);
    expect(t).toBeGreaterThan(4 * 60);
    expect(t).toBeLessThan(25 * 60);
  });

  it('keeps the Bugdex a long-term goal', () => {
    const species = Object.keys(run().state.collection).length;
    expect(species).toBeGreaterThan(40);
    expect(species).toBeLessThan(150);
  });
});

describe('balance: care matters', () => {
  it('a neglected garden produces a small fraction of a tended one', () => {
    const tended = simulate({ every: 5, duration: HOUR / 2, tends: true });
    setRng(seeded(1));
    const neglected = simulate({ every: 5, duration: HOUR / 2, tends: false });
    // Compare the same plot count: output per plot over the last 10 minutes.
    const perPlot = (r: ReturnType<typeof simulate>) => fruitRate(r.fruitLog, HOUR / 2 - 600, HOUR / 2) / r.state.plots.length;
    expect(perPlot(neglected)).toBeLessThan(perPlot(tended) * 0.35);
  });
});

describe('balance: automation vs care', () => {
  /**
   * The idle payoff. A fully automated late garden (no hand care, a check-in every 10 minutes to tip
   * the barrow) should settle at 30–60% of a perfectly tended one: automation clearly pays, and care
   * (weeding, soaking, fertilizer, Prize/Heirloom) still more than doubles the harvest.
   */
  it('a fully automated garden makes 30–60% of a perfectly tended one', () => {
    setRng(seeded(3));
    const tended = fruitBetween({ every: 5, tends: true }, lateGame(), HOUR / 2, HOUR);
    setRng(seeded(3));
    const automated = fruitBetween({ every: 600, tends: false }, lateGame(), HOUR / 2, HOUR);
    const ratio = automated / tended;
    expect(ratio).toBeGreaterThan(0.3);
    expect(ratio).toBeLessThan(0.6);
  });
});

describe('balance: seasons', () => {
  /**
   * The long game. A strong player resets when a season would double their Golden Seeds; each season
   * should reach further than the last, and the full 48-plot garden should take most of a (long) day.
   */
  it('reaches the full garden over several seasons, in 8–18 hours', () => {
    const r = simulateSeasons({ every: 5, duration: 18 * HOUR, tends: true });
    expect(r.firstFullGarden).toBeGreaterThan(8 * HOUR);
    expect(r.firstFullGarden).toBeLessThan(18 * HOUR);
    expect(r.seasons.length).toBeGreaterThanOrEqual(3);
    const gains = r.seasons.map((x) => x.gained);
    expect(gains[gains.length - 1]).toBeGreaterThan(gains[0]);
  }, 120_000);
});
