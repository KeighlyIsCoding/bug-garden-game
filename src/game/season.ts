import { EXPANSION_ORDER, newPlot } from './garden';
import { GOLDEN_SEED_DIVISOR, SEASON_MIN_PLOTS } from './tuning';
import type { GameState, Plot } from './types';
import { notify } from './util';

export interface PerkDef {
  id: string;
  icon: string;
  name: string;
  desc: string;
  cost: number;
}

/** Perks cost Golden Seeds and last for good. Start-of-season perks apply from the next season. */
export const PERKS: PerkDef[] = [
  { id: 'early-can', icon: '🪣', name: 'Head start: watering can', desc: 'Each season starts with the 2×2 watering can.', cost: 3 },
  { id: 'long-nap', icon: '💤', name: 'Long nap', desc: 'The garden keeps growing 4 more hours while you are away.', cost: 4 },
  { id: 'big-start', icon: '🟫', name: 'Head start: land', desc: 'Each season starts with 12 plots.', cost: 6 },
  { id: 'ribbon', icon: '🎗️', name: 'Head start: show ribbon', desc: 'Each season starts with Prize fruit unlocked.', cost: 8 },
  {
    id: 'old-pipes',
    icon: '🚰',
    name: 'Old pipes',
    desc: 'Each season starts with the irrigation pump (every 10 min) and a drip line on row 1.',
    cost: 10,
  },
];
export const PERK_BY_ID: Record<string, PerkDef> = Object.fromEntries(PERKS.map((p) => [p.id, p]));

export const seasonCoins = (s: GameState) => s.stats.coinsEarned - s.season.startEarned;
export const goldenSeedsFor = (s: GameState) => Math.floor(Math.sqrt(Math.max(0, seasonCoins(s)) / GOLDEN_SEED_DIVISOR));
export const canEndSeason = (s: GameState) => s.plots.length >= SEASON_MIN_PLOTS;
export const hasPerk = (s: Pick<GameState, 'season'>, id: string) => s.season.perks.includes(id);

export function buyPerk(s: GameState, id: string): GameState {
  const perk = PERK_BY_ID[id];
  if (!perk || hasPerk(s, id)) return s;
  if (s.season.goldenSeeds < perk.cost) return notify(s, 'Not enough Golden Seeds.', 'warn');
  return notify(
    { ...s, season: { ...s.season, goldenSeeds: s.season.goldenSeeds - perk.cost, perks: [...s.season.perks, id] } },
    `${perk.name} is yours for good.`,
    'good',
  );
}

/**
 * End the season: bank Golden Seeds, then start a fresh garden. The Bugdex, pity, achievements,
 * lifetime stats, Golden Seeds and perks carry over; land, coins, upgrades and supplies reset.
 */
export function newSeason(s: GameState, fresh: GameState): GameState {
  if (!canEndSeason(s)) return notify(s, `Grow your garden to ${SEASON_MIN_PLOTS} plots to end the season.`, 'info');
  const earned = goldenSeedsFor(s);
  const perks = s.season.perks;
  const upgrades: Record<string, number> = {};
  if (perks.includes('early-can')) upgrades.can = 1;
  if (perks.includes('ribbon')) upgrades.prize = 1;
  if (perks.includes('old-pipes')) upgrades.pump = 1;
  let plots: Plot[] = fresh.plots;
  if (perks.includes('big-start')) plots = EXPANSION_ORDER.slice(0, 12).map(({ x, y }) => newPlot(x, y)).sort((a, b) => a.id - b.id);
  const next: GameState = {
    ...fresh,
    collection: s.collection,
    pity: s.pity,
    totalSummons: s.totalSummons,
    stats: s.stats,
    achievements: s.achievements,
    butterfly: s.butterfly,
    plots,
    upgrades,
    irrigatedRows: perks.includes('old-pipes') ? [0] : [],
    season: {
      number: s.season.number + 1,
      goldenSeeds: s.season.goldenSeeds + earned,
      totalGoldenSeeds: s.season.totalGoldenSeeds + earned,
      perks,
      startEarned: s.stats.coinsEarned,
    },
  };
  return notify(next, `Season ${next.season.number} begins! +${earned} Golden Seeds.`, 'good');
}
