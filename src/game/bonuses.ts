import { ORDERS, bugsInOrder, type OrderName } from './bugs';
import type { GameState } from './types';

/** Garden stats that Bugdex orders can boost. */
export type BonusStat =
  | 'yield'
  | 'weedSlow'
  | 'growth'
  | 'butterflies'
  | 'moisture'
  | 'sellPrice'
  | 'offline'
  | 'vigorKeep'
  | 'compost'
  | 'fertilizer'
  | 'barrow'
  | 'seeds';

/** What each order does for the garden, loosely after what those insects do for real gardens. */
export const ORDER_BONUS: Record<OrderName, { stat: BonusStat; label: string }> = {
  Hymenoptera: { stat: 'yield', label: 'Pollinators: more fruit per harvest' },
  Coleoptera: { stat: 'weedSlow', label: 'Ground beetles eat weed seeds: weeds come back slower' },
  Odonata: { stat: 'growth', label: 'Dragonflies keep pests down: plants grow faster' },
  Lepidoptera: { stat: 'butterflies', label: 'Golden butterflies visit more often' },
  Hemiptera: { stat: 'moisture', label: 'Cicadas aerate the soil: moisture lasts longer' },
  Orthoptera: { stat: 'sellPrice', label: 'Crickets draw a crowd: fruit sells for more' },
  Phasmatodea: { stat: 'offline', label: 'Stick insects keep watch: the garden keeps growing longer while you are away' },
  Neuroptera: { stat: 'vigorKeep', label: 'Lacewings eat aphids: plants lose vigor more slowly' },
  Diptera: { stat: 'compost', label: 'Flies break things down: more compost from weeds' },
  Blattodea: { stat: 'fertilizer', label: 'Termites enrich the soil: fertilizer lasts longer' },
  Mantodea: { stat: 'barrow', label: 'Mantises guard the barrow: it holds more' },
  Ephemeroptera: { stat: 'seeds', label: 'Mayflies mark healthy water: more seeds drop' },
};

/** Each species owned adds this much to its order's stat; a complete order adds the completion bonus on top. */
export const PER_SPECIES_BONUS = 0.01;
export const ORDER_COMPLETE_BONUS = 0.1;

export interface OrderProgress {
  order: OrderName;
  owned: number;
  total: number;
  bonus: number;
}

export function orderProgress(collection: GameState['collection']): OrderProgress[] {
  return ORDERS.map((order) => {
    const all = bugsInOrder(order);
    const owned = all.filter((b) => collection[b.id]).length;
    const bonus = owned * PER_SPECIES_BONUS + (owned === all.length && all.length > 0 ? ORDER_COMPLETE_BONUS : 0);
    return { order, owned, total: all.length, bonus };
  });
}

/** Total bonus per stat, e.g. { yield: 0.12 } = +12% yield. */
export function bugdexBonuses(collection: GameState['collection'] = {}): Record<BonusStat, number> {
  const out = Object.fromEntries(Object.values(ORDER_BONUS).map((b) => [b.stat, 0])) as Record<BonusStat, number>;
  for (const p of orderProgress(collection)) out[ORDER_BONUS[p.order].stat] += p.bonus;
  return out;
}
