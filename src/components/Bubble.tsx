import { useEffect, useState } from 'react';

/**
 * Many screen readers ignore a live region that is added to the page already holding text,
 * so the bubble mounts empty and fills in just after. This also lets a focus move that
 * happens at the same moment be spoken first instead of cutting the message off.
 */
const ANNOUNCE_DELAY_MS = 100;

/**
 * A small speech bubble that floats above whatever positioned element contains it.
 * It is a polite live region: screen readers read its text when it appears and whenever it changes.
 */
export function Bubble({ text, tone = 'info', className = '' }: { text: string; tone?: 'info' | 'good'; className?: string }) {
  const [shown, setShown] = useState('');
  useEffect(() => {
    const t = window.setTimeout(() => setShown(text), ANNOUNCE_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [text]);
  return (
    <span className={`bubble bubble-${tone} ${className}`} role="status" aria-live="polite" aria-atomic="true">
      {shown}
    </span>
  );
}
