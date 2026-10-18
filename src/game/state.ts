import { BUG_BY_ID, tierOf, type Tier } from './bugs';
import { PITY_LIMIT, PITY_TIER, summon, type Rng } from './gacha';
import {
  FRUIT_SELL_PRICE,
  PLANTS,
  PLANT_BY_ID,
  SEED_DROP_CHANCE,
  SEED_PRICE,
  SEED_TIER_WEIGHT,
  fruitKey,
  parseFruitKey,
  type Quality,
} from './plants';

// ---------- tuning ----------
export const MOISTURE_SECONDS = 70;
export const WEED_INTERVAL = 80;
export const MAX_WEEDS = 3;
export const FERTILIZER_SECONDS = 90;
export const FERTILIZER_PRICE = 8;
export const COMPOST_PER_FERTILIZER = 3;
export const WILD_SEED_CHANCE = 0.08;
export const START_PLOTS = 6;
export const MAX_PLOTS = 16;
export const SHOP_SLOTS = 4;
export const SHOP_REFRESH_MS = 3 * 60 * 1000;
export const SHOP_REFRESH_PRICE = 5;
export const MAX_OFFLINE_SECONDS = 2 * 60 * 60;
export const NEW_BUG_COINS = [5, 10, 20, 40, 80, 150];
export const RELEASE_COINS = [2, 4, 8, 16, 32, 60];
export const STAPLE_SEEDS = ['apple', 'strawberry'];

export const plotPrice = (plotCount: number) => 40 + 20 * (plotCount - START_PLOTS);

// ---------- types ----------
export interface Plant {
  kind: string;
  /** 0..1, ripe at 1 */
  growth: number;
  harvestsLeft: number;
  careGood: number;
  careTotal: number;
  fertilizedUntil: number;
  fertilizedThisCycle: boolean;
}

export interface Plot {
  id: number;
  moisture: number;
  weeds: number;
  plant: Plant | null;
}

export interface ShopSlot {
  plantId: string;
  stock: number;
}

export interface Notice {
  id: number;
  text: string;
  kind: 'good' | 'info' | 'warn';
}

export interface LastSummon {
  seq: number;
  bugId: string;
  tier: Tier;
  isNew: boolean;
  coins: number;
  fruitKey: string;
  pityTriggered: boolean;
}

export interface GameState {
  version: number;
  lastTick: number;
  coins: number;
  fertilizer: number;
  compost: number;
  seeds: Record<string, number>;
  fruits: Record<string, number>;
  plots: Plot[];
  collection: Record<string, { count: number; firstAt: number }>;
  pity: number;
  totalSummons: number;
  shop: { slots: ShopSlot[]; refreshedAt: number };
  // transient (not saved)
  notices: Notice[];
  noticeSeq: number;
  lastSummon: LastSummon | null;
}

export const SAVE_VERSION = 1;
export const SAVE_KEY = 'bug-garden-save-v1';

export type Tool = 'tend' | 'water' | 'weed' | 'fertilize' | 'harvest' | 'plant';

export type Action =
  | { type: 'tick'; now: number }
  | { type: 'use'; plotId: number; tool: Tool; seed?: string | null; now: number }
  | { type: 'waterAll' }
  | { type: 'harvestAll'; now: number }
  | { type: 'summon'; fruitKey: string; now: number }
  | { type: 'release'; bugId: string; count: number }
  | { type: 'releaseAllDuplicates' }
  | { type: 'buySlot'; index: number }
  | { type: 'buySeed'; plantId: string }
  | { type: 'buyFertilizer' }
  | { type: 'buyPlot' }
  | { type: 'refreshShop'; now: number }
  | { type: 'sellFruit'; key: string; count: number }
  | { type: 'makeFertilizer' }
  | { type: 'dismissNotice'; id: number }
  | { type: 'reset'; now: number };

// ---------- helpers ----------
let rng: Rng = Math.random;
/** Tests can swap in a deterministic RNG. */
export function setRng(fn: Rng) {
  rng = fn;
}

function weightedSeed(exclude: string[] = []): string {
  const options = PLANTS.filter((p) => !exclude.includes(p.id));
  const total = options.reduce((s, p) => s + SEED_TIER_WEIGHT[p.seedTier], 0);
  let r = rng() * total;
  for (const p of options) {
    r -= SEED_TIER_WEIGHT[p.seedTier];
    if (r < 0) return p.id;
  }
  return options[options.length - 1].id;
}

export function rollShop(): ShopSlot[] {
  const slots: ShopSlot[] = [];
  const used: string[] = [...STAPLE_SEEDS];
  for (let i = 0; i < SHOP_SLOTS; i++) {
    const id = weightedSeed(used);
    used.push(id);
    const tier = PLANT_BY_ID[id].seedTier;
    slots.push({ plantId: id, stock: tier === 2 ? 1 : tier === 1 ? 2 : 3 });
  }
  return slots;
}

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

export function growthRate(plot: Plot, now: number): number {
  const p = plot.plant;
  if (!p || isRipe(p)) return 0;
  const def = PLANT_BY_ID[p.kind];
  const water = plot.moisture > 0 ? 1 : 0.15;
  const weeds = 1 - 0.25 * plot.weeds;
  const fert = p.fertilizedUntil > now ? 1.7 : 1;
  return (1 / def.growTime) * water * weeds * fert;
}

export function stageOf(p: Plant): 'seed' | 'sprout' | 'flowering' | 'ripe' {
  if (p.growth >= 1) return 'ripe';
  if (p.growth >= 0.6) return 'flowering';
  if (p.growth >= 0.25) return 'sprout';
  return 'seed';
}

function notify(s: GameState, text: string, kind: Notice['kind'] = 'info'): GameState {
  const id = s.noticeSeq + 1;
  return { ...s, noticeSeq: id, notices: [...s.notices.slice(-4), { id, text, kind }] };
}

function addTo(rec: Record<string, number>, key: string, n: number) {
  const next = { ...rec, [key]: (rec[key] ?? 0) + n };
  if (next[key] <= 0) delete next[key];
  return next;
}

// ---------- initial state ----------
export function newGame(now: number): GameState {
  const plots: Plot[] = Array.from({ length: START_PLOTS }, (_, id) => ({
    id,
    moisture: 0,
    weeds: id === 1 || id === 4 ? 1 : 0,
    plant: null,
  }));
  return {
    version: SAVE_VERSION,
    lastTick: now,
    coins: 30,
    fertilizer: 2,
    compost: 0,
    seeds: { apple: 3, strawberry: 3, raspberry: 2 },
    fruits: { [fruitKey('apple', 'normal')]: 2 },
    plots,
    collection: {},
    pity: 0,
    totalSummons: 0,
    shop: { slots: rollShop(), refreshedAt: now },
    notices: [],
    noticeSeq: 0,
    lastSummon: null,
  };
}

// ---------- simulation ----------
function stepPlots(plots: Plot[], dt: number, now: number): Plot[] {
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

export function advance(s: GameState, now: number): GameState {
  let elapsed = Math.min((now - s.lastTick) / 1000, MAX_OFFLINE_SECONDS);
  if (elapsed <= 0) return s;
  let plots = s.plots;
  let t = s.lastTick;
  while (elapsed > 0) {
    const dt = Math.min(1, elapsed);
    t += dt * 1000;
    plots = stepPlots(plots, dt, t);
    elapsed -= dt;
  }
  let next: GameState = { ...s, plots, lastTick: now };
  if (now - s.shop.refreshedAt >= SHOP_REFRESH_MS) {
    next = { ...next, shop: { slots: rollShop(), refreshedAt: now } };
  }
  return next;
}

// ---------- garden actions ----------
function updatePlot(s: GameState, id: number, fn: (p: Plot) => Plot): GameState {
  return { ...s, plots: s.plots.map((p) => (p.id === id ? fn(p) : p)) };
}

function harvest(s: GameState, plot: Plot): GameState {
  const plant = plot.plant!;
  const def = PLANT_BY_ID[plant.kind];
  const quality = qualityFor(plant);
  const amount = 2 + (rng() < 0.5 ? 1 : 0) + (plant.fertilizedThisCycle ? 1 : 0);
  let next: GameState = { ...s, fruits: addTo(s.fruits, fruitKey(def.id, quality), amount) };
  let msg = `Harvested ${amount} ${quality === 'normal' ? '' : quality + ' '}${def.fruitPlural.toLowerCase()}`;
  if (rng() < SEED_DROP_CHANCE[def.seedTier]) {
    next = { ...next, seeds: addTo(next.seeds, def.id, 1) };
    msg += ' and a seed';
  }
  const harvestsLeft = plant.harvestsLeft - 1;
  const newPlant: Plant | null =
    harvestsLeft > 0
      ? { ...plant, growth: 0.6, harvestsLeft, careGood: 0, careTotal: 0, fertilizedThisCycle: false }
      : null;
  if (!newPlant) msg += `. The ${def.plantName.toLowerCase()} is spent`;
  next = updatePlot(next, plot.id, (p) => ({ ...p, plant: newPlant }));
  return notify(next, msg + '!', 'good');
}

function useTool(s: GameState, plotId: number, tool: Tool, seed: string | null | undefined, now: number): GameState {
  const plot = s.plots.find((p) => p.id === plotId);
  if (!plot) return s;
  const plant = plot.plant;

  if (tool === 'tend') {
    if (plant && isRipe(plant)) tool = 'harvest';
    else if (plot.weeds > 0) tool = 'weed';
    else if (!plant && seed) tool = 'plant';
    else if (!plant) return notify(s, 'Pick a seed from your pouch to plant here.', 'info');
    else tool = 'water';
  }

  switch (tool) {
    case 'water':
      return updatePlot(s, plotId, (p) => ({ ...p, moisture: 1 }));
    case 'weed': {
      if (plot.weeds === 0) return notify(s, 'No weeds here.', 'info');
      let next = updatePlot(s, plotId, (p) => ({ ...p, weeds: p.weeds - 1 }));
      next = { ...next, compost: next.compost + 1 };
      if (rng() < WILD_SEED_CHANCE) {
        const found = weightedSeed();
        next = { ...next, seeds: addTo(next.seeds, found, 1) };
        next = notify(next, `You found a ${PLANT_BY_ID[found].fruitName.toLowerCase()} seed in the soil!`, 'good');
      }
      return next;
    }
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
      const def = PLANT_BY_ID[seed];
      const next = updatePlot(s, plotId, (p) => ({
        ...p,
        plant: {
          kind: seed,
          growth: 0,
          harvestsLeft: def.harvests,
          careGood: 0,
          careTotal: 0,
          fertilizedUntil: 0,
          fertilizedThisCycle: false,
        },
      }));
      return { ...next, seeds: addTo(next.seeds, seed, -1) };
    }
  }
}

// ---------- reducer ----------
export function reducer(s: GameState, a: Action): GameState {
  switch (a.type) {
    case 'tick':
      return advance(s, a.now);

    case 'use':
      return useTool(advance(s, a.now), a.plotId, a.tool, a.seed, a.now);

    case 'waterAll':
      return { ...s, plots: s.plots.map((p) => ({ ...p, moisture: 1 })) };

    case 'harvestAll': {
      let next = advance(s, a.now);
      const ripe = next.plots.filter((p) => p.plant && isRipe(p.plant));
      if (ripe.length === 0) return notify(next, 'Nothing is ripe yet.', 'info');
      for (const plot of ripe) next = harvest(next, next.plots.find((p) => p.id === plot.id)!);
      return next;
    }

    case 'summon': {
      const parsed = parseFruitKey(a.fruitKey);
      if (!parsed || !(s.fruits[a.fruitKey] > 0)) return notify(s, 'You have none of that fruit.', 'warn');
      const { plant, quality } = parsed;
      const pityTriggered = s.pity >= PITY_LIMIT - 1;
      const result = summon(plant, quality, s.pity, (id) => !!s.collection[id], rng);
      const prev = s.collection[result.bug.id];
      const isNew = !prev;
      const coins = isNew ? NEW_BUG_COINS[result.tier] : 0;
      return {
        ...s,
        fruits: addTo(s.fruits, a.fruitKey, -1),
        coins: s.coins + coins,
        collection: {
          ...s.collection,
          [result.bug.id]: { count: (prev?.count ?? 0) + 1, firstAt: prev?.firstAt ?? a.now },
        },
        pity: result.tier >= PITY_TIER ? 0 : s.pity + 1,
        totalSummons: s.totalSummons + 1,
        lastSummon: {
          seq: (s.lastSummon?.seq ?? 0) + 1,
          bugId: result.bug.id,
          tier: result.tier,
          isNew,
          coins,
          fruitKey: a.fruitKey,
          pityTriggered,
        },
      };
    }

    case 'release': {
      const entry = s.collection[a.bugId];
      const bug = BUG_BY_ID[a.bugId];
      if (!entry || !bug) return s;
      const n = Math.min(a.count, entry.count - 1);
      if (n <= 0) return notify(s, 'You keep at least one of each species.', 'info');
      const earned = n * RELEASE_COINS[tierOf(bug)];
      return notify(
        {
          ...s,
          coins: s.coins + earned,
          collection: { ...s.collection, [a.bugId]: { ...entry, count: entry.count - n } },
        },
        `Released ${n} ${bug.commonName} back to the wild (+${earned} coins).`,
        'good',
      );
    }

    case 'releaseAllDuplicates': {
      let earned = 0;
      let released = 0;
      const collection = { ...s.collection };
      for (const [id, entry] of Object.entries(collection)) {
        const bug = BUG_BY_ID[id];
        if (!bug || entry.count <= 1) continue;
        const n = entry.count - 1;
        earned += n * RELEASE_COINS[tierOf(bug)];
        released += n;
        collection[id] = { ...entry, count: 1 };
      }
      if (released === 0) return notify(s, 'No duplicates to release.', 'info');
      return notify({ ...s, coins: s.coins + earned, collection }, `Released ${released} bugs (+${earned} coins).`, 'good');
    }

    case 'buySlot': {
      const slot = s.shop.slots[a.index];
      if (!slot || slot.stock <= 0) return s;
      const price = SEED_PRICE[PLANT_BY_ID[slot.plantId].seedTier];
      if (s.coins < price) return notify(s, 'Not enough coins.', 'warn');
      const slots = s.shop.slots.map((sl, i) => (i === a.index ? { ...sl, stock: sl.stock - 1 } : sl));
      return { ...s, coins: s.coins - price, seeds: addTo(s.seeds, slot.plantId, 1), shop: { ...s.shop, slots } };
    }

    case 'buySeed': {
      if (!STAPLE_SEEDS.includes(a.plantId)) return s;
      const price = SEED_PRICE[PLANT_BY_ID[a.plantId].seedTier];
      if (s.coins < price) return notify(s, 'Not enough coins.', 'warn');
      return { ...s, coins: s.coins - price, seeds: addTo(s.seeds, a.plantId, 1) };
    }

    case 'buyFertilizer':
      if (s.coins < FERTILIZER_PRICE) return notify(s, 'Not enough coins.', 'warn');
      return { ...s, coins: s.coins - FERTILIZER_PRICE, fertilizer: s.fertilizer + 1 };

    case 'buyPlot': {
      if (s.plots.length >= MAX_PLOTS) return notify(s, 'Your garden is as big as it gets!', 'info');
      const price = plotPrice(s.plots.length);
      if (s.coins < price) return notify(s, 'Not enough coins.', 'warn');
      const plot: Plot = { id: Math.max(...s.plots.map((p) => p.id)) + 1, moisture: 0, weeds: 1, plant: null };
      return notify({ ...s, coins: s.coins - price, plots: [...s.plots, plot] }, 'A new plot is ready for digging.', 'good');
    }

    case 'refreshShop': {
      const free = a.now - s.shop.refreshedAt >= SHOP_REFRESH_MS;
      if (!free && s.coins < SHOP_REFRESH_PRICE) return notify(s, 'Not enough coins.', 'warn');
      return {
        ...s,
        coins: s.coins - (free ? 0 : SHOP_REFRESH_PRICE),
        shop: { slots: rollShop(), refreshedAt: a.now },
      };
    }

    case 'sellFruit': {
      const parsed = parseFruitKey(a.key);
      const have = s.fruits[a.key] ?? 0;
      const n = Math.min(a.count, have);
      if (!parsed || n <= 0) return s;
      const bonus = parsed.quality === 'perfect' ? 2 : parsed.quality === 'fine' ? 1 : 0;
      const earned = n * (FRUIT_SELL_PRICE[parsed.plant.seedTier] + bonus);
      return { ...s, coins: s.coins + earned, fruits: addTo(s.fruits, a.key, -n) };
    }

    case 'makeFertilizer':
      if (s.compost < COMPOST_PER_FERTILIZER) return notify(s, `You need ${COMPOST_PER_FERTILIZER} compost.`, 'warn');
      return { ...s, compost: s.compost - COMPOST_PER_FERTILIZER, fertilizer: s.fertilizer + 1 };

    case 'dismissNotice':
      return { ...s, notices: s.notices.filter((n) => n.id !== a.id) };

    case 'reset':
      return newGame(a.now);
  }
}

// ---------- persistence ----------
export function serialize(s: GameState): string {
  const { notices: _n, noticeSeq: _q, lastSummon: _l, ...rest } = s;
  return JSON.stringify(rest);
}

export function deserialize(json: string | null, now: number): GameState {
  if (!json) return newGame(now);
  try {
    const data = JSON.parse(json);
    if (data?.version !== SAVE_VERSION) return newGame(now);
    const base = newGame(now);
    const s: GameState = { ...base, ...data, notices: [], noticeSeq: 0, lastSummon: null };
    // Drop anything that refers to plants or bugs that no longer exist.
    s.plots = s.plots.map((p) => (p.plant && !PLANT_BY_ID[p.plant.kind] ? { ...p, plant: null } : p));
    s.seeds = Object.fromEntries(Object.entries(s.seeds).filter(([k]) => PLANT_BY_ID[k]));
    s.fruits = Object.fromEntries(Object.entries(s.fruits).filter(([k]) => parseFruitKey(k)));
    s.collection = Object.fromEntries(Object.entries(s.collection).filter(([k]) => BUG_BY_ID[k]));
    s.shop = { ...s.shop, slots: s.shop.slots.filter((sl) => PLANT_BY_ID[sl.plantId]) };
    const advanced = advance(s, now);
    const away = (now - s.lastTick) / 1000;
    return away > 60 ? notify(advanced, `Welcome back! Your garden grew while you were away.`, 'info') : advanced;
  } catch {
    return newGame(now);
  }
}
