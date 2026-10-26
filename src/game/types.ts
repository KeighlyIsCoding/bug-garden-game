import type { Tier } from './bugs';

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
}

export interface Plot {
  /** Cell index in the grid: y * GRID_COLS + x. */
  id: number;
  x: number;
  y: number;
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

export type Tool = 'tend' | 'water' | 'fertilize' | 'harvest' | 'plant';

export type Action =
  | { type: 'tick'; now: number }
  | { type: 'use'; plotId: number; tool: Tool; seed?: string | null; now: number }
  | { type: 'pullWeed'; plotId: number; now: number }
  | { type: 'digUp'; plotId: number; now: number }
  | { type: 'topDress'; plotId: number; now: number }
  | { type: 'buyLand'; now: number }
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
