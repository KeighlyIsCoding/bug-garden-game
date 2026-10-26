import { useEffect, useRef } from 'react';
import { formatNum } from '../format';
import type { Action, AwaySummary as Summary } from '../game/state';

function duration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m} minutes`;
}

/** "While you were away": what the garden did on its own. */
export function AwaySummary({ summary, offlineSeconds, dispatch }: { summary: Summary; offlineSeconds: number; dispatch: (a: Action) => void }) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && dispatch({ type: 'dismissAway' });
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch]);

  return (
    <div className="modal-backdrop" onClick={() => dispatch({ type: 'dismissAway' })}>
      <div className="modal away" role="dialog" aria-modal="true" aria-labelledby="away-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="away-title">While you were away</h2>
        <p className="muted">You were gone {duration(summary.seconds)}.</p>
        <ul className="away-list">
          <li>
            <span className="emoji" aria-hidden>
              🪙
            </span>{' '}
            <strong>{formatNum(summary.coins)}</strong> coins earned
          </li>
          <li>
            <span className="emoji" aria-hidden>
              🧺
            </span>{' '}
            <strong>{formatNum(summary.fruit)}</strong> fruit picked by the wheelbarrow
          </li>
          <li>
            <span className="emoji" aria-hidden>
              🍎
            </span>{' '}
            <strong>{summary.ripe}</strong> plants ripe and waiting
          </li>
          <li>
            <span className="emoji" aria-hidden>
              🌾
            </span>{' '}
            <strong>{summary.weeds}</strong> new weeds
          </li>
        </ul>
        {summary.barrowFull && <p className="tip">The wheelbarrow filled up. Tip it into your basket so it can keep picking.</p>}
        {summary.capped && (
          <p className="tip">
            Gardens only grow on their own for {duration(offlineSeconds)}. Stick insects in your Bugdex make that longer.
          </p>
        )}
        <button ref={close} className="btn primary" onClick={() => dispatch({ type: 'dismissAway' })}>
          Back to the garden
        </button>
      </div>
    </div>
  );
}
