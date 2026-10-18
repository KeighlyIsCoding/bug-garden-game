import { useState } from 'react';
import { ORDER_INFO } from '../game/bugs';
import { PLANTS, PLANT_BY_ID, SEED_TIER_NAMES, QUALITY_LABEL } from '../game/plants';
import {
  careRatio,
  growthRate,
  isRipe,
  qualityFor,
  stageOf,
  type Action,
  type GameState,
  type Plot,
  type Tool,
} from '../game/state';
import { FruitIcon, PlantSprite } from './Icons';

const TOOLS: { id: Tool; icon: string; label: string; hint: string }[] = [
  { id: 'tend', icon: '✋', label: 'Tend', hint: 'Does whatever the plot needs most: harvest, weed, plant or water.' },
  { id: 'water', icon: '💧', label: 'Water', hint: 'Refill moisture. Dry plants barely grow.' },
  { id: 'weed', icon: '🌾', label: 'Weed', hint: 'Pull a weed. Weeds slow growth; pulled weeds become compost.' },
  { id: 'fertilize', icon: '🧪', label: 'Fertilize', hint: 'Faster growth for 90s, and needed for Perfect fruit.' },
  { id: 'harvest', icon: '🧺', label: 'Harvest', hint: 'Pick ripe fruit.' },
];

function formatSecs(s: number) {
  if (!isFinite(s)) return '—';
  if (s < 60) return `${Math.ceil(s)}s`;
  return `${Math.floor(s / 60)}m ${Math.ceil(s % 60)}s`;
}

function PlotTile({ plot, selected, now, onClick }: { plot: Plot; selected: boolean; now: number; onClick: () => void }) {
  const plant = plot.plant;
  const stage = plant ? stageOf(plant) : null;
  const wet = plot.moisture > 0;
  const fertilized = plant && plant.fertilizedUntil > now;
  return (
    <button
      className={`plot ${wet ? 'wet' : 'dry'} ${selected ? 'selected' : ''} ${stage === 'ripe' ? 'ripe' : ''}`}
      onClick={onClick}
      aria-label={plant ? `${PLANT_BY_ID[plant.kind].plantName}, ${stage}` : 'Empty plot'}
    >
      <span className="soil" style={{ opacity: 0.35 + plot.moisture * 0.65 }} />
      {Array.from({ length: plot.weeds }, (_, i) => (
        <span key={i} className={`weed emoji w${i}`}>🌾</span>
      ))}
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
  );
}

function PlotDetails({ plot, now }: { plot: Plot | undefined; now: number }) {
  if (!plot) return <p className="muted">Click a plot to tend it.</p>;
  const plant = plot.plant;
  if (!plant)
    return (
      <div className="details">
        <h4>Empty plot</h4>
        <p className="muted">
          {plot.weeds > 0 ? `${plot.weeds} weed${plot.weeds > 1 ? 's' : ''} to pull before planting.` : 'Ready for a seed.'}
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
        <dd>{plot.weeds}</dd>
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
        <dt>Harvests left</dt>
        <dd>{plant.harvestsLeft}</dd>
      </dl>
      {!plant.fertilizedThisCycle && !isRipe(plant) && (
        <p className="tip">Tip: keep it watered and weed-free and fertilize it for Perfect fruit.</p>
      )}
    </div>
  );
}

export function Garden({ state, dispatch }: { state: GameState; dispatch: (a: Action) => void }) {
  const [tool, setTool] = useState<Tool>('tend');
  const [seed, setSeed] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const now = state.lastTick;

  const seedList = PLANTS.filter((p) => (state.seeds[p.id] ?? 0) > 0);
  const activeSeed = seed && (state.seeds[seed] ?? 0) > 0 ? seed : null;
  const ripeCount = state.plots.filter((p) => p.plant && isRipe(p.plant)).length;

  const onPlot = (plot: Plot) => {
    setSelected(plot.id);
    dispatch({ type: 'use', plotId: plot.id, tool, seed: activeSeed, now: Date.now() });
  };

  return (
    <div className="garden-layout">
      <section className="panel garden-panel">
        <div className="panel-head">
          <h2>Your garden</h2>
          <div className="row">
            <button className="btn small" onClick={() => dispatch({ type: 'waterAll' })}>
              💧 Water all
            </button>
            <button className="btn small" disabled={ripeCount === 0} onClick={() => dispatch({ type: 'harvestAll', now: Date.now() })}>
              🧺 Harvest all{ripeCount > 0 ? ` (${ripeCount})` : ''}
            </button>
          </div>
        </div>
        <div className="plots" style={{ ['--cols' as string]: Math.min(4, Math.ceil(Math.sqrt(state.plots.length * 1.5))) }}>
          {state.plots.map((plot) => (
            <PlotTile key={plot.id} plot={plot} selected={plot.id === selected} now={now} onClick={() => onPlot(plot)} />
          ))}
        </div>
      </section>

      <aside className="garden-side">
        <section className="panel">
          <h3>Tools</h3>
          <div className="tools">
            {TOOLS.map((t) => (
              <button
                key={t.id}
                className={`tool ${tool === t.id ? 'active' : ''}`}
                onClick={() => setTool(t.id)}
                title={t.hint}
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
            <p className="muted">No seeds. Buy some at the market, or keep weeding — seeds turn up in the soil.</p>
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
          <PlotDetails plot={state.plots.find((p) => p.id === selected)} now={now} />
        </section>
      </aside>
    </div>
  );
}
