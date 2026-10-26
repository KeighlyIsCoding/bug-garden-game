import { useEffect, useMemo, useRef, useState } from 'react';
import { BUG_BY_ID, ORDER_INFO, TIERS, TIER_COLORS, type Tier } from '../game/bugs';
import { PITY_LIMIT, luckFor, poolFor, tierOdds } from '../game/gacha';
import { PLANTS, QUALITY_LABEL, parseFruitKey, type Quality } from '../game/plants';
import { CAPSULE_COST_STEP, capsuleCost, type Action, type GameState } from '../game/state';
import { BugImage, BugName, RarityBadge, statusText } from './BugBits';
import { FruitIcon } from './Icons';

type Phase = 'idle' | 'cranking' | 'dropping' | 'reveal';

const QUALITY_ORDER: Quality[] = ['perfect', 'fine', 'normal'];

// Fixed, pleasant-looking capsule positions inside the dome.
// Capsules piled in rows at the bottom of the dome, each row a little narrower.
const DOME_CAPSULES = Array.from({ length: 22 }, (_, i) => {
  const rowSizes = [7, 6, 5, 4];
  let row = 0;
  let col = i;
  while (col >= rowSizes[row]) col -= rowSizes[row++];
  const width = rowSizes[row] * 12.5;
  return {
    x: 50 - width / 2 + col * 12.5 + 6.25 + ((i * 13) % 5) - 2,
    y: 88 - row * 12 + ((i * 7) % 4) - 2,
    tier: ([0, 0, 0, 1, 0, 1, 2, 0, 3, 1, 0, 2, 4, 0, 1, 0, 5, 2, 0, 1, 3, 0] as Tier[])[i],
    rot: (i * 47) % 360,
  };
});

export function Summon({
  state,
  dispatch,
  onOpenBug,
}: {
  state: GameState;
  dispatch: (a: Action) => void;
  onOpenBug: (id: string) => void;
}) {
  const basket = useMemo(() => {
    const entries = Object.entries(state.fruits)
      .map(([key, count]) => ({ key, count, parsed: parseFruitKey(key)! }))
      .filter((e) => e.parsed && e.count > 0);
    const plantIndex = (id: string) => PLANTS.findIndex((p) => p.id === id);
    return entries.sort(
      (a, b) =>
        plantIndex(a.parsed.plant.id) - plantIndex(b.parsed.plant.id) ||
        QUALITY_ORDER.indexOf(a.parsed.quality) - QUALITY_ORDER.indexOf(b.parsed.quality),
    );
  }, [state.fruits]);

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [fast, setFast] = useState(false);
  const timers = useRef<number[]>([]);

  const selected = basket.find((b) => b.key === selectedKey) ?? null;
  const key = selected?.key ?? basket[0]?.key ?? null;
  const current = basket.find((b) => b.key === key) ?? null;

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const pityReady = state.pity >= PITY_LIMIT - 1;
  const odds = current ? tierOdds(current.parsed.plant, current.parsed.quality, pityReady) : null;
  const pool = current ? poolFor(current.parsed.plant) : [];
  const ownedInPool = pool.filter((b) => state.collection[b.id]).length;

  const last = state.lastSummon;
  const lastBug = last ? BUG_BY_ID[last.bugId] : null;
  const cost = capsuleCost(Object.keys(state.collection).length);
  const canAfford = !!current && current.count >= cost;

  const doSummon = (fruitKey: string | null | undefined) => {
    if (!fruitKey || !((state.fruits[fruitKey] ?? 0) >= cost) || phase === 'cranking' || phase === 'dropping') return;
    setSelectedKey(fruitKey);
    dispatch({ type: 'summon', fruitKey, now: Date.now() });
    timers.current.forEach(clearTimeout);
    if (fast) {
      setPhase('reveal');
      return;
    }
    setPhase('cranking');
    timers.current = [
      window.setTimeout(() => setPhase('dropping'), 900),
      window.setTimeout(() => setPhase('reveal'), 2000),
    ];
  };

  const againLeft = last ? Math.floor((state.fruits[last.fruitKey] ?? 0) / cost) : 0;
  const capsuleColor = last ? TIER_COLORS[last.tier] : '#ccc';

  return (
    <div className="summon-layout">
      <section className="panel machine-panel">
        <div className={`machine phase-${phase}`}>
          <div className="dome">
            {DOME_CAPSULES.map((c, i) => (
              <span
                key={i}
                className="dome-capsule"
                style={{
                  left: `${c.x}%`,
                  top: `${c.y}%`,
                  ['--cap' as string]: TIER_COLORS[c.tier],
                  transform: `translate(-50%, -50%) rotate(${c.rot}deg)`,
                }}
              />
            ))}
            <span className="dome-shine" />
          </div>
          <div className="machine-body">
            <div className="machine-label">BUG · CAPSULES</div>
            <div className="fruit-slot" title="Fruit slot">
              {current ? <FruitIcon id={current.parsed.plant.id} size={30} /> : <span className="muted small">no fruit</span>}
            </div>
            <div className="crank">
              <span className="crank-arm" />
            </div>
            <div className="chute">
              {(phase === 'dropping' || phase === 'reveal') && (
                <span className="capsule-drop" style={{ ['--cap' as string]: capsuleColor }} />
              )}
            </div>
          </div>
        </div>

        <div className="pity">
          <div className="pity-label">
            <span>Pity meter</span>
            <span className="muted small">
              {pityReady ? 'Next summon is guaranteed Epic or better!' : `${state.pity}/${PITY_LIMIT} — Epic+ guaranteed when full`}
            </span>
          </div>
          <div className="pity-bar">
            <span style={{ width: `${(Math.min(state.pity, PITY_LIMIT) / PITY_LIMIT) * 100}%` }} />
          </div>
        </div>

        <div className="row center">
          <button className="btn primary big" disabled={!canAfford || phase === 'cranking' || phase === 'dropping'} onClick={() => doSummon(current?.key)}>
            {!current
              ? 'No fruit — go harvest!'
              : canAfford
                ? `Summon with ${cost > 1 ? `${cost} ` : ''}${QUALITY_LABEL[current.parsed.quality].toLowerCase()} ${(cost > 1 ? current.parsed.plant.fruitPlural : current.parsed.plant.fruitName).toLowerCase()}`
                : `Need ${cost} ${current.parsed.plant.fruitPlural.toLowerCase()} (have ${current.count})`}
          </button>
        </div>
        <p className="center small muted">
          Each capsule costs <strong>{cost}</strong> of the same fruit. The machine gets hungrier as your Bugdex grows (+1 every{' '}
          {CAPSULE_COST_STEP} species).
        </p>
        <label className="row center small muted toggle">
          <input type="checkbox" checked={fast} onChange={(e) => setFast(e.target.checked)} /> Skip animation
        </label>
      </section>

      <aside className="summon-side">
        <section className="panel">
          <h3>Fruit basket</h3>
          {basket.length === 0 ? (
            <p className="muted">Your basket is empty. Harvest ripe plants in the garden to get fruit.</p>
          ) : (
            <div className="basket">
              {basket.map(({ key: k, count, parsed }) => (
                <button
                  key={k}
                  className={`basket-item ${k === key ? 'active' : ''} ${count < cost ? 'short' : ''}`}
                  onClick={() => setSelectedKey(k)}
                  title={count < cost ? `Need ${cost} for a capsule` : undefined}
                >
                  <FruitIcon id={parsed.plant.id} size={26} />
                  <span className="basket-name">
                    {parsed.plant.fruitName}
                    {parsed.quality !== 'normal' && <span className={`q-chip q-${parsed.quality}`}>{QUALITY_LABEL[parsed.quality]}</span>}
                  </span>
                  <span className="count">×{count}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        {current && odds && (
          <section className="panel">
            <h3>
              <FruitIcon id={current.parsed.plant.id} size={22} /> {QUALITY_LABEL[current.parsed.quality]} {current.parsed.plant.fruitName}
            </h3>
            <p className="small">
              {current.parsed.plant.order ? (
                <>
                  Summons only <strong>{current.parsed.plant.order}</strong> ({ORDER_INFO[current.parsed.plant.order].label.toLowerCase()}).
                </>
              ) : (
                <>Summons from <strong>every order</strong>.</>
              )}{' '}
              Luck +{luckFor(current.parsed.plant, current.parsed.quality).toFixed(2)}.
            </p>
            <p className="small muted">
              Species in pool: {ownedInPool}/{pool.length} discovered
            </p>
            <table className="odds">
              <tbody>
                {odds.map((p, t) => (
                  <tr key={t} className={p === 0 ? 'none' : ''}>
                    <td>
                      <RarityBadge tier={t as Tier} />
                    </td>
                    <td className="odds-bar">
                      <span style={{ width: `${Math.max(p * 100, p > 0 ? 1 : 0)}%`, background: TIER_COLORS[t as Tier] }} />
                    </td>
                    <td className="num">{p === 0 ? '—' : p < 0.01 ? `${(p * 100).toFixed(2)}%` : `${(p * 100).toFixed(1)}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="small muted">Rarity comes from each species' conservation status on Wikipedia — Mythic bugs are extinct.</p>
          </section>
        )}
      </aside>

      {phase === 'reveal' && last && lastBug && (
        <div className="modal-backdrop reveal-backdrop" onClick={() => setPhase('idle')}>
          <div
            className={`reveal r${last.tier}`}
            style={{ ['--tier' as string]: TIER_COLORS[last.tier] }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label={`You summoned ${lastBug.commonName}`}
          >
            <div className="reveal-capsule">
              <span className="half top" />
              <span className="half bottom" />
            </div>
            <div className="reveal-card">
              {last.isNew && <span className="new-badge">NEW!</span>}
              {last.pityTriggered && <span className="pity-badge">Pity!</span>}
              <BugImage bug={lastBug} />
              <RarityBadge tier={last.tier} />
              <BugName bug={lastBug} />
              <p className="small muted">
                {lastBug.order} · {statusText(lastBug)}
              </p>
              {last.isNew ? (
                <p className="small good">New species! +{last.coins} 🪙</p>
              ) : (
                <p className="small muted">You now have ×{state.collection[lastBug.id]?.count}</p>
              )}
              <div className="row center">
                <button className="btn" onClick={() => onOpenBug(lastBug.id)}>
                  Details
                </button>
                <button className="btn primary" disabled={againLeft === 0} onClick={() => doSummon(last.fruitKey)}>
                  {againLeft > 0 ? `Again (${againLeft} left)` : 'Out of that fruit'}
                </button>
              </div>
              <p className="tiny muted">{TIERS[last.tier]} · tap outside to close</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
