import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { formatNum } from '../format';
import { ORDER_INFO } from '../game/bugs';
import { cellId } from '../game/garden';
import { PLANTS, PLANT_BY_ID, SEED_TIER_NAMES, QUALITY_LABEL } from '../game/plants';
import {
  SOAK_GROWTH,
  SOAK_SECONDS,
  areaCells,
  countFruit,
  level,
  modifiers,
  type Modifiers,
  DIG_CONFIRM_MS,
  GRID_COLS,
  MAX_PLOTS,
  TOPDRESS_COMPOST,
  TOPDRESS_VIGOR,
  VIGOR_FLOOR,
  careRatio,
  expectedYield,
  growthRate,
  isRipe,
  landPrice,
  nextLand,
  qualityFor,
  stageOf,
  type Action,
  type GameState,
  type Plot,
  type Tool,
} from '../game/state';
import { Bubble } from './Bubble';
import { FruitIcon, PlantSprite } from './Icons';

const square = (n: number) => (n > 1 ? ` in a ${n}×${n} square` : '');

function toolHints(m: Modifiers): { id: Tool; icon: string; label: string; hint: string }[] {
  return [
    {
      id: 'tend',
      icon: '✋',
      label: 'Tend',
      hint: 'Does whatever the plot needs most: harvest, plant or water. Drag weeds to pull them, or Tab to a weed and press Enter.',
    },
    {
      id: 'water',
      icon: '💧',
      label: 'Water',
      hint: `Water${square(m.waterReach)}. Hand-watering soaks plots: +${Math.round((SOAK_GROWTH - 1) * 100)}% growth for ${SOAK_SECONDS}s. Dry plants barely grow.`,
    },
    { id: 'fertilize', icon: '🧪', label: 'Fertilize', hint: 'Faster growth for 90s, and needed for Perfect fruit.' },
    { id: 'harvest', icon: '🧺', label: 'Harvest', hint: `Pick ripe fruit${square(m.harvestReach)}.` },
  ];
}

/** The plots a tool would touch if used on `plot`, for the hover/focus preview. */
function reachOf(tool: Tool, plot: Plot, m: Modifiers): number {
  if (tool === 'water') return m.waterReach;
  if (tool === 'harvest') return m.harvestReach;
  if (tool === 'tend' && plot.plant) return isRipe(plot.plant) ? m.harvestReach : m.waterReach;
  return 1;
}

function formatSecs(s: number) {
  if (!isFinite(s)) return '—';
  if (s < 60) return `${Math.ceil(s)}s`;
  return `${Math.floor(s / 60)}m ${Math.ceil(s % 60)}s`;
}

/** How far (px) a weed must be dragged before it comes out of the soil. */
const PULL_DISTANCE = 22;
/** How far a weed visually stretches while being tugged. */
const MAX_TUG = 14;
const WEED_SLOTS = 3;

const KEY_PULL_MESSAGES = ['Still stuck. Keep pulling!', 'It budged. Keep pulling!', 'Almost out. Keep pulling!'];

/**
 * A single weed. Press and drag it a little to pull it out, or focus it and press Enter.
 * With the keyboard, a weed takes 1–4 tugs (random per weed) to come out.
 */
function Weed({ slot, onPull, onTap }: { slot: number; onPull: (byKeyboard: boolean) => void; onTap: () => void }) {
  const drag = useRef<{ x: number; y: number; id: number } | null>(null);
  const [tug, setTug] = useState<{ x: number; y: number } | null>(null);
  const [wiggles, setWiggles] = useState(0);
  const [tugsNeeded] = useState(() => 1 + Math.floor(Math.random() * 4));
  const [tugs, setTugs] = useState(0);

  const keyTug = () => {
    const done = tugs + 1;
    if (done >= tugsNeeded) {
      onPull(true);
      return;
    }
    setTugs(done);
    setWiggles((w) => w + 1);
  };
  const status = tugs > 0 ? KEY_PULL_MESSAGES[Math.min(tugs - 1, KEY_PULL_MESSAGES.length - 1)] : null;

  const release = (e: ReactPointerEvent<HTMLSpanElement>, cancelled = false) => {
    if (drag.current?.id !== e.pointerId) return;
    drag.current = null;
    setTug(null);
    // Let go before it came out: wiggle as a hint that it needs a pull...
    setWiggles((w) => w + 1);
    // ...and treat it as a tap on the plot underneath (water, harvest...). The wiggle replaces the
    // pressed element, so the browser never sends a click; handle the tap here instead.
    if (!cancelled) onTap();
  };

  return (
    // The bubble sits beside the button, not inside it: a button's contents are flattened for screen readers.
    <span className={`weed-spot w${slot}`}>
      <span
        className={`weed${tug ? ' tugging' : ''}${tugs > 0 ? ' loosening' : ''}`}
        role="button"
        tabIndex={0}
        aria-label="Weed. Press Enter to pull."
        title="Drag to pull this weed (or focus it and press Enter)"
        style={tug ? { ['--tx' as string]: `${tug.x}px`, ['--ty' as string]: `${tug.y}px` } : undefined}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          e.stopPropagation();
          if (!e.repeat) keyTug();
        }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.stopPropagation();
          // preventDefault stops text selection, but also the browser's focus-on-click,
          // so focus by hand: a click then Enter/Space should keep tugging this weed.
          e.preventDefault();
          e.currentTarget.focus({ preventScroll: true });
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
          setTug({ x: 0, y: 0 });
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (d?.id !== e.pointerId) return;
          const dx = e.clientX - d.x;
          const dy = e.clientY - d.y;
          const dist = Math.hypot(dx, dy);
          if (dist >= PULL_DISTANCE) {
            drag.current = null;
            onPull(false);
            return;
          }
          const k = Math.min(0.6, MAX_TUG / PULL_DISTANCE);
          setTug({ x: dx * k, y: dy * k });
        }}
        onPointerUp={release}
        onPointerCancel={(e) => release(e, true)}
      >
        <span key={wiggles} className={`emoji${wiggles ? ' wiggle' : ''}`} aria-hidden>
          🌾
        </span>
      </span>
      {status && <Bubble text={status} />}
    </span>
  );
}

/**
 * Keeps each weed in the spot it sprouted in, so pulling one doesn't make the others jump.
 * The game only tracks a weed count per plot; slots are purely visual.
 */
function useWeedSlots(count: number) {
  const slots = useRef<number[]>([]);
  const cur = slots.current.slice(0, count);
  for (let i = 0; cur.length < count && i < WEED_SLOTS; i++) if (!cur.includes(i)) cur.push(i);
  slots.current = cur;
  return {
    slots: cur,
    remove: (slot: number) => {
      slots.current = slots.current.filter((s) => s !== slot);
    },
  };
}

function PlotTile({
  plot,
  selected,
  now,
  onClick,
  onPullWeed,
  onPreview,
  inReach,
  irrigated,
}: {
  plot: Plot;
  selected: boolean;
  now: number;
  onClick: () => void;
  onPullWeed: () => void;
  /** Called with true when the plot is hovered or focused, false when left. */
  onPreview: (on: boolean) => void;
  inReach: boolean;
  irrigated: boolean;
}) {
  const plant = plot.plant;
  const stage = plant ? stageOf(plant) : null;
  const wet = plot.moisture > 0;
  const fertilized = plant && plant.fertilizedUntil > now;
  const soaked = wet && plot.soakedUntil > now;
  const weeds = useWeedSlots(plot.weeds);
  const [uprooted, setUprooted] = useState<{ slot: number; key: number }[]>([]);
  const wrap = useRef<HTMLDivElement>(null);

  const pull = (slot: number, byKeyboard: boolean) => {
    weeds.remove(slot);
    const key = Date.now() + Math.random();
    setUprooted((u) => [...u, { slot, key }]);
    window.setTimeout(() => setUprooted((u) => u.filter((x) => x.key !== key)), 1300);
    onPullWeed();
    if (byKeyboard) {
      // The focused weed is gone; keep keyboard focus on this plot (next weed, else the plot itself).
      window.setTimeout(() => {
        const next = wrap.current?.querySelector<HTMLElement>('.weed[tabindex]') ?? wrap.current?.querySelector<HTMLElement>('.plot');
        next?.focus();
      });
    }
  };

  return (
    <div
      className={`plot-wrap${inReach ? ' in-reach' : ''}`}
      ref={wrap}
      onMouseEnter={() => onPreview(true)}
      onMouseLeave={() => onPreview(false)}
      onFocus={() => onPreview(true)}
      onBlur={() => onPreview(false)}
    >
      <button
        className={`plot ${wet ? 'wet' : 'dry'} ${selected ? 'selected' : ''} ${stage === 'ripe' ? 'ripe' : ''}${soaked ? ' soaked' : ''}${irrigated ? ' irrigated' : ''}`}
        onClick={onClick}
        aria-label={[
          plant ? `${PLANT_BY_ID[plant.kind].plantName}, ${stage}` : 'Empty plot',
          soaked && 'soaked',
          irrigated && 'irrigated',
        ]
          .filter(Boolean)
          .join(', ')}
      >
        <span className="soil" style={{ opacity: 0.35 + plot.moisture * 0.65 }} />
        {plant && stage && <PlantSprite kind={plant.kind} stage={stage} />}
        {fertilized && <span className="badge-fert emoji">✨</span>}
        {plant && !wet && stage !== 'ripe' && <span className="badge-dry">thirsty</span>}
        {plant && (
          <span className="growbar">
            <span style={{ width: `${Math.round(plant.growth * 100)}%` }} />
          </span>
        )}
        <span className="moisture" style={{ height: `${plot.moisture * 100}%` }} />
      </button>
      {/* Weeds sit over the plot rather than inside the button so they can be grabbed, dragged and focused. */}
      {weeds.slots.map((slot) => (
        <Weed key={slot} slot={slot} onPull={(byKeyboard) => pull(slot, byKeyboard)} onTap={onClick} />
      ))}
      {uprooted.map((u) => (
        <span key={u.key} className={`weed-spot w${u.slot} uprooted`}>
          <span className="weed" aria-hidden>
            <span className="emoji">🌾</span>
            <span className="dirt" />
          </span>
          <Bubble text="Pulled out! +1 compost" tone="good" />
        </span>
      ))}
    </div>
  );
}

function BarrowPanel({ state, capacity, dispatch }: { state: GameState; capacity: number; dispatch: (a: Action) => void }) {
  const n = countFruit(state.barrow);
  const full = n >= capacity;
  return (
    <section className={`panel barrow${full ? ' full' : ''}`}>
      <div className="panel-head">
        <h3>🛒 Wheelbarrow</h3>
        <span className="muted small">
          {n}/{capacity}
        </span>
      </div>
      <div className="meter" role="progressbar" aria-label="Wheelbarrow" aria-valuemin={0} aria-valuemax={capacity} aria-valuenow={n}>
        <span style={{ width: `${Math.min(100, (n / capacity) * 100)}%` }} />
      </div>
      <p className="muted small">{full ? 'Full! It has stopped picking until you empty it.' : 'Picks ripe plants on its rounds.'}</p>
      <button className="btn small primary" disabled={n === 0} onClick={() => dispatch({ type: 'emptyBarrow', now: Date.now() })}>
        Tip {n} fruit into the basket
      </button>
    </section>
  );
}

/** Digging up loses the plant, so it takes a second press within a few seconds to confirm. */
function DigUpButton({ onDig }: { onDig: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), DIG_CONFIRM_MS);
    return () => window.clearTimeout(t);
  }, [armed]);
  return (
    <span className="bubble-anchor">
      <button
        className={`btn small${armed ? ' danger armed' : ''}`}
        onClick={() => {
          if (!armed) return setArmed(true);
          setArmed(false);
          onDig();
        }}
      >
        🪏 {armed ? 'Press again to dig up' : 'Dig up'}
      </button>
      {armed && <Bubble text="Press again to dig it up for good" />}
    </span>
  );
}

function PlotDetails({
  plot,
  now,
  compost,
  dispatch,
}: {
  plot: Plot | undefined;
  now: number;
  compost: number;
  dispatch: (a: Action) => void;
}) {
  if (!plot) return <p className="muted">Click a plot to tend it.</p>;
  const plant = plot.plant;
  if (!plant)
    return (
      <div className="details">
        <h4>Empty plot</h4>
        <p className="muted">
          {plot.weeds > 0
            ? `${plot.weeds} weed${plot.weeds > 1 ? 's' : ''} to pull before planting. Drag a weed (or focus it and press Enter) to pull it.`
            : 'Ready for a seed.'}
        </p>
      </div>
    );
  const def = PLANT_BY_ID[plant.kind];
  const rate = growthRate(plot, now);
  const eta = isRipe(plant) ? 0 : (1 - plant.growth) / rate;
  const quality = qualityFor(plant);
  return (
    <div className="details">
      <h4>
        <FruitIcon id={def.id} size={22} /> {def.plantName}
      </h4>
      <dl>
        <dt>Stage</dt>
        <dd>{stageOf(plant)}</dd>
        <dt>Growth</dt>
        <dd>{Math.floor(plant.growth * 100)}%{!isRipe(plant) && <span className="muted"> · ripe in ~{formatSecs(eta)}</span>}</dd>
        <dt>Moisture</dt>
        <dd>{Math.round(plot.moisture * 100)}%</dd>
        <dt>Weeds</dt>
        <dd>
          {plot.weeds}
          {plot.weeds > 0 && <span className="muted"> · drag to pull</span>}
        </dd>
        <dt>Care</dt>
        <dd>
          {Math.round(careRatio(plant) * 100)}% · <span className={`q-${quality}`}>{QUALITY_LABEL[quality]} fruit</span>
        </dd>
        <dt>Fertilizer</dt>
        <dd>
          {plant.fertilizedUntil > now
            ? `active ${formatSecs((plant.fertilizedUntil - now) / 1000)}`
            : plant.fertilizedThisCycle
              ? 'used this cycle'
              : 'none'}
        </dd>
        <dt>Vigor</dt>
        <dd>
          {Math.round(plant.vigor * 100)}%
          <span className="muted"> · ~{expectedYield(plant).toFixed(1)} fruit next harvest</span>
        </dd>
        <dt>Harvests</dt>
        <dd>{plant.harvests}</dd>
      </dl>
      {!plant.fertilizedThisCycle && !isRipe(plant) && (
        <p className="tip">Tip: keep it watered and weed-free and fertilize it for Perfect fruit.</p>
      )}
      {plant.vigor <= VIGOR_FLOOR + 0.001 && (
        <p className="tip">This plant is worn out. Top-dress it with compost, or dig it up and replant.</p>
      )}
      <div className="row plot-actions">
        <button
          className="btn small"
          disabled={plant.vigor >= 1 || compost < TOPDRESS_COMPOST}
          onClick={() => dispatch({ type: 'topDress', plotId: plot.id, now: Date.now() })}
        >
          🍂 Top-dress: +{Math.round(TOPDRESS_VIGOR * 100)}% vigor for {TOPDRESS_COMPOST} compost
        </button>
        <DigUpButton onDig={() => dispatch({ type: 'digUp', plotId: plot.id, now: Date.now() })} />
      </div>
    </div>
  );
}

export function Garden({ state, dispatch }: { state: GameState; dispatch: (a: Action) => void }) {
  const [tool, setTool] = useState<Tool>('tend');
  const [seed, setSeed] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [previewed, setPreviewed] = useState<number | null>(null);
  const now = state.lastTick;
  const m = modifiers(state);
  const TOOLS = toolHints(m);
  const barrowLevel = level(state, 'barrow');
  const ripeCount = state.plots.filter((p) => p.plant && isRipe(p.plant)).length;

  const seedList = PLANTS.filter((p) => (state.seeds[p.id] ?? 0) > 0);
  const activeSeed = seed && (state.seeds[seed] ?? 0) > 0 ? seed : null;
  const onPlot = (plot: Plot) => {
    setSelected(plot.id);
    dispatch({ type: 'use', plotId: plot.id, tool, seed: activeSeed, now: Date.now() });
  };

  // Lay the garden out on its fixed grid: owned plots, the next plot for sale, and locked land.
  const byId = new Map(state.plots.map((p) => [p.id, p]));
  const land = nextLand(state.plots);
  const landCost = landPrice(state.plots.length);
  const rows = Math.max(...state.plots.map((p) => p.y + 1), land ? land.y + 1 : 0);

  // Highlight the square the current tool would reach from the hovered or focused plot.
  const previewPlot = previewed === null ? undefined : byId.get(previewed);
  const reach = previewPlot ? reachOf(tool, previewPlot, m) : 1;
  const inReach = new Set(previewPlot && reach > 1 ? areaCells(previewPlot.x, previewPlot.y, reach) : []);
  const irrigated = new Set(state.irrigatedRows);

  return (
    <div className="garden-layout">
      <section className="panel garden-panel">
        <div className="panel-head">
          <h2>Your garden</h2>
          <div className="row">
            <span className="muted small">
              {state.plots.length}/{MAX_PLOTS} plots
            </span>
            {barrowLevel > 0 && (
              <button className="btn small" disabled={ripeCount === 0} onClick={() => dispatch({ type: 'harvestAll', now: Date.now() })}>
                🧺 Harvest all{ripeCount > 0 ? ` (${ripeCount})` : ''}
              </button>
            )}
          </div>
        </div>
        <div className="plots">
          {Array.from({ length: rows * GRID_COLS }, (_, i) => {
            const x = i % GRID_COLS;
            const y = Math.floor(i / GRID_COLS);
            const plot = byId.get(cellId(x, y));
            if (plot)
              return (
                <PlotTile
                  key={plot.id}
                  plot={plot}
                  selected={plot.id === selected}
                  now={now}
                  onClick={() => onPlot(plot)}
                  onPullWeed={() => {
                    setSelected(plot.id);
                    dispatch({ type: 'pullWeed', plotId: plot.id, now: Date.now() });
                  }}
                  onPreview={(on) => setPreviewed((cur) => (on ? plot.id : cur === plot.id ? null : cur))}
                  inReach={inReach.has(plot.id)}
                  irrigated={irrigated.has(plot.y)}
                />
              );
            if (land && land.x === x && land.y === y)
              return (
                <button
                  key={`land-${i}`}
                  className="land for-sale"
                  disabled={state.coins < landCost}
                  onClick={() => dispatch({ type: 'buyLand', now: Date.now() })}
                  aria-label={`Buy this plot for ${landCost} coins`}
                >
                  <span className="emoji" aria-hidden>
                    🪧
                  </span>
                  <span>Buy land</span>
                  <span className="price">{formatNum(landCost)} 🪙</span>
                </button>
              );
            return <div key={`land-${i}`} className="land locked" aria-hidden />;
          })}
        </div>
      </section>

      <aside className="garden-side">
        {barrowLevel > 0 && <BarrowPanel state={state} capacity={m.barrowCapacity} dispatch={dispatch} />}
        <section className="panel">
          <h3>Tools</h3>
          <div className="tools">
            {TOOLS.map((t) => (
              <button
                key={t.id}
                className={`tool ${tool === t.id ? 'active' : ''}`}
                aria-pressed={tool === t.id}
                onClick={() => setTool(t.id)}
              >
                <span className="emoji">{t.icon}</span>
                <span>{t.label}</span>
                {t.id === 'fertilize' && <span className="count">{state.fertilizer}</span>}
              </button>
            ))}
          </div>
          <p className="muted small">{TOOLS.find((t) => t.id === tool)?.hint}</p>
        </section>

        <section className="panel">
          <h3>Seed pouch</h3>
          {seedList.length === 0 ? (
            <p className="muted">No seeds. Buy some at the market, or keep pulling weeds — seeds turn up in the soil.</p>
          ) : (
            <div className="seeds">
              {seedList.map((p) => (
                <button
                  key={p.id}
                  className={`seed ${activeSeed === p.id ? 'active' : ''}`}
                  onClick={() => {
                    setSeed(activeSeed === p.id ? null : p.id);
                    setTool('tend');
                  }}
                  title={`${p.plantName} — ${p.order ? `summons ${ORDER_INFO[p.order].label.toLowerCase()}` : 'summons any bug'}`}
                >
                  <FruitIcon id={p.id} size={24} />
                  <span className="seed-name">{p.fruitName}</span>
                  <span className={`tier-chip st-${p.seedTier}`}>{SEED_TIER_NAMES[p.seedTier]}</span>
                  <span className="count">×{state.seeds[p.id]}</span>
                </button>
              ))}
            </div>
          )}
          {activeSeed && <p className="muted small">Click an empty, weed-free plot to plant {PLANT_BY_ID[activeSeed].fruitName.toLowerCase()}.</p>}
        </section>

        <section className="panel">
          <h3>Plot</h3>
          <PlotDetails plot={state.plots.find((p) => p.id === selected)} now={now} compost={state.compost} dispatch={dispatch} />
        </section>
      </aside>
    </div>
  );
}
