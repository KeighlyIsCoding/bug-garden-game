import { useMemo, useState } from 'react';
import { BUGS, ORDERS, ORDER_INFO, TIERS, TIER_COLORS, tierOf, type OrderName, type Tier } from '../game/bugs';
import type { Action, GameState } from '../game/state';
import { BugImage, RarityBadge, hasCommonName } from './BugBits';
import { OrderIcon } from './Icons';

export function Bugdex({
  state,
  dispatch,
  onOpenBug,
}: {
  state: GameState;
  dispatch: (a: Action) => void;
  onOpenBug: (id: string) => void;
}) {
  const [order, setOrder] = useState<OrderName | 'all'>('all');
  const [tier, setTier] = useState<Tier | 'all'>('all');
  const [show, setShow] = useState<'all' | 'owned' | 'missing'>('all');
  const [query, setQuery] = useState('');

  const owned = (id: string) => !!state.collection[id];
  const ownedTotal = BUGS.filter((b) => owned(b.id)).length;
  const dupes = Object.values(state.collection).reduce((s, e) => s + Math.max(0, e.count - 1), 0);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return BUGS.filter(
      (b) =>
        (order === 'all' || b.order === order) &&
        (tier === 'all' || tierOf(b) === tier) &&
        (show === 'all' || (show === 'owned') === !!state.collection[b.id]) &&
        (!q ||
          (state.collection[b.id] &&
            (b.commonName.toLowerCase().includes(q) || b.scientificName.toLowerCase().includes(q)))),
    );
  }, [order, tier, show, query, state.collection]);

  return (
    <div className="dex">
      <section className="panel">
        <div className="panel-head">
          <h2>Bugdex</h2>
          <div className="row">
            <span className="muted small">{state.totalSummons} summons</span>
            <button className="btn small" disabled={dupes === 0} onClick={() => dispatch({ type: 'releaseAllDuplicates' })}>
              Release all duplicates ({dupes})
            </button>
          </div>
        </div>
        <div className="progress big">
          <span style={{ width: `${(ownedTotal / BUGS.length) * 100}%` }} />
          <em>
            {ownedTotal} / {BUGS.length} species
          </em>
        </div>

        <div className="order-chips">
          <button className={`chip ${order === 'all' ? 'active' : ''}`} onClick={() => setOrder('all')}>
            All orders
          </button>
          {ORDERS.map((o) => {
            const inOrder = BUGS.filter((b) => b.order === o);
            const have = inOrder.filter((b) => owned(b.id)).length;
            return (
              <button
                key={o}
                className={`chip ${order === o ? 'active' : ''} ${have === inOrder.length ? 'complete' : ''}`}
                onClick={() => setOrder(o)}
                style={{ ['--order' as string]: ORDER_INFO[o].color }}
                title={ORDER_INFO[o].label}
              >
                <OrderIcon order={o} size={18} color={ORDER_INFO[o].color} />
                {o}
                <span className="chip-count">
                  {have}/{inOrder.length}
                </span>
              </button>
            );
          })}
        </div>

        <div className="filters">
          <select value={tier} onChange={(e) => setTier(e.target.value === 'all' ? 'all' : (Number(e.target.value) as Tier))} aria-label="Rarity">
            <option value="all">All rarities</option>
            {TIERS.map((t, i) => (
              <option key={t} value={i}>
                {t}
              </option>
            ))}
          </select>
          <select value={show} onChange={(e) => setShow(e.target.value as typeof show)} aria-label="Show">
            <option value="all">Discovered & undiscovered</option>
            <option value="owned">Discovered only</option>
            <option value="missing">Undiscovered only</option>
          </select>
          <input type="search" placeholder="Search discovered bugs…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </section>

      <div className="dex-grid">
        {list.map((b) => {
          const entry = state.collection[b.id];
          const t = tierOf(b);
          return (
            <button
              key={b.id}
              className={`dex-card ${entry ? 'owned' : 'missing'}`}
              style={{ ['--tier' as string]: TIER_COLORS[t] }}
              onClick={() => onOpenBug(b.id)}
            >
              {entry ? (
                <BugImage bug={b} />
              ) : (
                <div className="bug-img placeholder silhouette">
                  <OrderIcon order={b.order} size={44} />
                  <span className="qmark">?</span>
                </div>
              )}
              <div className="dex-card-text">
                <strong className={entry && !hasCommonName(b) ? 'sci-title' : ''}>{entry ? b.commonName : '???'}</strong>
                <em>{!entry ? b.order : hasCommonName(b) ? b.scientificName : ORDER_INFO[b.order].label}</em>
                <span className="row">
                  <RarityBadge tier={t} />
                  {entry && entry.count > 1 && <span className="count">×{entry.count}</span>}
                </span>
              </div>
            </button>
          );
        })}
        {list.length === 0 && <p className="muted">No bugs match these filters.</p>}
      </div>
    </div>
  );
}
