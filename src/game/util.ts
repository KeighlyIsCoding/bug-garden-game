import type { Rng } from './gacha';
import { PLANTS, SEED_TIER_WEIGHT } from './plants';
import type { GameState, Notice, Plot } from './types';

let rngFn: Rng = Math.random;
/** Tests can swap in a deterministic RNG. */
export function setRng(fn: Rng) {
  rngFn = fn;
}
export const rng: Rng = () => rngFn();

export function notify(s: GameState, text: string, kind: Notice['kind'] = 'info'): GameState {
  const id = s.noticeSeq + 1;
  return { ...s, noticeSeq: id, notices: [...s.notices.slice(-4), { id, text, kind }] };
}

export function addTo(rec: Record<string, number>, key: string, n: number) {
  const next = { ...rec, [key]: (rec[key] ?? 0) + n };
  if (next[key] <= 0) delete next[key];
  return next;
}

export function updatePlot(s: GameState, id: number, fn: (p: Plot) => Plot): GameState {
  return { ...s, plots: s.plots.map((p) => (p.id === id ? fn(p) : p)) };
}

/** Rounds randomly so fractional amounts pay out correctly on average (2.4 → 2 or 3, 3 with 40% chance). */
export function roundChance(n: number): number {
  const whole = Math.floor(n);
  return whole + (rng() < n - whole ? 1 : 0);
}

export function weightedSeed(exclude: string[] = []): string {
  const options = PLANTS.filter((p) => !exclude.includes(p.id));
  const total = options.reduce((s, p) => s + SEED_TIER_WEIGHT[p.seedTier], 0);
  let r = rng() * total;
  for (const p of options) {
    r -= SEED_TIER_WEIGHT[p.seedTier];
    if (r < 0) return p.id;
  }
  return options[options.length - 1].id;
}
