import { useEffect, useState } from 'react';
import { ORDER_INFO, STATUS_LABEL, TIERS, TIER_COLORS, tierOf, type Bug, type Tier } from '../game/bugs';
import { fruitsForBug } from '../game/gacha';
import { PLANTS } from '../game/plants';
import { RELEASE_COINS, type Action, type GameState } from '../game/state';
import { FruitIcon, OrderIcon } from './Icons';

export function RarityBadge({ tier }: { tier: Tier }) {
  return (
    <span className={`rarity r${tier}`} style={{ ['--tier' as string]: TIER_COLORS[tier] }}>
      {TIERS[tier]}
    </span>
  );
}

export function BugImage({ bug, size = 'md' }: { bug: Bug; size?: 'md' | 'lg' }) {
  const [failed, setFailed] = useState(false);
  const color = ORDER_INFO[bug.order].color;
  if (!bug.image || failed)
    return (
      <div className={`bug-img placeholder ${size}`} style={{ background: `${color}22` }}>
        <OrderIcon order={bug.order} size={size === 'lg' ? 88 : 48} color={color} />
      </div>
    );
  return (
    <div className={`bug-img ${size}`}>
      <img src={bug.image} alt={bug.commonName} loading="lazy" onError={() => setFailed(true)} />
    </div>
  );
}

export const hasCommonName = (bug: Bug) => bug.commonName !== bug.scientificName;

export function BugName({ bug, as: Tag = 'h2' }: { bug: Bug; as?: 'h2' | 'strong' }) {
  return (
    <>
      <Tag className={hasCommonName(bug) ? '' : 'sci-title'}>{bug.commonName}</Tag>
      {hasCommonName(bug) && <p className="sci">{bug.scientificName}</p>}
    </>
  );
}

export function statusText(bug: Bug) {
  if (bug.statusSystem === 'TNC') return `NatureServe ${bug.statusRaw} · ${STATUS_LABEL[bug.status]}`;
  if (!bug.statusRaw) return 'Not evaluated';
  const list = bug.statusSystem.startsWith('IUCN') ? `IUCN ${bug.statusSystem.replace('IUCN', '')}` : bug.statusSystem;
  return `${STATUS_LABEL[bug.status]} (${list})`;
}

export function BugModal({
  bug,
  state,
  dispatch,
  onClose,
}: {
  bug: Bug;
  state: GameState;
  dispatch: (a: Action) => void;
  onClose: () => void;
}) {
  const entry = state.collection[bug.id];
  const tier = tierOf(bug);
  const owned = !!entry;
  const fruits = fruitsForBug(bug, PLANTS);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={owned ? bug.commonName : 'Undiscovered bug'} onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        {owned ? (
          <div className="modal-body">
            <BugImage bug={bug} size="lg" />
            <div className="modal-text">
              <div className="row wrap">
                <RarityBadge tier={tier} />
                <span className="order-tag" style={{ ['--order' as string]: ORDER_INFO[bug.order].color }}>
                  {bug.order} · {ORDER_INFO[bug.order].label}
                </span>
              </div>
              <BugName bug={bug} />
              <p className="status">
                <strong>Conservation status:</strong> {statusText(bug)}
              </p>
              <p className="desc">{bug.description}</p>
              <p className="small">
                <a href={bug.wikiUrl} target="_blank" rel="noreferrer">
                  Read “{bug.wikiTitle}” on Wikipedia ↗
                </a>
                <span className="muted"> · Text & image: Wikipedia, CC BY-SA</span>
              </p>
              <div className="owned-row">
                <span>
                  Owned: <strong>×{entry.count}</strong>
                  <span className="muted"> · first found {new Date(entry.firstAt).toLocaleDateString()}</span>
                </span>
                <button
                  className="btn small"
                  disabled={entry.count <= 1}
                  onClick={() => dispatch({ type: 'release', bugId: bug.id, count: 1 })}
                >
                  Release 1 (+{RELEASE_COINS[tier]} 🪙)
                </button>
                {entry.count > 2 && (
                  <button className="btn small" onClick={() => dispatch({ type: 'release', bugId: bug.id, count: entry.count - 1 })}>
                    Release {entry.count - 1}
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="modal-body undiscovered">
            <div className="bug-img lg placeholder silhouette">
              <OrderIcon order={bug.order} size={88} />
            </div>
            <div className="modal-text">
              <div className="row wrap">
                <RarityBadge tier={tier} />
                <span className="order-tag" style={{ ['--order' as string]: ORDER_INFO[bug.order].color }}>
                  {bug.order} · {ORDER_INFO[bug.order].label}
                </span>
              </div>
              <h2>Undiscovered</h2>
              <p className="muted">You haven't summoned this species yet.</p>
            </div>
          </div>
        )}
        <div className="summoned-by">
          <span className="muted small">Can be summoned with:</span>
          {fruits.map((f) => (
            <span key={f.id} className="fruit-chip" title={f.fruitName}>
              <FruitIcon id={f.id} size={20} /> {f.fruitName}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
