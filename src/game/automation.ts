import { countFruit, harvest, isRipe, sellPrice } from './garden';
import type { Modifiers } from './modifiers';
import { TUMBLER_RESERVE } from './tuning';
import type { GameState } from './types';
import { addTo, earn } from './util';

/** Pump: waters every irrigated row on its schedule. (Round-the-clock irrigation is handled in stepPlots.) */
function runPump(s: GameState, t: number, m: Modifiers): GameState {
  if (!m.pumpInterval || s.irrigatedRows.length === 0 || t - s.irrigatedAt < m.pumpInterval * 1000) return s;
  const rows = new Set(s.irrigatedRows);
  return { ...s, irrigatedAt: t, plots: s.plots.map((p) => (rows.has(p.y) ? { ...p, moisture: 1 } : p)) };
}

/** Wheelbarrow: goes round picking ripe plants into the barrow, until the barrow is full. */
function runBarrow(s: GameState, t: number, m: Modifiers): GameState {
  if (m.barrowCapacity === 0 || t - s.barrowAt < m.barrowInterval * 1000) return s;
  let next: GameState = { ...s, barrowAt: t };
  for (const plot of s.plots) {
    if (countFruit(next.barrow) >= m.barrowCapacity) break;
    if (plot.plant && isRipe(plot.plant)) next = harvest(next, next.plots.find((p) => p.id === plot.id)!, 'barrow', m);
  }
  return next;
}

/** Fruit stand: sells the chosen qualities from the basket, biggest stack first. */
function runStand(s: GameState, dt: number, m: Modifiers): GameState {
  if (m.standRate === 0 || s.stand.qualities.length === 0) return s;
  let carry = s.stand.carry + m.standRate * dt;
  let fruits = s.fruits;
  let coins = 0;
  while (carry >= 1) {
    const key = Object.keys(fruits)
      .filter((k) => s.stand.qualities.some((q) => k.endsWith(':' + q)))
      .sort((a, b) => fruits[b] - fruits[a])[0];
    if (!key) {
      carry = Math.min(carry, 1);
      break;
    }
    fruits = addTo(fruits, key, -1);
    coins += sellPrice(key, m);
    carry -= 1;
  }
  return earn({ ...s, fruits, stand: { ...s.stand, carry } }, coins);
}

/** Compost tumbler (level 2): keeps a reserve for top-dressing and turns the rest into fertilizer. */
function runTumbler(s: GameState, m: Modifiers): GameState {
  if (!m.autoTumble || s.compost < TUMBLER_RESERVE + m.compostPerFertilizer) return s;
  const n = Math.floor((s.compost - TUMBLER_RESERVE) / m.compostPerFertilizer);
  return { ...s, compost: s.compost - n * m.compostPerFertilizer, fertilizer: s.fertilizer + n };
}

/** Beetle patrol: every round, one weed less on every plot. */
function runPatrol(s: GameState, t: number, m: Modifiers): GameState {
  if (t - s.patrolAt < m.patrolInterval * 1000) return s;
  return { ...s, patrolAt: t, plots: s.plots.map((p) => (p.weeds > 0 ? { ...p, weeds: p.weeds - 1 } : p)) };
}

export function runAutomation(s: GameState, t: number, dt: number, m: Modifiers): GameState {
  return runPatrol(runTumbler(runStand(runBarrow(runPump(s, t, m), t, m), dt, m), m), t, m);
}
