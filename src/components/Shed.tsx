import { formatNum } from '../format';
import {
  GRID_ROWS,
  UPGRADES,
  UPGRADE_BY_ID,
  irrigationRowPrice,
  isUnlocked,
  level,
  nextCost,
  type Action,
  type GameState,
  type UpgradeDef,
} from '../game/state';

const CATEGORIES: { id: UpgradeDef['category']; title: string; blurb: string }[] = [
  { id: 'water', title: 'Watering', blurb: 'Bigger cans water and soak more plots at once. Then irrigation takes over the routine watering.' },
  { id: 'weed', title: 'Weeding', blurb: 'Weeds never stop coming. Pull more at once, cut them back, or spray, each with a trade-off.' },
  { id: 'harvest', title: 'Harvesting', blurb: 'Pick more at once, then let the wheelbarrow do the rounds.' },
  { id: 'soil', title: 'Soil & quality', blurb: 'Better tools for the ground, and higher quality fruit: more fruit per harvest, more luck, better prices.' },
  { id: 'market', title: 'Market', blurb: 'Turn spare fruit into coins without lifting a finger.' },
];

function UpgradeCard({ def, state, dispatch }: { def: UpgradeDef; state: GameState; dispatch: (a: Action) => void }) {
  const lv = level(state, def.id);
  const cost = nextCost(state, def.id);
  const unlocked = isUnlocked(state, def);
  const maxed = cost === null;
  const req = def.requires ? UPGRADE_BY_ID[def.requires.id] : null;
  return (
    <article className={`upgrade ${unlocked ? '' : 'locked'} ${maxed ? 'maxed' : ''}`}>
      <span className="upgrade-icon emoji" aria-hidden>
        {unlocked ? def.icon : '🔒'}
      </span>
      <div className="upgrade-body">
        <h4>
          {def.name}{' '}
          <span className="muted small">
            {lv}/{def.levels.length}
          </span>
        </h4>
        <p className="small">{def.summary}</p>
        <p className="small muted">
          {lv > 0 && <>Now: {def.levels[lv - 1].effect}. </>}
          {!maxed && unlocked && <>Next: {def.levels[lv].effect}.</>}
          {!unlocked && req && (
            <>
              Unlocks with {req.name} level {def.requires!.level} ({req.levels[def.requires!.level - 1].effect}).
            </>
          )}
        </p>
      </div>
      {maxed ? (
        <span className="tier-chip st-0">Maxed</span>
      ) : (
        <button
          className="btn small"
          disabled={!unlocked || state.coins < cost}
          onClick={() => dispatch({ type: 'buyUpgrade', id: def.id, now: Date.now() })}
          aria-label={`Buy ${def.name} level ${lv + 1}, ${def.levels[lv].effect}, for ${cost} coins`}
        >
          {formatNum(cost)} 🪙
        </button>
      )}
    </article>
  );
}

function IrrigationRows({ state, dispatch }: { state: GameState; dispatch: (a: Action) => void }) {
  const rows = Array.from({ length: GRID_ROWS }, (_, y) => y).filter((y) => state.plots.some((p) => p.y === y));
  const price = irrigationRowPrice(state.irrigatedRows.length);
  return (
    <div className="irrigation-rows">
      <h4>Drip lines</h4>
      <p className="small muted">The pump only waters rows with a drip line. Each new line costs more than the last.</p>
      <ul>
        {rows.map((y) => {
          const done = state.irrigatedRows.includes(y);
          return (
            <li key={y} className="supply">
              <span>Row {y + 1}</span>
              <span className="muted small">{state.plots.filter((p) => p.y === y).length} plots</span>
              {done ? (
                <span className="good small">💧 Irrigated</span>
              ) : (
                <button
                  className="btn small"
                  disabled={state.coins < price}
                  onClick={() => dispatch({ type: 'irrigateRow', row: y, now: Date.now() })}
                  aria-label={`Lay a drip line along row ${y + 1} for ${price} coins`}
                >
                  Lay line · {formatNum(price)} 🪙
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function Shed({ state, dispatch }: { state: GameState; dispatch: (a: Action) => void }) {
  return (
    <div className="shed">
      {CATEGORIES.map((c) => (
        <section key={c.id} className="panel">
          <h2>{c.title}</h2>
          <p className="muted small">{c.blurb}</p>
          <div className="upgrade-list">
            {UPGRADES.filter((u) => u.category === c.id).map((u) => (
              <UpgradeCard key={u.id} def={u} state={state} dispatch={dispatch} />
            ))}
          </div>
          {c.id === 'water' && level(state, 'pump') > 0 && <IrrigationRows state={state} dispatch={dispatch} />}
        </section>
      ))}
    </div>
  );
}
