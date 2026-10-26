import { ORDERS, rareShare, type OrderName } from './bugs';

export type SeedTier = 0 | 1 | 2;
export const SEED_TIER_NAMES = ['Common', 'Uncommon', 'Rare'] as const;

export type PlantForm = 'tree' | 'bush' | 'vine' | 'patch' | 'cactus' | 'palm';

export interface PlantDef {
  id: string;
  plantName: string;
  fruitName: string;
  fruitPlural: string;
  form: PlantForm;
  /** null = summons from every order */
  order: OrderName | null;
  /** extra luck the fruit adds to a summon */
  luck: number;
  seedTier: SeedTier;
  /** seconds from seed to first ripe fruit at full health */
  growTime: number;
}

type BaseDef = Omit<PlantDef, 'seedTier' | 'growTime'> & { seedTier?: SeedTier };

const WILD: BaseDef[] = [
  { id: 'apple', plantName: 'Apple tree', fruitName: 'Apple', fruitPlural: 'Apples', form: 'tree', order: null, luck: 0, seedTier: 0 },
  { id: 'strawberry', plantName: 'Strawberry patch', fruitName: 'Strawberry', fruitPlural: 'Strawberries', form: 'patch', order: null, luck: 0.25, seedTier: 0 },
  { id: 'mango', plantName: 'Mango tree', fruitName: 'Mango', fruitPlural: 'Mangoes', form: 'tree', order: null, luck: 0.75, seedTier: 1 },
  { id: 'starfruit', plantName: 'Carambola tree', fruitName: 'Starfruit', fruitPlural: 'Starfruit', form: 'tree', order: null, luck: 1.5, seedTier: 2 },
];

const ORDER_FRUITS: BaseDef[] = [
  { id: 'raspberry', plantName: 'Raspberry cane', fruitName: 'Raspberry', fruitPlural: 'Raspberries', form: 'bush', order: 'Coleoptera', luck: 0 },
  { id: 'passionfruit', plantName: 'Passion vine', fruitName: 'Passionfruit', fruitPlural: 'Passionfruit', form: 'vine', order: 'Lepidoptera', luck: 0 },
  { id: 'dragonfruit', plantName: 'Pitaya cactus', fruitName: 'Dragonfruit', fruitPlural: 'Dragonfruit', form: 'cactus', order: 'Odonata', luck: 0 },
  { id: 'fig', plantName: 'Fig tree', fruitName: 'Fig', fruitPlural: 'Figs', form: 'tree', order: 'Hymenoptera', luck: 0 },
  { id: 'grape', plantName: 'Grapevine', fruitName: 'Grapes', fruitPlural: 'Grapes', form: 'vine', order: 'Hemiptera', luck: 0 },
  { id: 'kiwi', plantName: 'Kiwi vine', fruitName: 'Kiwifruit', fruitPlural: 'Kiwifruit', form: 'vine', order: 'Orthoptera', luck: 0 },
  { id: 'banana', plantName: 'Banana plant', fruitName: 'Banana', fruitPlural: 'Bananas', form: 'palm', order: 'Phasmatodea', luck: 0 },
  { id: 'pear', plantName: 'Pear tree', fruitName: 'Pear', fruitPlural: 'Pears', form: 'tree', order: 'Mantodea', luck: 0 },
  { id: 'blueberry', plantName: 'Blueberry bush', fruitName: 'Blueberry', fruitPlural: 'Blueberries', form: 'bush', order: 'Diptera', luck: 0 },
  { id: 'coconut', plantName: 'Coconut palm', fruitName: 'Coconut', fruitPlural: 'Coconuts', form: 'palm', order: 'Blattodea', luck: 0 },
  { id: 'cherry', plantName: 'Cherry tree', fruitName: 'Cherry', fruitPlural: 'Cherries', form: 'tree', order: 'Neuroptera', luck: 0 },
  { id: 'peach', plantName: 'Peach tree', fruitName: 'Peach', fruitPlural: 'Peaches', form: 'tree', order: 'Ephemeroptera', luck: 0 },
];

/**
 * Orders ranked by the share of their species that are Vulnerable or rarer, split into thirds.
 * The more rare bugs an order has, the scarcer its fruit's seeds.
 */
export function computeOrderSeedTiers(): Record<OrderName, SeedTier> {
  const ranked = [...ORDERS].sort((a, b) => rareShare(a) - rareShare(b) || a.localeCompare(b));
  const out = {} as Record<OrderName, SeedTier>;
  ranked.forEach((order, i) => {
    out[order] = Math.min(2, Math.floor((i * 3) / ranked.length)) as SeedTier;
  });
  return out;
}

export const ORDER_SEED_TIERS = computeOrderSeedTiers();

const GROW_TIME: Record<SeedTier, number> = { 0: 50, 1: 85, 2: 140 };

export const PLANTS: PlantDef[] = [...WILD, ...ORDER_FRUITS].map((p) => {
  const seedTier = p.seedTier ?? ORDER_SEED_TIERS[p.order as OrderName];
  return { ...p, seedTier, growTime: GROW_TIME[seedTier] * (p.form === 'tree' ? 1.15 : 1) };
});

export const PLANT_BY_ID: Record<string, PlantDef> = Object.fromEntries(PLANTS.map((p) => [p.id, p]));

export const SEED_PRICE: Record<SeedTier, number> = { 0: 5, 1: 12, 2: 30 };
export const FRUIT_SELL_PRICE: Record<SeedTier, number> = { 0: 3, 1: 8, 2: 16 };
export const SEED_DROP_CHANCE: Record<SeedTier, number> = { 0: 0.6, 1: 0.4, 2: 0.2 };
/** How often each seed tier shows up in the shop's rotating slots / random finds. */
export const SEED_TIER_WEIGHT: Record<SeedTier, number> = { 0: 60, 1: 30, 2: 10 };

export type Quality = 'normal' | 'fine' | 'perfect' | 'prize' | 'heirloom';
export const QUALITY_LUCK: Record<Quality, number> = { normal: 0, fine: 0.25, perfect: 0.6, prize: 0.9, heirloom: 1.3 };
export const QUALITY_LABEL: Record<Quality, string> = { normal: 'Normal', fine: 'Fine', perfect: 'Perfect', prize: 'Prize', heirloom: 'Heirloom' };
/** Lowest to highest. */
export const QUALITIES: Quality[] = ['normal', 'fine', 'perfect', 'prize', 'heirloom'];
/** Fruit per harvest at full vigor. Better care, more fruit. */
export const QUALITY_YIELD: Record<Quality, number> = { normal: 1, fine: 2, perfect: 3, prize: 4, heirloom: 5 };
/** Sell price multiplier by quality. */
export const QUALITY_SELL_MULT: Record<Quality, number> = { normal: 1, fine: 1.5, perfect: 2.5, prize: 3.5, heirloom: 5 };

export const fruitKey = (plantId: string, q: Quality) => `${plantId}:${q}`;
export function parseFruitKey(key: string): { plant: PlantDef; quality: Quality } | null {
  const [id, q] = key.split(':');
  const plant = PLANT_BY_ID[id];
  if (!plant || !(q in QUALITY_LUCK)) return null;
  return { plant, quality: q as Quality };
}
