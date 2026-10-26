import { checkAchievements } from './achievements';
import { BUG_BY_ID, tierOf } from './bugs';
import { PITY_LIMIT, PITY_TIER, summon } from './gacha';
import { runAutomation } from './automation';
import {
  buyLand,
  countFruit,
  digUp,
  EXPANSION_ORDER,
  harvest,
  incomeEstimate,
  isRipe,
  newPlant,
  newPlot,
  pullWeed,
  pullWeeds,
  sellPrice,
  stepPlots,
  topDress,
  useTool,
} from './garden';
import { modifiers, type Modifiers } from './modifiers';
import { PLANT_BY_ID, SEED_PRICE, fruitKey, parseFruitKey } from './plants';
import { buyPerk, newSeason } from './season';
import { UPGRADE_BY_ID, isUnlocked, level, nextCost } from './upgrades';
import {
  FERTILIZER_PRICE,
  AWAY_SUMMARY_SECONDS,
  BLOOM_GROWTH,
  BUTTERFLY_FIRST_SECONDS,
  BUTTERFLY_MAX_SECONDS,
  BUTTERFLY_MIN_SECONDS,
  BUTTERFLY_STAY_SECONDS,
  COARSE_AFTER_SECONDS,
  COARSE_STEP_SECONDS,
  HERBICIDE_PRICE,
  NEW_BUG_COINS,
  PURSE_MIN,
  PURSE_SECONDS,
  SOAK_SECONDS,
  RELEASE_COINS,
  SHOP_REFRESH_MS,
  SHOP_REFRESH_PRICE,
  SHOP_SLOTS,
  START_PLOTS,
  STAPLE_SEEDS,
  capsuleCost,
  irrigationRowPrice,
} from './tuning';
import type { Action, GameState, Plant, Plot, ShopSlot } from './types';
import { addTo, earn, notify, rng, weightedSeed } from './util';

export * from './types';
export * from './tuning';
export { setRng } from './util';
export { areaCells, careRatio, countFruit, expectedYield, growthRate, incomeEstimate, isRipe, nextLand, qualityFor, sellPrice, stageOf } from './garden';
export { ACHIEVEMENTS, ACHIEVEMENT_BONUS } from './achievements';
export { ORDER_BONUS, orderProgress } from './bonuses';
export { PERKS, canEndSeason, goldenSeedsFor, hasPerk, seasonCoins } from './season';
export { modifiers, type Modifiers } from './modifiers';
export { UPGRADES, UPGRADE_BY_ID, isUnlocked, level, nextCost, type UpgradeDef } from './upgrades';

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
    herbicide: 0,
    seeds: { apple: 3, strawberry: 3, raspberry: 2 },
    fruits: { [fruitKey('apple', 'normal')]: 2 },
    plots: plots.sort((a, b) => a.id - b.id),
    collection: {},
    pity: 0,
    totalSummons: 0,
    shop: { slots: rollShop(), refreshedAt: now },
    upgrades: {},
    irrigatedRows: [],
    irrigatedAt: now,
    barrow: {},
    barrowAt: now,
    patrolAt: now,
    stand: { qualities: ['normal'], carry: 0 },
    stats: { fruitHarvested: 0, coinsEarned: 0, weedsPulled: 0, butterflies: 0, heirlooms: 0 },
    achievements: [],
    butterfly: { nextAt: now + BUTTERFLY_FIRST_SECONDS * 1000, shownAt: null, x: 50, y: 50 },
    season: { number: 1, goldenSeeds: 0, totalGoldenSeeds: 0, perks: [], startEarned: 0 },
    awaySummary: null,
    notices: [],
    noticeSeq: 0,
    lastSummon: null,
  };
}

// ---------- simulation ----------
export function advance(s: GameState, now: number): GameState {
  const m = modifiers(s);
  let elapsed = Math.min((now - s.lastTick) / 1000, m.offlineSeconds);
  if (elapsed <= 0) return s;
  const alwaysWet = m.pumpInterval === 0 ? new Set(s.irrigatedRows) : undefined;
  // Long gaps (time away) run in coarser steps so loading stays quick.
  const step = elapsed > COARSE_AFTER_SECONDS ? COARSE_STEP_SECONDS : 1;
  let next = s;
  let t = s.lastTick;
  while (elapsed > 0) {
    const dt = Math.min(step, elapsed);
    t += dt * 1000;
    next = runAutomation({ ...next, plots: stepPlots(next.plots, dt, t, alwaysWet, m) }, t, dt, m);
    elapsed -= dt;
  }
  next = { ...next, lastTick: now };
  if (now - s.shop.refreshedAt >= SHOP_REFRESH_MS) {
    next = { ...next, shop: { slots: rollShop(), refreshedAt: now } };
  }
  return next;
}

// ---------- golden butterfly ----------
const butterflyDelay = (m: Modifiers) =>
  ((BUTTERFLY_MIN_SECONDS + rng() * (BUTTERFLY_MAX_SECONDS - BUTTERFLY_MIN_SECONDS)) * 1000) / m.butterflyRate;

/** Butterflies only come while you're playing: they appear on live ticks, never in time away. */
function tickButterfly(s: GameState, now: number, m: Modifiers): GameState {
  const b = s.butterfly;
  if (b.shownAt !== null) {
    if (now - b.shownAt <= BUTTERFLY_STAY_SECONDS * 1000) return s;
    return { ...s, butterfly: { ...b, shownAt: null, nextAt: now + butterflyDelay(m) } };
  }
  if (now < b.nextAt) return s;
  return { ...s, butterfly: { ...b, shownAt: now, x: 12 + rng() * 76, y: 12 + rng() * 70 } };
}

export function butterflyVisible(s: GameState, now: number) {
  return s.butterfly.shownAt !== null && now - s.butterfly.shownAt <= BUTTERFLY_STAY_SECONDS * 1000;
}

function catchButterfly(s: GameState, now: number): GameState {
  if (!butterflyVisible(s, now)) return s;
  const m = modifiers(s);
  let next: GameState = {
    ...s,
    butterfly: { ...s.butterfly, shownAt: null, nextAt: now + butterflyDelay(m) },
    stats: { ...s.stats, butterflies: s.stats.butterflies + 1 },
  };
  const roll = rng();
  if (roll < 0.3) {
    next = {
      ...next,
      plots: next.plots.map((p) => (p.plant && !isRipe(p.plant) ? { ...p, plant: { ...p.plant, growth: Math.min(1, p.plant.growth + BLOOM_GROWTH) } } : p)),
    };
    return notify(next, '🦋 Bloom! Every growing plant shot up.', 'good');
  }
  if (roll < 0.55) {
    const until = now + SOAK_SECONDS * 1000;
    next = {
      ...next,
      plots: next.plots.map((p) => ({ ...p, moisture: 1, soakedUntil: until, plant: p.plant && { ...p.plant, soakedThisCycle: true } })),
    };
    return notify(next, '🦋 Rain! The whole garden is soaked.', 'good');
  }
  if (roll < 0.85) {
    const coins = Math.round(Math.max(PURSE_MIN, incomeEstimate(next, m) * PURSE_SECONDS));
    return notify(earn(next, coins), `🦋 A purse of ${coins} coins!`, 'good');
  }
  const seed = weightedSeed(Object.values(PLANT_BY_ID).filter((p) => p.seedTier === 0).map((p) => p.id));
  next = { ...next, seeds: addTo(next.seeds, seed, 2) };
  return notify(next, `🦋 A gift of 2 ${PLANT_BY_ID[seed].fruitName.toLowerCase()} seeds!`, 'good');
}

// ---------- reducer ----------
/** Every action, then any achievements it earned. */
export function reducer(s: GameState, a: Action): GameState {
  const next = reduce(s, a);
  return next === s ? s : checkAchievements(next);
}

function reduce(s: GameState, a: Action): GameState {
  switch (a.type) {
    case 'tick': {
      const next = advance(s, a.now);
      return tickButterfly(next, a.now, modifiers(next));
    }

    case 'catchButterfly':
      return catchButterfly(advance(s, a.now), a.now);

    case 'dismissAway':
      return { ...s, awaySummary: null };

    case 'newSeason':
      return newSeason(advance(s, a.now), newGame(a.now));

    case 'buyPerk':
      return buyPerk(s, a.id);

    case 'use':
      return useTool(advance(s, a.now), a.plotId, a.tool, a.seed, a.now, modifiers(s));

    case 'pullWeed':
      return pullWeed(advance(s, a.now), a.plotId, modifiers(s));

    case 'pullWeeds':
      return pullWeeds(advance(s, a.now), a.plotIds, modifiers(s));

    case 'buyHerbicide':
      if (!modifiers(s).canSpray) return notify(s, 'Buy the herbicide sprayer in the Shed first.', 'info');
      if (s.coins < HERBICIDE_PRICE) return notify(s, 'Not enough coins.', 'warn');
      return { ...s, coins: s.coins - HERBICIDE_PRICE, herbicide: s.herbicide + 1 };

    case 'digUp':
      return digUp(advance(s, a.now), a.plotId, modifiers(s).digSeedChance);

    case 'topDress':
      return topDress(advance(s, a.now), a.plotId);

    case 'buyLand':
      return buyLand(advance(s, a.now));

    case 'buyUpgrade': {
      const now = advance(s, a.now);
      const def = UPGRADE_BY_ID[a.id];
      const cost = nextCost(now, a.id);
      if (!def || cost === null) return now;
      if (!isUnlocked(now, def)) return notify(now, 'That upgrade is still locked.', 'info');
      if (now.coins < cost) return notify(now, 'Not enough coins.', 'warn');
      const lv = level(now, a.id);
      return notify(
        { ...now, coins: now.coins - cost, upgrades: { ...now.upgrades, [a.id]: lv + 1 } },
        `${def.name}: ${def.levels[lv].effect}!`,
        'good',
      );
    }

    case 'irrigateRow': {
      if (level(s, 'pump') === 0) return notify(s, 'Buy the irrigation pump first.', 'info');
      if (s.irrigatedRows.includes(a.row) || !s.plots.some((p) => p.y === a.row)) return s;
      const price = irrigationRowPrice(s.irrigatedRows.length);
      if (s.coins < price) return notify(s, 'Not enough coins.', 'warn');
      return notify(
        { ...s, coins: s.coins - price, irrigatedRows: [...s.irrigatedRows, a.row].sort((x, y) => x - y) },
        `Drip line laid along row ${a.row + 1}.`,
        'good',
      );
    }

    case 'emptyBarrow': {
      const n = countFruit(s.barrow);
      if (n === 0) return notify(s, 'The wheelbarrow is empty.', 'info');
      let fruits = s.fruits;
      for (const [key, count] of Object.entries(s.barrow)) fruits = addTo(fruits, key, count);
      return notify({ ...s, fruits, barrow: {} }, `Tipped ${n} fruit from the wheelbarrow into your basket!`, 'good');
    }

    case 'setStand':
      return { ...s, stand: { ...s.stand, qualities: a.qualities } };

    case 'harvestAll': {
      if (level(s, 'barrow') === 0) return s;
      let next = advance(s, a.now);
      const ripe = next.plots.filter((p) => p.plant && isRipe(p.plant));
      if (ripe.length === 0) return notify(next, 'Nothing is ripe yet.', 'info');
      const m = modifiers(s);
      for (const plot of ripe) next = harvest(next, next.plots.find((p) => p.id === plot.id)!, 'basket', m);
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
        ...earn(s, coins),
        fruits: addTo(s.fruits, a.fruitKey, -cost),
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
          ...earn(s, earned),
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
      return notify({ ...earn(s, earned), collection }, `Released ${released} bugs (+${earned} coins).`, 'good');
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
      const earned = n * sellPrice(a.key, modifiers(s));
      return { ...earn(s, earned), fruits: addTo(s.fruits, a.key, -n) };
    }

    case 'makeFertilizer': {
      const cost = modifiers(s).compostPerFertilizer;
      if (s.compost < cost) return notify(s, `You need ${cost} compost.`, 'warn');
      return { ...s, compost: s.compost - cost, fertilizer: s.fertilizer + 1 };
    }

    case 'dismissNotice':
      return { ...s, notices: s.notices.filter((n) => n.id !== a.id) };

    case 'reset':
      return newGame(a.now);
  }
}

// ---------- persistence ----------
export function serialize(s: GameState): string {
  const { notices: _n, noticeSeq: _q, lastSummon: _l, awaySummary: _a, ...rest } = s;
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
  const plant = p.plant && PLANT_BY_ID[p.plant.kind] ? ({ ...newPlant(p.plant.kind), ...(p.plant as Partial<Plant>) } as Plant) : null;
  return { ...newPlot(p.x, p.y), ...p, plant };
}

export function deserialize(json: string | null, now: number): GameState {
  if (!json) return newGame(now);
  try {
    let data = JSON.parse(json);
    if (data?.version === 1) data = migrateV1(data);
    if (data?.version !== SAVE_VERSION) return newGame(now);
    const base = newGame(now);
    const s: GameState = {
      ...base,
      ...data,
      stats: { ...base.stats, ...data.stats },
      season: { ...base.season, ...data.season },
      butterfly: { ...base.butterfly, ...data.butterfly, shownAt: null },
      notices: [],
      noticeSeq: 0,
      lastSummon: null,
      awaySummary: null,
    };
    // Drop anything that refers to plants or bugs that no longer exist.
    s.plots = s.plots.map(normalizePlot);
    s.seeds = Object.fromEntries(Object.entries(s.seeds).filter(([k]) => PLANT_BY_ID[k]));
    s.fruits = Object.fromEntries(Object.entries(s.fruits).filter(([k]) => parseFruitKey(k)));
    s.collection = Object.fromEntries(Object.entries(s.collection).filter(([k]) => BUG_BY_ID[k]));
    s.shop = { ...s.shop, slots: s.shop.slots.filter((sl) => PLANT_BY_ID[sl.plantId]) };
    const advanced = advance(s, now);
    const away = (now - s.lastTick) / 1000;
    if (away < AWAY_SUMMARY_SECONDS) return advanced;
    const cap = modifiers(s).offlineSeconds;
    const weeds = (x: GameState) => x.plots.reduce((a, p) => a + p.weeds, 0);
    return {
      ...advanced,
      awaySummary: {
        seconds: away,
        capped: away > cap,
        coins: advanced.stats.coinsEarned - s.stats.coinsEarned,
        fruit: advanced.stats.fruitHarvested - s.stats.fruitHarvested,
        weeds: Math.max(0, weeds(advanced) - weeds(s)),
        ripe: advanced.plots.filter((p) => p.plant && isRipe(p.plant)).length,
        barrowFull: modifiers(s).barrowCapacity > 0 && countFruit(advanced.barrow) >= modifiers(s).barrowCapacity,
      },
    };
  } catch {
    return newGame(now);
  }
}
