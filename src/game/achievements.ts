import { BUGS } from './bugs';
import type { GameState } from './types';
import { notify } from './util';

/** Each achievement adds this much to fruit yield, for good. */
export const ACHIEVEMENT_BONUS = 0.01;

export interface AchievementDef {
  id: string;
  icon: string;
  name: string;
  desc: string;
  done: (s: GameState) => boolean;
}

const species = (s: GameState) => Object.keys(s.collection).length;

const steps = (
  id: string,
  icon: string,
  name: (n: string) => string,
  desc: (n: string) => string,
  values: number[],
  value: (s: GameState) => number,
  label = (n: number) => n.toLocaleString('en'),
): AchievementDef[] =>
  values.map((v) => ({ id: `${id}-${v}`, icon, name: name(label(v)), desc: desc(label(v)), done: (s: GameState) => value(s) >= v }));

export const ACHIEVEMENTS: AchievementDef[] = [
  ...steps('harvest', '🧺', (n) => `${n} fruit`, (n) => `Harvest ${n} fruit.`, [100, 1_000, 10_000], (s) => s.stats.fruitHarvested),
  ...steps('plots', '🟫', (n) => `${n} plots`, (n) => `Grow your garden to ${n} plots.`, [12, 24, 36, 48], (s) => s.plots.length),
  ...steps('weeds', '🌾', (n) => `${n} weeds`, (n) => `Pull ${n} weeds.`, [100, 1_000, 5_000], (s) => s.stats.weedsPulled),
  ...steps('species', '📖', (n) => `${n} species`, (n) => `Discover ${n} species.`, [25, 100], species),
  {
    id: 'species-all',
    icon: '🏆',
    name: 'Complete Bugdex',
    desc: `Discover every one of the ${BUGS.length} species.`,
    done: (s) => species(s) >= BUGS.length,
  },
  ...steps('coins', '🪙', (n) => `${n} coins`, (n) => `Earn ${n} coins in total.`, [10_000, 1_000_000], (s) => s.stats.coinsEarned),
  { id: 'butterfly-1', icon: '🦋', name: 'First butterfly', desc: 'Catch a golden butterfly.', done: (s) => s.stats.butterflies >= 1 },
  ...steps('butterfly', '🦋', (n) => `${n} butterflies`, (n) => `Catch ${n} golden butterflies.`, [25], (s) => s.stats.butterflies),
  { id: 'heirloom-1', icon: '🏺', name: 'Heirloom', desc: 'Harvest Heirloom fruit.', done: (s) => s.stats.heirlooms > 0 },
];

/** Award any newly earned achievements, with a notice for each. */
export function checkAchievements(s: GameState): GameState {
  const fresh = ACHIEVEMENTS.filter((a) => !s.achievements.includes(a.id) && a.done(s));
  if (fresh.length === 0) return s;
  let next: GameState = { ...s, achievements: [...s.achievements, ...fresh.map((a) => a.id)] };
  for (const a of fresh) next = notify(next, `Achievement: ${a.name}! (+${ACHIEVEMENT_BONUS * 100}% fruit yield)`, 'good');
  return next;
}
