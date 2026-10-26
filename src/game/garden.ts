import { PLANT_BY_ID, QUALITY_YIELD, SEED_DROP_CHANCE, fruitKey, type Quality } from './plants';
import {
  DIG_COMPOST,
  DRY_GROWTH,
  FERTILIZER_GROWTH,
  FERTILIZER_SECONDS,
  GRID_COLS,
  GRID_ROWS,
  MAX_WEEDS,
  MOISTURE_SECONDS,
  REGROW_FROM,
  TOPDRESS_COMPOST,
  TOPDRESS_VIGOR,
  VIGOR_DECAY,
  VIGOR_FLOOR,
  WEED_INTERVAL,
  WEED_PENALTY,
  WILD_SEED_CHANCE,
  landPrice,
} from './tuning';
import type { GameState, Plant, Plot, Tool } from './types';
import { addTo, notify, rng, roundChance, updatePlot, weightedSeed } from './util';

// ---------- grid ----------
export const cellId = (x: number, y: number) => y * GRID_COLS + x;

/** The order land is sold in: the starting 3×2 bed, then rows 1–2 widened to full width, then whole rows. */
export const EXPANSION_ORDER: { x: number; y: number }[] = (() => {
  const out: { x: number; y: number }[] = [];
  for (let y = 0; y < 2; y++) for (let x = 0; x < 3; x++) out.push({ x, y });
  for (let x = 3; x < GRID_COLS; x++) for (let y = 0; y < 2; y++) out.push({ x, y });
  for (let y = 2; y < GRID_ROWS; y++) for (let x = 0; x < GRID_COLS; x++) out.push({ x, y });
  return out;
})();

/** The next cell for sale, or null once the garden is full. */
export function nextLand(plots: Plot[]): { x: number; y: number } | null {
  const owned = new Set(plots.map((p) => p.id));
  return EXPANSION_ORDER.find((c) => !owned.has(cellId(c.x, c.y))) ?? null;
}

export function newPlot(x: number, y: number, weeds = 0): Plot {
  return { id: cellId(x, y), x, y, moisture: 0, weeds, plant: null };
}

export function newPlant(kind: string): Plant {
  return { kind, growth: 0, vigor: 1, harvests: 0, careGood: 0, careTotal: 0, fertilizedUntil: 0, fertilizedThisCycle: false };
}

// ---------- plant state ----------
export function isRipe(p: Plant) {
  return p.growth >= 1;
}

export function careRatio(p: Plant) {
  return p.careTotal > 0 ? p.careGood / p.careTotal : 1;
}

export function qualityFor(p: Plant): Quality {
  const care = careRatio(p);
  if (care >= 0.9 && p.fertilizedThisCycle) return 'perfect';
  if (care >= 0.6) return 'fine';
  return 'normal';
}

/** Expected fruit from the next harvest, before random rounding. */
export function expectedYield(p: Plant): number {
  return QUALITY_YIELD[qualityFor(p)] * p.vigor;
}

export function growthRate(plot: Plot, now: number): number {
  const p = plot.plant;
  if (!p || isRipe(p)) return 0;
  const def = PLANT_BY_ID[p.kind];
  const water = plot.moisture > 0 ? 1 : DRY_GROWTH;
  const weeds = 1 - WEED_PENALTY * plot.weeds;
  const fert = p.fertilizedUntil > now ? FERTILIZER_GROWTH : 1;
  return (1 / def.growTime) * water * weeds * fert;
}

export function stageOf(p: Plant): 'seed' | 'sprout' | 'flowering' | 'ripe' {
  if (p.growth >= 1) return 'ripe';
  if (p.growth >= 0.6) return 'flowering';
  if (p.growth >= 0.25) return 'sprout';
  return 'seed';
}

// ---------- simulation ----------
export function stepPlots(plots: Plot[], dt: number, now: number): Plot[] {
  return plots.map((plot) => {
    let { moisture, weeds } = plot;
    if (weeds < MAX_WEEDS && rng() < dt / WEED_INTERVAL) weeds += 1;
    let plant = plot.plant;
    if (plant && !isRipe(plant)) {
      const rate = growthRate({ ...plot, weeds }, now);
      const good = moisture > 0 && weeds === 0;
      plant = {
        ...plant,
        growth: Math.min(1, plant.growth + rate * dt),
        careTotal: plant.careTotal + dt,
        careGood: plant.careGood + (good ? dt : 0),
      };
    }
    moisture = Math.max(0, moisture - dt / MOISTURE_SECONDS);
    return { ...plot, moisture, weeds, plant };
  });
}

// ---------- actions ----------
export function harvest(s: GameState, plot: Plot): GameState {
  const plant = plot.plant!;
  const def = PLANT_BY_ID[plant.kind];
  const quality = qualityFor(plant);
  const amount = Math.max(1, roundChance(expectedYield(plant)));
  let next: GameState = { ...s, fruits: addTo(s.fruits, fruitKey(def.id, quality), amount) };
  const name = amount === 1 ? def.fruitName : def.fruitPlural;
  let msg = `Harvested ${amount} ${quality === 'normal' ? '' : quality + ' '}${name.toLowerCase()}`;
  if (rng() < SEED_DROP_CHANCE[def.seedTier]) {
    next = { ...next, seeds: addTo(next.seeds, def.id, 1) };
    msg += ' and a seed';
  }
  // Perennial: back to flowering to grow the next crop, a little more tired than before.
  const regrown: Plant = {
    ...plant,
    growth: REGROW_FROM,
    vigor: Math.max(VIGOR_FLOOR, plant.vigor - VIGOR_DECAY),
    harvests: plant.harvests + 1,
    careGood: 0,
    careTotal: 0,
    fertilizedThisCycle: false,
  };
  next = updatePlot(next, plot.id, (p) => ({ ...p, plant: regrown }));
  return notify(next, msg + '!', 'good');
}

/** Weeds are pulled by hand (drag on a weed in the garden), not with a tool. */
export function pullWeed(s: GameState, plotId: number): GameState {
  const plot = s.plots.find((p) => p.id === plotId);
  if (!plot || plot.weeds === 0) return s;
  let next = updatePlot(s, plotId, (p) => ({ ...p, weeds: p.weeds - 1 }));
  next = { ...next, compost: next.compost + 1 };
  if (rng() < WILD_SEED_CHANCE) {
    const found = weightedSeed();
    next = { ...next, seeds: addTo(next.seeds, found, 1) };
    next = notify(next, `You found a ${PLANT_BY_ID[found].fruitName.toLowerCase()} seed in the soil!`, 'good');
  }
  return next;
}

export function digUp(s: GameState, plotId: number): GameState {
  const plant = s.plots.find((p) => p.id === plotId)?.plant;
  if (!plant) return notify(s, 'Nothing is planted here.', 'info');
  const next = updatePlot(s, plotId, (p) => ({ ...p, plant: null }));
  return notify(
    { ...next, compost: next.compost + DIG_COMPOST },
    `Dug up the ${PLANT_BY_ID[plant.kind].plantName.toLowerCase()} (+${DIG_COMPOST} compost).`,
    'info',
  );
}

export function topDress(s: GameState, plotId: number): GameState {
  const plant = s.plots.find((p) => p.id === plotId)?.plant;
  if (!plant) return notify(s, 'Plant something before top-dressing.', 'warn');
  if (plant.vigor >= 1) return notify(s, 'This plant is already at full vigor.', 'info');
  if (s.compost < TOPDRESS_COMPOST) return notify(s, `Top-dressing needs ${TOPDRESS_COMPOST} compost.`, 'warn');
  const next = updatePlot(s, plotId, (p) => ({ ...p, plant: { ...plant, vigor: Math.min(1, plant.vigor + TOPDRESS_VIGOR) } }));
  return { ...next, compost: next.compost - TOPDRESS_COMPOST };
}

export function buyLand(s: GameState): GameState {
  const cell = nextLand(s.plots);
  if (!cell) return notify(s, 'Your garden is as big as it gets!', 'info');
  const price = landPrice(s.plots.length);
  if (s.coins < price) return notify(s, 'Not enough coins.', 'warn');
  const plots = [...s.plots, newPlot(cell.x, cell.y, 1)].sort((a, b) => a.id - b.id);
  return notify({ ...s, coins: s.coins - price, plots }, 'A new plot is ready for digging.', 'good');
}

export function useTool(s: GameState, plotId: number, tool: Tool, seed: string | null | undefined, now: number): GameState {
  const plot = s.plots.find((p) => p.id === plotId);
  if (!plot) return s;
  const plant = plot.plant;

  if (tool === 'tend') {
    if (plant && isRipe(plant)) tool = 'harvest';
    else if (!plant && seed) tool = 'plant';
    else if (!plant) return notify(s, 'Pick a seed from your pouch to plant here.', 'info');
    else tool = 'water';
  }

  switch (tool) {
    case 'water':
      return updatePlot(s, plotId, (p) => ({ ...p, moisture: 1 }));
    case 'fertilize': {
      if (!plant) return notify(s, 'Plant something before fertilizing.', 'warn');
      if (isRipe(plant)) return notify(s, 'This plant is ready to harvest.', 'info');
      if (s.fertilizer <= 0) return notify(s, 'Out of fertilizer. Make some from compost or buy it at the market.', 'warn');
      const next = updatePlot(s, plotId, (p) => ({
        ...p,
        plant: { ...p.plant!, fertilizedUntil: now + FERTILIZER_SECONDS * 1000, fertilizedThisCycle: true },
      }));
      return { ...next, fertilizer: next.fertilizer - 1 };
    }
    case 'harvest':
      if (!plant || !isRipe(plant)) return notify(s, 'Nothing ripe here yet.', 'info');
      return harvest(s, plot);
    case 'plant': {
      if (plant) return notify(s, 'This plot is already planted.', 'info');
      if (!seed || !(s.seeds[seed] > 0)) return notify(s, 'Choose a seed from your pouch first.', 'warn');
      if (plot.weeds > 0) return notify(s, 'Pull the weeds before planting.', 'warn');
      const next = updatePlot(s, plotId, (p) => ({ ...p, plant: newPlant(seed) }));
      return { ...next, seeds: addTo(next.seeds, seed, -1) };
    }
  }
}
