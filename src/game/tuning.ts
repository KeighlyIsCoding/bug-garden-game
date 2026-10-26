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
/** Clipped weeds leave their roots: weeds come back this much faster for a while. */
export const CUT_SECONDS = 180;
export const CUT_WEED_SPEED = 2;
/** Herbicide: weeds come back this many times slower, for this long. Costs a quality tier. */
export const HERBICIDE_SECONDS = 600;
export const HERBICIDE_WEED_SLOWDOWN = 3;
export const HERBICIDE_PRICE = 25;
/** With the trowel, digging up a plant has this chance to give its seed back. */
export const TROWEL_SEED_CHANCE = 0.5;
/** The compost tumbler keeps this much compost for top-dressing and turns the rest into fertilizer. */
export const TUMBLER_RESERVE = 10;
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
/** How long the garden keeps growing while the game is closed (Stick insects in the Bugdex add to this). */
export const OFFLINE_BASE_SECONDS = 8 * 60 * 60;
/** Gaps longer than this are simulated in coarser steps, so returning after hours loads quickly. */
export const COARSE_AFTER_SECONDS = 10 * 60;
export const COARSE_STEP_SECONDS = 5;
/** Show the "while you were away" summary after this long. */
export const AWAY_SUMMARY_SECONDS = 10 * 60;

// ---------- golden butterfly ----------
/** Seconds between butterflies (random in this range; Lepidoptera in the Bugdex shorten it). */
export const BUTTERFLY_MIN_SECONDS = 4 * 60;
export const BUTTERFLY_MAX_SECONDS = 8 * 60;
export const BUTTERFLY_FIRST_SECONDS = 90;
/** How long one stays on screen. */
export const BUTTERFLY_STAY_SECONDS = 10;
/** Bloom: every growing plant jumps ahead by this much growth. */
export const BLOOM_GROWTH = 0.15;
/** Purse: this many seconds of the garden's income (at least PURSE_MIN coins). */
export const PURSE_SECONDS = 120;
export const PURSE_MIN = 25;
