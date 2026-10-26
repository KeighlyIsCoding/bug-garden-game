import { BUG_BY_ID, tierOf } from './bugs';
import { PITY_LIMIT, PITY_TIER, summon } from './gacha';
import { buyLand, digUp, EXPANSION_ORDER, harvest, isRipe, newPlot, pullWeed, stepPlots, topDress, useTool } from './garden';
import { FRUIT_SELL_PRICE, PLANT_BY_ID, QUALITY_SELL_BONUS, SEED_PRICE, fruitKey, parseFruitKey } from './plants';
import {
  COMPOST_PER_FERTILIZER,
  FERTILIZER_PRICE,
  MAX_OFFLINE_SECONDS,
  NEW_BUG_COINS,
  RELEASE_COINS,
  SHOP_REFRESH_MS,
  SHOP_REFRESH_PRICE,
  SHOP_SLOTS,
  START_PLOTS,
  STAPLE_SEEDS,
  capsuleCost,
} from './tuning';
import type { Action, GameState, Plant, Plot, ShopSlot } from './types';
import { addTo, notify, rng, weightedSeed } from './util';

export * from './types';
export * from './tuning';
export { setRng } from './util';
export { careRatio, expectedYield, growthRate, isRipe, nextLand, qualityFor, stageOf } from './garden';

export const SAVE_VERSION = 2;
/** The key predates versioning; the version number inside the save is what changes. */
export const SAVE_KEY = 'bug-garden-save-v1';

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

// ---------- initial state ----------
export function newGame(now: number): GameState {
  const plots: Plot[] = EXPANSION_ORDER.slice(0, START_PLOTS).map(({ x, y }, i) => newPlot(x, y, i === 1 || i === 4 ? 1 : 0));
  return {
    version: SAVE_VERSION,
    lastTick: now,
    coins: 30,
    fertilizer: 2,
    compost: 0,
    seeds: { apple: 3, strawberry: 3, raspberry: 2 },
    fruits: { [fruitKey('apple', 'normal')]: 2 },
    plots: plots.sort((a, b) => a.id - b.id),
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

// ---------- reducer ----------
export function reducer(s: GameState, a: Action): GameState {
  switch (a.type) {
    case 'tick':
      return advance(s, a.now);

    case 'use':
      return useTool(advance(s, a.now), a.plotId, a.tool, a.seed, a.now);

    case 'pullWeed':
      return pullWeed(advance(s, a.now), a.plotId);

    case 'digUp':
      return digUp(advance(s, a.now), a.plotId);

    case 'topDress':
      return topDress(advance(s, a.now), a.plotId);

    case 'buyLand':
      return buyLand(advance(s, a.now));

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
      const cost = capsuleCost(Object.keys(s.collection).length);
      if (s.fruits[a.fruitKey] < cost)
        return notify(s, `A capsule needs ${cost} of the same fruit now. Harvest more!`, 'warn');
      const pityTriggered = s.pity >= PITY_LIMIT - 1;
      const result = summon(plant, quality, s.pity, (id) => !!s.collection[id], rng);
      const prev = s.collection[result.bug.id];
      const isNew = !prev;
      const coins = isNew ? NEW_BUG_COINS[result.tier] : 0;
      return {
        ...s,
        fruits: addTo(s.fruits, a.fruitKey, -cost),
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
      const earned = n * (FRUIT_SELL_PRICE[parsed.plant.seedTier] + QUALITY_SELL_BONUS[parsed.quality]);
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

type V1Plant = Omit<Plant, 'vigor' | 'harvests'> & { harvestsLeft?: number };
type V1Plot = { id: number; moisture: number; weeds: number; plant: V1Plant | null };

/**
 * v1 saves had a free-form list of up to 16 plots and plants that died after a few harvests.
 * Lay those plots onto the grid in the order land is sold, and make every plant a fresh perennial.
 */
export function migrateV1(data: { plots?: V1Plot[] } & Record<string, unknown>): Record<string, unknown> {
  const old = Array.isArray(data.plots) ? data.plots : [];
  const plots: Plot[] = old.slice(0, EXPANSION_ORDER.length).map((p, i) => {
    const { x, y } = EXPANSION_ORDER[i];
    const plant: Plant | null = p.plant
      ? { ...(({ harvestsLeft: _h, ...rest }) => rest)(p.plant), vigor: 1, harvests: 0 }
      : null;
    return { ...newPlot(x, y, p.weeds ?? 0), moisture: p.moisture ?? 0, plant };
  });
  return { ...data, version: SAVE_VERSION, plots: plots.sort((a, b) => a.id - b.id) };
}

/** Fill in any fields a save is missing, so later additions never break older saves. */
function normalizePlot(p: Plot): Plot {
  const plant = p.plant && PLANT_BY_ID[p.plant.kind] ? ({ vigor: 1, harvests: 0, ...(p.plant as Partial<Plant>) } as Plant) : null;
  return { ...newPlot(p.x, p.y), ...p, plant };
}

export function deserialize(json: string | null, now: number): GameState {
  if (!json) return newGame(now);
  try {
    let data = JSON.parse(json);
    if (data?.version === 1) data = migrateV1(data);
    if (data?.version !== SAVE_VERSION) return newGame(now);
    const base = newGame(now);
    const s: GameState = { ...base, ...data, notices: [], noticeSeq: 0, lastSummon: null };
    // Drop anything that refers to plants or bugs that no longer exist.
    s.plots = s.plots.map(normalizePlot);
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
