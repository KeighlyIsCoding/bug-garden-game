import type { CSSProperties, ReactNode } from 'react';
import type { OrderName } from '../game/bugs';
import { PLANT_BY_ID, type PlantForm } from '../game/plants';

const FRUIT_EMOJI: Record<string, string> = {
  apple: '🍎',
  strawberry: '🍓',
  mango: '🥭',
  grape: '🍇',
  kiwi: '🥝',
  banana: '🍌',
  pear: '🍐',
  blueberry: '🫐',
  coconut: '🥥',
  cherry: '🍒',
  peach: '🍑',
};

const FRUIT_SVG: Record<string, ReactNode> = {
  raspberry: (
    <>
      <path d="M16 7c-2-3-6-3-7-1 3 0 5 1 7 3 2-2 4-3 7-3-1-2-5-2-7 1z" fill="#4c8c3a" />
      {[
        [12, 12], [16, 11], [20, 12], [10, 16], [14, 15.5], [18, 15.5], [22, 16],
        [11, 20], [15, 19.5], [19, 19.5], [21, 21], [13, 24], [17, 23.5], [16, 27],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={3} fill="#d8344f" stroke="#a51f3a" strokeWidth={0.6} />
      ))}
    </>
  ),
  dragonfruit: (
    <>
      <ellipse cx="16" cy="18" rx="9" ry="11" fill="#e8418f" />
      {[[9, 12, -40], [23, 12, 40], [8, 20, -70], [24, 20, 70], [12, 27, -120], [20, 27, 120], [16, 7, 0]].map(([x, y, r], i) => (
        <path key={i} d="M0 0 l-2 4 h4z" transform={`translate(${x} ${y}) rotate(${r})`} fill="#8bc34a" />
      ))}
      <path d="M12 15 q4 -3 8 0 M11 21 q5 -3 10 0" stroke="#f7a3c8" strokeWidth="1.4" fill="none" />
    </>
  ),
  passionfruit: (
    <>
      <path d="M16 6 q1 -3 4 -3" stroke="#5a7d2a" strokeWidth="1.6" fill="none" />
      <circle cx="16" cy="17" r="10" fill="#5b2a6e" />
      {[[12, 13], [19, 12], [21, 18], [14, 20], [18, 23], [10, 18], [16, 16]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={0.9} fill="#c79bd6" />
      ))}
      <ellipse cx="12.5" cy="12" rx="2.5" ry="1.5" fill="#fff" opacity="0.25" />
    </>
  ),
  fig: (
    <>
      <path d="M16 4 v3" stroke="#6b4f2a" strokeWidth="1.8" />
      <path d="M16 6 C11 10 7 16 7 21 a9 7 0 0 0 18 0 C25 16 21 10 16 6z" fill="#6d3a6b" />
      <path d="M16 9 C13 13 11 17 11 21" stroke="#9a5c96" strokeWidth="1.2" fill="none" />
      <circle cx="16" cy="27.2" r="1" fill="#3d1f3c" />
    </>
  ),
  starfruit: (
    <>
      <path
        d="M16 3 L19.6 11.5 L28.5 12.2 L21.8 18.2 L23.8 27 L16 22.3 L8.2 27 L10.2 18.2 L3.5 12.2 L12.4 11.5Z"
        fill="#f2c522"
        stroke="#c99a12"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <path d="M16 6 L16 20 M7 13 L16 19 M25 13 L16 19" stroke="#e0ad10" strokeWidth="0.8" />
    </>
  ),
};

export function FruitIcon({ id, size = 28, style }: { id: string; size?: number; style?: CSSProperties }) {
  const emoji = FRUIT_EMOJI[id];
  if (emoji)
    return (
      <span className="emoji" role="img" aria-label={PLANT_BY_ID[id]?.fruitName} style={{ fontSize: size * 0.9, ...style }}>
        {emoji}
      </span>
    );
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label={PLANT_BY_ID[id]?.fruitName} style={style}>
      {FRUIT_SVG[id]}
    </svg>
  );
}

const ORDER_EMOJI: Partial<Record<OrderName, string>> = {
  Coleoptera: '🪲',
  Lepidoptera: '🦋',
  Hymenoptera: '🐝',
  Orthoptera: '🦗',
  Blattodea: '🪳',
  Diptera: '🪰',
};

const ORDER_SVG: Partial<Record<OrderName, ReactNode>> = {
  Odonata: (
    <g stroke="currentColor" strokeLinecap="round">
      <ellipse cx="10" cy="11" rx="8" ry="2.6" transform="rotate(-12 10 11)" fill="#bfe3f2" strokeWidth="1" />
      <ellipse cx="22" cy="11" rx="8" ry="2.6" transform="rotate(12 22 11)" fill="#bfe3f2" strokeWidth="1" />
      <ellipse cx="10" cy="15.5" rx="7" ry="2.3" transform="rotate(10 10 15.5)" fill="#bfe3f2" strokeWidth="1" />
      <ellipse cx="22" cy="15.5" rx="7" ry="2.3" transform="rotate(-10 22 15.5)" fill="#bfe3f2" strokeWidth="1" />
      <line x1="16" y1="9" x2="16" y2="30" strokeWidth="2.6" />
      <circle cx="16" cy="6.5" r="2.6" fill="currentColor" stroke="none" />
    </g>
  ),
  Hemiptera: (
    <g stroke="currentColor" strokeLinecap="round" strokeWidth="1.3" fill="none">
      <path d="M9 12 h14 l-2 13 q-5 4 -10 0z" fill="currentColor" opacity="0.85" />
      <path d="M12 12 l4 7 l4 -7" stroke="#fff" opacity="0.6" />
      <circle cx="16" cy="9" r="2.4" fill="currentColor" />
      <path d="M15 7 l-4 -5 M17 7 l4 -5 M9 14 l-5 -2 M9 19 l-5 1 M10 23 l-4 4 M23 14 l5 -2 M23 19 l5 1 M22 23 l4 4" />
    </g>
  ),
  Phasmatodea: (
    <g stroke="currentColor" strokeLinecap="round" fill="none">
      <line x1="6" y1="27" x2="26" y2="5" strokeWidth="2.2" />
      <path d="M24 7 l4 -4 M25 6 l5 0" strokeWidth="1" />
      <path d="M20 12 l-6 -4 M18 14 l6 5 M14 18 l-7 -2 M13 20 l3 7 M10 22 l-6 -1 M9 24 l2 6" strokeWidth="1.1" />
    </g>
  ),
  Mantodea: (
    <g stroke="currentColor" strokeLinecap="round" fill="none">
      <path d="M17 13 L13 29" strokeWidth="3" />
      <path d="M17 13 L19 7" strokeWidth="2" />
      <path d="M16 4 l3 3 l3 -3z" fill="currentColor" strokeWidth="1" />
      <path d="M18.5 9 l-6 1 l2 -5 M18.5 10 l5 3 l-1 -5" strokeWidth="1.4" />
      <path d="M15 19 l-6 3 l-2 5 M15 20 l6 4 l2 5 M14 24 l-4 6" strokeWidth="1" />
    </g>
  ),
  Neuroptera: (
    <g stroke="currentColor" strokeLinecap="round">
      <path d="M16 9 C 5 5, 2 13, 15 17 Z M16 9 C 27 5, 30 13, 17 17 Z" fill="#d6f2c8" strokeWidth="1" />
      <path d="M16 14 C 6 14, 5 23, 15 21 Z M16 14 C 26 14, 27 23, 17 21 Z" fill="#d6f2c8" strokeWidth="1" />
      <line x1="16" y1="8" x2="16" y2="28" strokeWidth="2" />
      <path d="M15 7 l-4 -5 M17 7 l4 -5" strokeWidth="0.9" />
    </g>
  ),
  Ephemeroptera: (
    <g stroke="currentColor" strokeLinecap="round" fill="none">
      <path d="M8 18 Q 14 20 20 16" strokeWidth="2.4" />
      <path d="M13 18 L 16 4 L 21 15 Z" fill="#efe5c8" strokeWidth="1" />
      <path d="M20 16 Q 26 14 30 6 M20 16 Q 27 17 31 12 M20 16 Q 25 20 30 19" strokeWidth="0.8" />
      <circle cx="7" cy="18" r="1.8" fill="currentColor" />
    </g>
  ),
};

export function OrderIcon({ order, size = 28, color }: { order: OrderName; size?: number; color?: string }) {
  const emoji = ORDER_EMOJI[order];
  if (emoji)
    return (
      <span className="emoji" role="img" aria-label={order} style={{ fontSize: size * 0.9 }}>
        {emoji}
      </span>
    );
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label={order} style={{ color: color ?? '#3b3024' }}>
      {ORDER_SVG[order]}
    </svg>
  );
}

const FOLIAGE: Record<PlantForm, string> = {
  tree: '🌳',
  bush: '🌿',
  vine: '🌿',
  patch: '☘️',
  cactus: '🌵',
  palm: '🌴',
};

/** Layered emoji sprite for a plant at a given growth stage. */
export function PlantSprite({ kind, stage }: { kind: string; stage: 'seed' | 'sprout' | 'flowering' | 'ripe' }) {
  const def = PLANT_BY_ID[kind];
  if (stage === 'seed') return <span className="sprite sprite-seed emoji">🌱</span>;
  if (stage === 'sprout') return <span className="sprite sprite-sprout emoji">🌱</span>;
  return (
    <span className={`sprite sprite-${stage}`}>
      <span className="emoji foliage">{FOLIAGE[def.form]}</span>
      {stage === 'flowering' ? (
        <>
          <span className="emoji blossom b1">🌸</span>
          <span className="emoji blossom b2">🌼</span>
        </>
      ) : (
        <>
          <span className="fruit f1"><FruitIcon id={kind} size={22} /></span>
          <span className="fruit f2"><FruitIcon id={kind} size={22} /></span>
          <span className="fruit f3"><FruitIcon id={kind} size={22} /></span>
        </>
      )}
    </span>
  );
}
