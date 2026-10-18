import { useEffect, useState } from 'react';

/**
 * Many screen readers ignore a live region that is added to the page already holding text,
 * so the bubble mounts empty and fills in just after. This also lets a focus move that
 * happens at the same moment be spoken first instead of cutting the message off.
 */
const ANNOUNCE_DELAY_MS = 100;
/** How long a bubble stays on screen before hiding itself. */
const SHOW_MS = 1000;

/**
 * A small speech bubble that floats above whatever positioned element contains it.
 * It is a polite live region: screen readers read its text when it appears and whenever it changes.
 * It hides itself after a second; giving it new text shows it again.
 */
export function Bubble({ text, tone = 'info', className = '' }: { text: string; tone?: 'info' | 'good'; className?: string }) {
  // `n` restarts the pop-in animation each time the bubble is shown.
  const [shown, setShown] = useState({ text: '', n: 0 });
  useEffect(() => {
    const show = window.setTimeout(() => setShown((s) => ({ text, n: s.n + 1 })), ANNOUNCE_DELAY_MS);
    const hide = window.setTimeout(() => setShown((s) => ({ ...s, text: '' })), ANNOUNCE_DELAY_MS + SHOW_MS);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, [text]);
  return (
    <span className={`bubble ${className}`} role="status" aria-live="polite" aria-atomic="true">
      {shown.text && (
        <span key={shown.n} className={`bubble-body bubble-${tone}`}>
          {shown.text}
        </span>
      )}
    </span>
  );
}
