import { useEffect } from 'react';
import { butterflyVisible, type Action, type GameState } from '../game/state';
import { Bubble } from './Bubble';

/** The golden butterfly: shows up now and then for a few seconds. Click it, or press B, for a reward. */
export function GoldenButterfly({ state, dispatch }: { state: GameState; dispatch: (a: Action) => void }) {
  const visible = butterflyVisible(state, state.lastTick);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'b' && e.key !== 'B') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return;
      dispatch({ type: 'catchButterfly', now: Date.now() });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, dispatch]);

  if (!visible) return null;
  const { x, y } = state.butterfly;
  return (
    <div className="butterfly-wrap" style={{ left: `${x}%`, top: `${y}%` }}>
      <button className="butterfly" onClick={() => dispatch({ type: 'catchButterfly', now: Date.now() })} aria-label="Catch the golden butterfly">
        <span className="emoji" aria-hidden>
          🦋
        </span>
      </button>
      <Bubble text="A golden butterfly! Click it or press B." tone="good" />
    </div>
  );
}
