import type { Tier } from './bugs';
import type { Quality } from './plants';

export interface Plant {
  kind: string;
  /** 0..1, ripe at 1 */
  growth: number;
  /** Yield multiplier, worn down by each harvest (see VIGOR_* in tuning). */
  vigor: number;
  /** Harvests taken from this plant so far. */
  harvests: number;
  careGood: number;
  careTotal: number;
  fertilizedUntil: number;
  fertilizedThisCycle: boolean;
  /** Hand-watered (soaked) at least once this growth cycle. Needed for Prize quality. */
  soakedThisCycle: boolean;
  /** Sprayed with herbicide this growth cycle: the harvest drops a quality tier. */
  herbicideThisCycle: boolean;
}

export interface Plot {
  /** Cell index in the grid: y * GRID_COLS + x. */
  id: number;
  x: number;
  y: number;
  moisture: number;
  /** Hand-watered plots are soaked (a growth bonus) until this time. Irrigation never soaks. */
  soakedUntil: number;
  /** Weeds were clipped (roots left in): they regrow faster until this time. */
  cutUntil: number;
  /** Herbicide keeps weeds back until this time. */
  herbicideUntil: number;
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
  /** Herbicide doses. */
  herbicide: number;
  seeds: Record<string, number>;
  fruits: Record<string, number>;
  plots: Plot[];
  collection: Record<string, { count: number; firstAt: number }>;
  pity: number;
  totalSummons: number;
  shop: { slots: ShopSlot[]; refreshedAt: number };
  /** Shed upgrade levels by id (missing = 0). */
  upgrades: Record<string, number>;
  /** Garden rows (y) with drip lines. The pump waters them on its schedule. */
  irrigatedRows: number[];
  /** Last time the pump watered the irrigated rows. */
  irrigatedAt: number;
  /** Fruit the wheelbarrow has auto-harvested, waiting to be emptied into the basket. */
  barrow: Record<string, number>;
  /** Last time the wheelbarrow went round. */
  barrowAt: number;
  /** Fruit stand: which qualities it sells, and the fraction of a sale carried between ticks. */
  stand: { qualities: Quality[]; carry: number };
  // transient (not saved)
  notices: Notice[];
  noticeSeq: number;
  lastSummon: LastSummon | null;
}

export type Tool = 'tend' | 'water' | 'fertilize' | 'harvest' | 'plant' | 'clip' | 'spray';

export type Action =
  | { type: 'tick'; now: number }
  | { type: 'use'; plotId: number; tool: Tool; seed?: string | null; now: number }
  | { type: 'pullWeed'; plotId: number; now: number }
  /** Glove: pull every weed in these plots at once. */
  | { type: 'pullWeeds'; plotIds: number[]; now: number }
  | { type: 'buyHerbicide' }
  | { type: 'digUp'; plotId: number; now: number }
  | { type: 'topDress'; plotId: number; now: number }
  | { type: 'buyLand'; now: number }
  | { type: 'buyUpgrade'; id: string; now: number }
  | { type: 'irrigateRow'; row: number; now: number }
  | { type: 'emptyBarrow'; now: number }
  | { type: 'setStand'; qualities: Quality[] }
  | { type: 'harvestAll'; now: number }
  | { type: 'summon'; fruitKey: string; now: number }
  | { type: 'release'; bugId: string; count: number }
  | { type: 'releaseAllDuplicates' }
  | { type: 'buySlot'; index: number }
  | { type: 'buySeed'; plantId: string }
  | { type: 'buyFertilizer' }
  | { type: 'refreshShop'; now: number }
  | { type: 'sellFruit'; key: string; count: number }
  | { type: 'makeFertilizer' }
  | { type: 'dismissNotice'; id: number }
  | { type: 'reset'; now: number };
