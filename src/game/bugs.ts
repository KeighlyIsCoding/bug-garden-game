import rawBugs from '../data/bugs.json';

export type StatusCode = 'NE' | 'LC' | 'DD' | 'NT' | 'VU' | 'EN' | 'CR' | 'EW' | 'EX';

export interface Bug {
  id: string;
  scientificName: string;
  commonName: string;
  order: OrderName;
  status: StatusCode;
  statusSystem: string;
  statusRaw: string;
  description: string;
  image: string | null;
  wikiTitle: string;
  wikiUrl: string;
}

export const ORDERS = [
  'Coleoptera',
  'Lepidoptera',
  'Odonata',
  'Hymenoptera',
  'Hemiptera',
  'Orthoptera',
  'Phasmatodea',
  'Mantodea',
  'Diptera',
  'Blattodea',
  'Neuroptera',
  'Ephemeroptera',
] as const;
export type OrderName = (typeof ORDERS)[number];

export const ORDER_INFO: Record<OrderName, { label: string; color: string }> = {
  Coleoptera: { label: 'Beetles', color: '#8a5a2b' },
  Lepidoptera: { label: 'Butterflies & moths', color: '#d9772b' },
  Odonata: { label: 'Dragonflies & damselflies', color: '#2b8fb3' },
  Hymenoptera: { label: 'Bees, wasps & ants', color: '#d4a017' },
  Hemiptera: { label: 'True bugs', color: '#b8433a' },
  Orthoptera: { label: 'Crickets & grasshoppers', color: '#5c9a3a' },
  Phasmatodea: { label: 'Stick & leaf insects', color: '#7d8b3c' },
  Mantodea: { label: 'Mantises', color: '#3f9e6e' },
  Diptera: { label: 'True flies', color: '#6b6f8a' },
  Blattodea: { label: 'Cockroaches & termites', color: '#7a4a3a' },
  Neuroptera: { label: 'Lacewings & antlions', color: '#5aa39b' },
  Ephemeroptera: { label: 'Mayflies', color: '#9b7fc2' },
};

/** Rarity tiers, index = tier number used in odds maths. */
export const TIERS = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'] as const;
export type Tier = 0 | 1 | 2 | 3 | 4 | 5;

export const TIER_COLORS: Record<Tier, string> = {
  0: '#8c9a7e',
  1: '#4caf50',
  2: '#2f80d1',
  3: '#8e44c9',
  4: '#e0a100',
  5: '#e0457b',
};

const STATUS_TIER: Record<StatusCode, Tier> = {
  NE: 0,
  LC: 0,
  DD: 1,
  NT: 1,
  VU: 2,
  EN: 3,
  CR: 4,
  EW: 5,
  EX: 5,
};

export const STATUS_LABEL: Record<StatusCode, string> = {
  NE: 'Not Evaluated',
  LC: 'Least Concern',
  DD: 'Data Deficient',
  NT: 'Near Threatened',
  VU: 'Vulnerable',
  EN: 'Endangered',
  CR: 'Critically Endangered',
  EW: 'Extinct in the Wild',
  EX: 'Extinct',
};

export const tierOf = (bug: Bug): Tier => STATUS_TIER[bug.status];

export const BUGS: Bug[] = rawBugs as Bug[];
export const BUG_BY_ID: Record<string, Bug> = Object.fromEntries(BUGS.map((b) => [b.id, b]));

export const bugsInOrder = (order: OrderName) => BUGS.filter((b) => b.order === order);

/** Share of an order's species that are Rare (Vulnerable) or rarer. Drives seed scarcity. */
export function rareShare(order: OrderName): number {
  const list = bugsInOrder(order);
  if (list.length === 0) return 0;
  return list.filter((b) => tierOf(b) >= 2).length / list.length;
}
