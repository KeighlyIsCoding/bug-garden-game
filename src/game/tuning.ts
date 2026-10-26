/**
 * Every balance number in one place. `balance.test.ts` simulates players against these,
 * so retune here and re-run the tests rather than scattering magic numbers.
 */

// ---------- garden grid ----------
export const GRID_COLS = 6;
export const GRID_ROWS = 8;
export const MAX_PLOTS = GRID_COLS * GRID_ROWS;
/** The garden starts as a 3×2 bed in the top-left corner. */
export const START_PLOTS = 6;
export const LAND_BASE_PRICE = 80;
export const LAND_PRICE_GROWTH = 1.2;
export const landPrice = (owned: number) => Math.round(LAND_BASE_PRICE * LAND_PRICE_GROWTH ** Math.max(0, owned - START_PLOTS));

// ---------- water & weeds ----------
/** Seconds for a fully watered plot to dry out. */
export const MOISTURE_SECONDS = 45;
/** Growth multiplier while the soil is dry. */
export const DRY_GROWTH = 0.15;
/** Average seconds between new weeds on a plot. */
export const WEED_INTERVAL = 80;
export const MAX_WEEDS = 3;
/** Each weed slows growth by this much. */
export const WEED_PENALTY = 0.25;
export const WILD_SEED_CHANCE = 0.08;
/** Hand-watering soaks a plot: this much faster growth for this long. */
export const SOAK_SECONDS = 60;
export const SOAK_GROWTH = 1.2;
/** Drip line for one garden row: `IRRIGATION_ROW_BASE × growth^(rows already irrigated)`. */
export const IRRIGATION_ROW_BASE = 3000;
export const IRRIGATION_ROW_GROWTH = 1.7;
export const irrigationRowPrice = (irrigated: number) => Math.round(IRRIGATION_ROW_BASE * IRRIGATION_ROW_GROWTH ** irrigated);

// ---------- plants ----------
/** After a harvest, perennials drop back to this growth (flowering) and regrow. */
export const REGROW_FROM = 0.25;
/** Vigor: a plant's yield multiplier. It wears down with every harvest. */
export const VIGOR_DECAY = 0.06;
export const VIGOR_FLOOR = 0.4;
export const TOPDRESS_COMPOST = 2;
export const TOPDRESS_VIGOR = 0.25;
/** Compost you get back for digging a plant up. */
export const DIG_COMPOST = 2;
/** Seconds a dig-up waits for its confirming second press. */
export const DIG_CONFIRM_MS = 3000;

// ---------- fertilizer & compost ----------
export const FERTILIZER_SECONDS = 90;
export const FERTILIZER_GROWTH = 1.7;
export const FERTILIZER_PRICE = 8;
export const COMPOST_PER_FERTILIZER = 3;

// ---------- market ----------
export const SHOP_SLOTS = 4;
export const SHOP_REFRESH_MS = 3 * 60 * 1000;
export const SHOP_REFRESH_PRICE = 5;
export const STAPLE_SEEDS = ['apple', 'strawberry'];

// ---------- collection ----------
/** The capsule machine gets hungrier as the Bugdex fills: 1 fruit per capsule, +1 for every 10 species owned. */
export const CAPSULE_COST_STEP = 10;
export const capsuleCost = (speciesOwned: number) => 1 + Math.floor(speciesOwned / CAPSULE_COST_STEP);
export const NEW_BUG_COINS = [5, 10, 20, 40, 80, 150];
export const RELEASE_COINS = [2, 4, 8, 16, 32, 60];

// ---------- time ----------
export const MAX_OFFLINE_SECONDS = 2 * 60 * 60;
