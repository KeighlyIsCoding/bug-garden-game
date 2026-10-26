import { beforeEach, describe, expect, it } from 'vitest';
import { simulate, timeToPlots } from './balance';
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
