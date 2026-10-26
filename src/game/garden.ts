import { modifiers, type Modifiers } from './modifiers';
import { FRUIT_SELL_PRICE, PLANT_BY_ID, QUALITIES, QUALITY_SELL_MULT, QUALITY_YIELD, SEED_DROP_CHANCE, fruitKey, parseFruitKey, type Quality } from './plants';
import {
  CUT_SECONDS,
  CUT_WEED_SPEED,
  DIG_COMPOST,
  HERBICIDE_SECONDS,
  HERBICIDE_WEED_SLOWDOWN,
  DRY_GROWTH,
  FERTILIZER_GROWTH,
  FERTILIZER_SECONDS,
  GRID_COLS,
  GRID_ROWS,
  MAX_WEEDS,
  MOISTURE_SECONDS,
  REGROW_FROM,
  SOAK_GROWTH,
  SOAK_SECONDS,
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

/** Modifiers with no upgrades or bonuses, for callers (and tests) that don't pass their own. */
const BASE: Modifiers = modifiers({ upgrades: {} });
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

/**
 * The cells a `size`×`size` tool covers when used on (x, y). Odd sizes centre on the plot; even sizes
 * put it at the top-left of the middle. The square is shifted (not cropped) to stay inside the grid.
 */
export function areaCells(x: number, y: number, size: number): number[] {
  const n = Math.min(size, GRID_COLS, GRID_ROWS);
  const back = Math.floor((n - 1) / 2);
  const x0 = Math.max(0, Math.min(GRID_COLS - n, x - back));
  const y0 = Math.max(0, Math.min(GRID_ROWS - n, y - back));
  const out: number[] = [];
  for (let dy = 0; dy < n; dy++) for (let dx = 0; dx < n; dx++) out.push(cellId(x0 + dx, y0 + dy));
  return out;
}

/** The next cell for sale, or null once the garden is full. */
export function nextLand(plots: Plot[]): { x: number; y: number } | null {
  const owned = new Set(plots.map((p) => p.id));
  return EXPANSION_ORDER.find((c) => !owned.has(cellId(c.x, c.y))) ?? null;
}

export function newPlot(x: number, y: number, weeds = 0): Plot {
  return { id: cellId(x, y), x, y, moisture: 0, soakedUntil: 0, cutUntil: 0, herbicideUntil: 0, weeds, plant: null };
}

export function newPlant(kind: string): Plant {
  return {
    kind,
    growth: 0,
    vigor: 1,
    harvests: 0,
    careGood: 0,
    careTotal: 0,
    fertilizedUntil: 0,
    fertilizedThisCycle: false,
    soakedThisCycle: false,
    herbicideThisCycle: false,
  };
}

// ---------- plant state ----------
export function isRipe(p: Plant) {
  return p.growth >= 1;
}

export function careRatio(p: Plant) {
  return p.careTotal > 0 ? p.careGood / p.careTotal : 1;
}

/** Quality from care alone, up to the best tier you've unlocked. */
function careQuality(p: Plant, cap: Quality): Quality {
  const care = careRatio(p);
  const allowed = (q: Quality) => QUALITIES.indexOf(q) <= QUALITIES.indexOf(cap);
  const fert = p.fertilizedThisCycle;
  if (allowed('heirloom') && care >= 0.98 && fert && p.soakedThisCycle && p.vigor >= 0.8) return 'heirloom';
  if (allowed('prize') && care >= 0.95 && fert && p.soakedThisCycle) return 'prize';
  if (care >= 0.9 && fert) return 'perfect';
  if (care >= 0.6) return 'fine';
  return 'normal';
}

/** The quality the next harvest will be. Herbicide this cycle costs one tier. */
export function qualityFor(p: Plant, cap: Quality = 'perfect'): Quality {
  const q = careQuality(p, cap);
  return p.herbicideThisCycle ? QUALITIES[Math.max(0, QUALITIES.indexOf(q) - 1)] : q;
}

/** Expected fruit from the next harvest, before random rounding. */
export function expectedYield(p: Plant, m: Pick<Modifiers, 'qualityCap' | 'yieldMult'> = BASE): number {
  // Herbicide on a Normal crop can't drop a tier, so it halves the crop instead.
  const sprayedNormal = p.herbicideThisCycle && careQuality(p, m.qualityCap) === 'normal';
  return QUALITY_YIELD[qualityFor(p, m.qualityCap)] * p.vigor * (sprayedNormal ? 0.5 : 1) * m.yieldMult;
}

export function growthRate(plot: Plot, now: number, m: Pick<Modifiers, 'growthMult'> = BASE): number {
  const p = plot.plant;
  if (!p || isRipe(p)) return 0;
  const def = PLANT_BY_ID[p.kind];
  const water = plot.moisture > 0 ? 1 : DRY_GROWTH;
  const weeds = 1 - WEED_PENALTY * plot.weeds;
  const fert = p.fertilizedUntil > now ? FERTILIZER_GROWTH : 1;
  const soak = plot.moisture > 0 && plot.soakedUntil > now ? SOAK_GROWTH : 1;
  return (1 / def.growTime) * water * weeds * fert * soak * m.growthMult;
}

export function stageOf(p: Plant): 'seed' | 'sprout' | 'flowering' | 'ripe' {
  if (p.growth >= 1) return 'ripe';
  if (p.growth >= 0.6) return 'flowering';
  if (p.growth >= 0.25) return 'sprout';
  return 'seed';
}

// ---------- simulation ----------
/** `alwaysWet` rows are on round-the-clock irrigation and never dry out. */
export function stepPlots(plots: Plot[], dt: number, now: number, alwaysWet?: Set<number>, m: Modifiers = BASE): Plot[] {
  return plots.map((plot) => {
    let { moisture, weeds } = plot;
    const interval =
      (WEED_INTERVAL * m.weedIntervalMult * (plot.herbicideUntil > now ? HERBICIDE_WEED_SLOWDOWN : 1)) /
      (plot.cutUntil > now ? CUT_WEED_SPEED : 1);
    if (weeds < MAX_WEEDS && rng() < dt / interval) weeds += 1;
    let plant = plot.plant;
    if (plant && !isRipe(plant)) {
      const rate = growthRate({ ...plot, weeds }, now, m);
      const good = moisture > 0 && weeds === 0;
      plant = {
        ...plant,
        growth: Math.min(1, plant.growth + rate * dt),
        careTotal: plant.careTotal + dt,
        careGood: plant.careGood + (good ? dt : 0),
      };
    }
    moisture = alwaysWet?.has(plot.y) ? 1 : Math.max(0, moisture - dt / (MOISTURE_SECONDS * m.moistureMult));
    return { ...plot, moisture, weeds, plant };
  });
}

// ---------- actions ----------
/** Pick a ripe plant. Fruit goes to the basket, or into the wheelbarrow (quietly) when it is the barrow's round. */
export function harvest(s: GameState, plot: Plot, into: 'basket' | 'barrow' = 'basket', m: Modifiers = BASE): GameState {
  const plant = plot.plant!;
  const def = PLANT_BY_ID[plant.kind];
  const quality = qualityFor(plant, m.qualityCap);
  const amount = roundChance(expectedYield(plant, m));
  const key = fruitKey(def.id, quality);
  let next: GameState =
    into === 'barrow' ? { ...s, barrow: addTo(s.barrow, key, amount) } : { ...s, fruits: addTo(s.fruits, key, amount) };
  next = {
    ...next,
    stats: {
      ...next.stats,
      fruitHarvested: next.stats.fruitHarvested + amount,
      heirlooms: next.stats.heirlooms + (quality === 'heirloom' ? amount : 0),
    },
  };
  const name = amount === 1 ? def.fruitName : def.fruitPlural;
  let msg =
    amount === 0
      ? `The ${def.plantName.toLowerCase()} gave nothing worth picking this time`
      : `Harvested ${amount} ${quality === 'normal' ? '' : quality + ' '}${name.toLowerCase()}`;
  if (rng() < SEED_DROP_CHANCE[def.seedTier] * m.seedDropMult) {
    next = { ...next, seeds: addTo(next.seeds, def.id, 1) };
    msg += ' and a seed';
  }
  // Perennial: back to flowering to grow the next crop, a little more tired than before.
  const regrown: Plant = {
    ...plant,
    growth: REGROW_FROM,
    vigor: Math.max(VIGOR_FLOOR, plant.vigor - VIGOR_DECAY * m.vigorDecayMult),
    harvests: plant.harvests + 1,
    careGood: 0,
    careTotal: 0,
    fertilizedThisCycle: false,
    soakedThisCycle: false,
    herbicideThisCycle: false,
  };
  next = updatePlot(next, plot.id, (p) => ({ ...p, plant: regrown }));
  return into === 'barrow' ? next : notify(next, msg + '!', 'good');
}

/** Coins for selling one fruit. */
export function sellPrice(key: string, m: Pick<Modifiers, 'sellMult'>): number {
  const parsed = parseFruitKey(key);
  if (!parsed) return 0;
  return FRUIT_SELL_PRICE[parsed.plant.seedTier] * QUALITY_SELL_MULT[parsed.quality] * m.sellMult;
}

export const countFruit = (rec: Record<string, number>) => Object.values(rec).reduce((a, b) => a + b, 0);

/** Roughly what the garden earns per second if every crop is sold: used for the butterfly's purse. */
export function incomeEstimate(s: GameState, m: Modifiers): number {
  let perSecond = 0;
  for (const plot of s.plots) {
    const p = plot.plant;
    if (!p) continue;
    const def = PLANT_BY_ID[p.kind];
    const cropSeconds = (def.growTime * (1 - REGROW_FROM)) / m.growthMult;
    perSecond += (expectedYield(p, m) * sellPrice(fruitKey(def.id, qualityFor(p, m.qualityCap)), m)) / cropSeconds;
  }
  return perSecond;
}

/** Pulled weeds become compost, and now and then a seed turns up in the soil. */
function compostWeeds(s: GameState, n: number, m: Pick<Modifiers, 'compostBonus'>): GameState {
  let next = {
    ...s,
    compost: s.compost + n + roundChance(n * m.compostBonus),
    stats: { ...s.stats, weedsPulled: s.stats.weedsPulled + n },
  };
  for (let i = 0; i < n; i++) {
    if (rng() >= WILD_SEED_CHANCE) continue;
    const found = weightedSeed();
    next = { ...next, seeds: addTo(next.seeds, found, 1) };
    next = notify(next, `You found a ${PLANT_BY_ID[found].fruitName.toLowerCase()} seed in the soil!`, 'good');
  }
  return next;
}

/** Weeds are pulled by hand (drag on a weed in the garden), not with a tool. */
export function pullWeed(s: GameState, plotId: number, m: Modifiers = BASE): GameState {
  const plot = s.plots.find((p) => p.id === plotId);
  if (!plot || plot.weeds === 0) return s;
  return compostWeeds(updatePlot(s, plotId, (p) => ({ ...p, weeds: p.weeds - 1 })), 1, m);
}

/** The glove pulls every weed in the given plots at once. */
export function pullWeeds(s: GameState, plotIds: number[], m: Modifiers = BASE): GameState {
  const ids = new Set(plotIds);
  const n = s.plots.filter((p) => ids.has(p.id)).reduce((a, p) => a + p.weeds, 0);
  if (n === 0) return s;
  return compostWeeds({ ...s, plots: s.plots.map((p) => (ids.has(p.id) ? { ...p, weeds: 0 } : p)) }, n, m);
}

export function digUp(s: GameState, plotId: number, seedChance = 0): GameState {
  const plant = s.plots.find((p) => p.id === plotId)?.plant;
  if (!plant) return notify(s, 'Nothing is planted here.', 'info');
  let next = updatePlot(s, plotId, (p) => ({ ...p, plant: null }));
  next = { ...next, compost: next.compost + DIG_COMPOST };
  const seedBack = rng() < seedChance;
  if (seedBack) next = { ...next, seeds: addTo(next.seeds, plant.kind, 1) };
  return notify(
    next,
    `Dug up the ${PLANT_BY_ID[plant.kind].plantName.toLowerCase()} (+${DIG_COMPOST} compost${seedBack ? ' and its seed' : ''}).`,
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

export function useTool(
  s: GameState,
  plotId: number,
  tool: Tool,
  seed: string | null | undefined,
  now: number,
  m: Modifiers,
): GameState {
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
    case 'water': {
      // Hand-watering soaks every plot the can reaches.
      const cells = new Set(areaCells(plot.x, plot.y, m.waterReach));
      const until = now + SOAK_SECONDS * 1000;
      return {
        ...s,
        plots: s.plots.map((p) =>
          cells.has(p.id)
            ? { ...p, moisture: 1, soakedUntil: until, plant: p.plant && { ...p.plant, soakedThisCycle: true } }
            : p,
        ),
      };
    }
    case 'clip': {
      if (m.clipReach === 0) return notify(s, 'Buy clippers in the Shed first.', 'info');
      const cells = new Set(areaCells(plot.x, plot.y, m.clipReach));
      if (!s.plots.some((p) => cells.has(p.id) && p.weeds > 0)) return notify(s, 'No weeds to clip here.', 'info');
      const until = now + CUT_SECONDS * 1000;
      return { ...s, plots: s.plots.map((p) => (cells.has(p.id) && p.weeds > 0 ? { ...p, weeds: 0, cutUntil: until } : p)) };
    }
    case 'spray': {
      if (!m.canSpray) return notify(s, 'Buy the herbicide sprayer in the Shed first.', 'info');
      if (s.herbicide <= 0) return notify(s, 'Out of herbicide. Buy more at the market.', 'warn');
      const next = updatePlot(s, plotId, (p) => ({
        ...p,
        weeds: 0,
        herbicideUntil: now + HERBICIDE_SECONDS * 1000,
        plant: p.plant && { ...p.plant, herbicideThisCycle: true },
      }));
      return { ...next, herbicide: next.herbicide - 1 };
    }
    case 'fertilize': {
      if (!plant) return notify(s, 'Plant something before fertilizing.', 'warn');
      if (isRipe(plant)) return notify(s, 'This plant is ready to harvest.', 'info');
      if (s.fertilizer <= 0) return notify(s, 'Out of fertilizer. Make some from compost or buy it at the market.', 'warn');
      const next = updatePlot(s, plotId, (p) => ({
        ...p,
        plant: { ...p.plant!, fertilizedUntil: now + FERTILIZER_SECONDS * m.fertilizerMult * 1000, fertilizedThisCycle: true },
      }));
      return { ...next, fertilizer: next.fertilizer - 1 };
    }
    case 'harvest': {
      const cells = new Set(areaCells(plot.x, plot.y, m.harvestReach));
      const ripe = s.plots.filter((p) => cells.has(p.id) && p.plant && isRipe(p.plant));
      if (ripe.length === 0) return notify(s, m.harvestReach > 1 ? 'Nothing ripe in reach yet.' : 'Nothing ripe here yet.', 'info');
      let next = s;
      for (const p of ripe) next = harvest(next, next.plots.find((q) => q.id === p.id)!, 'basket', m);
      return next;
    }
    case 'plant': {
      if (plant) return notify(s, 'This plot is already planted.', 'info');
      if (!seed || !(s.seeds[seed] > 0)) return notify(s, 'Choose a seed from your pouch first.', 'warn');
      if (plot.weeds > 0) return notify(s, 'Pull the weeds before planting.', 'warn');
      const next = updatePlot(s, plotId, (p) => ({ ...p, plant: newPlant(seed) }));
      return { ...next, seeds: addTo(next.seeds, seed, -1) };
    }
  }
}
