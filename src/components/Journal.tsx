import { useEffect, useState } from 'react';
import { formatNum } from '../format';
import { ORDER_INFO } from '../game/bugs';
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_BONUS,
  GOLDEN_SEED_BONUS,
  ORDER_BONUS,
  PERKS,
  SEASON_MIN_PLOTS,
  canEndSeason,
  goldenSeedsFor,
  hasPerk,
  orderProgress,
  seasonCoins,
  type Action,
  type GameState,
} from '../game/state';
import { Bubble } from './Bubble';

/** Ending a season resets the garden, so it takes a second press within a few seconds. */
function EndSeasonButton({ next, onConfirm }: { next: number; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(t);
  }, [armed]);
  return (
    <span className="bubble-anchor">
      <button
        className={`btn primary${armed ? ' armed' : ''}`}
        onClick={() => {
          if (!armed) return setArmed(true);
          setArmed(false);
          onConfirm();
        }}
      >
        🌅 {armed ? 'Press again to start fresh' : `Start season ${next}`}
      </button>
      {armed && <Bubble text="Press again: land, coins, upgrades and supplies reset" />}
    </span>
  );
}

function SeasonPanel({ state, dispatch }: { state: GameState; dispatch: (a: Action) => void }) {
  const { season } = state;
  const ready = canEndSeason(state);
  const gain = goldenSeedsFor(state);
  return (
    <section className="panel season">
      <div className="panel-head">
        <h2>Season {season.number}</h2>
        <span className="muted small">
          🌟 {season.goldenSeeds} Golden Seeds · +{Math.round(season.goldenSeeds * GOLDEN_SEED_BONUS * 100)}% growth and yield
        </span>
      </div>
      <p className="small">
        End the season to start a fresh garden with Golden Seeds. You keep your Bugdex, achievements, Golden Seeds and perks; land,
        coins, upgrades and supplies reset. Each unspent Golden Seed makes everything grow {GOLDEN_SEED_BONUS * 100}% faster and yield{' '}
        {GOLDEN_SEED_BONUS * 100}% more.
      </p>
      {ready ? (
        <div className="row season-end">
          <span>
            Ending now gives <strong>+{gain} 🌟</strong>{' '}
            <span className="muted small">({formatNum(seasonCoins(state))} coins earned this season)</span>
          </span>
          <EndSeasonButton next={season.number + 1} onConfirm={() => dispatch({ type: 'newSeason', now: Date.now() })} />
        </div>
      ) : (
        <>
          <div className="meter" role="progressbar" aria-label="Plots toward ending the season" aria-valuemin={0} aria-valuemax={SEASON_MIN_PLOTS} aria-valuenow={state.plots.length}>
            <span style={{ width: `${(state.plots.length / SEASON_MIN_PLOTS) * 100}%` }} />
          </div>
          <p className="muted small">
            Grow to {SEASON_MIN_PLOTS} plots to end the season ({state.plots.length}/{SEASON_MIN_PLOTS}). So far it would give +{gain} 🌟.
          </p>
        </>
      )}
      <h3>Perks</h3>
      <p className="muted small">Spend Golden Seeds on perks that last for good. Spent seeds no longer give their bonus.</p>
      <ul className="perks">
        {PERKS.map((p) => {
          const owned = hasPerk(state, p.id);
          return (
            <li key={p.id} className={owned ? 'done' : ''}>
              <span className="emoji" aria-hidden>
                {p.icon}
              </span>
              <span>
                <strong>{p.name}</strong>
                <span className="muted small"> {p.desc}</span>
              </span>
              {owned ? (
                <span className="good small">Owned</span>
              ) : (
                <button
                  className="btn small"
                  disabled={season.goldenSeeds < p.cost}
                  onClick={() => dispatch({ type: 'buyPerk', id: p.id })}
                  aria-label={`Buy ${p.name} for ${p.cost} Golden Seeds`}
                >
                  {p.cost} 🌟
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function Journal({ state, dispatch }: { state: GameState; dispatch: (a: Action) => void }) {
  const progress = orderProgress(state.collection);
  const earned = ACHIEVEMENTS.filter((a) => state.achievements.includes(a.id)).length;
  return (
    <div className="journal">
      <SeasonPanel state={state} dispatch={dispatch} />
      <section className="panel">
        <div className="panel-head">
          <h2>Bugdex bonuses</h2>
        </div>
        <p className="muted small">Every species you discover helps the garden. Completing an order adds +10% on top.</p>
        <div className="table-wrap">
          <table className="bonuses">
            <thead>
              <tr>
                <th>Order</th>
                <th>Helps with</th>
                <th className="num">Found</th>
                <th className="num">Bonus</th>
              </tr>
            </thead>
            <tbody>
              {progress.map((p) => (
                <tr key={p.order} className={p.owned === p.total ? 'complete' : ''}>
                  <td>
                    <strong>{ORDER_INFO[p.order].label}</strong>
                    <div className="muted tiny">{p.order}</div>
                  </td>
                  <td className="small">{ORDER_BONUS[p.order].label}</td>
                  <td className="num">
                    {p.owned}/{p.total}
                  </td>
                  <td className="num">{p.bonus > 0 ? `+${Math.round(p.bonus * 100)}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Achievements</h2>
          <span className="muted small">
            {earned}/{ACHIEVEMENTS.length} · +{Math.round(earned * ACHIEVEMENT_BONUS * 100)}% fruit yield
          </span>
        </div>
        <ul className="achievements">
          {ACHIEVEMENTS.map((a) => {
            const done = state.achievements.includes(a.id);
            return (
              <li key={a.id} className={done ? 'done' : ''}>
                <span className="emoji" aria-hidden>
                  {done ? a.icon : '🔒'}
                </span>
                <span>
                  <strong>{a.name}</strong>
                  <span className="muted small"> {a.desc}</span>
                  <span className="sr-only">{done ? ' Earned.' : ' Not yet earned.'}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
