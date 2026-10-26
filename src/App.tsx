import { useEffect, useRef, useState } from 'react';
import { BUGS, BUG_BY_ID } from './game/bugs';
import { BugModal } from './components/BugBits';
import { AwaySummary } from './components/AwaySummary';
import { Bugdex } from './components/Bugdex';
import { GoldenButterfly } from './components/GoldenButterfly';
import { Journal } from './components/Journal';
import { Garden } from './components/Garden';
import { Market } from './components/Market';
import { Shed } from './components/Shed';
import { Summon } from './components/Summon';
import { formatNum } from './format';
import { modifiers, type GameState } from './game/state';
import { useGame } from './useGame';

type Tab = 'garden' | 'shed' | 'summon' | 'dex' | 'market' | 'journal';

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'garden', icon: '🌱', label: 'Garden' },
  { id: 'shed', icon: '🛖', label: 'Shed' },
  { id: 'summon', icon: '🎰', label: 'Summon' },
  { id: 'dex', icon: '📖', label: 'Bugdex' },
  { id: 'market', icon: '🧺', label: 'Market' },
  { id: 'journal', icon: '📜', label: 'Journal' },
];

/** Coins earned per second over the last half-minute (spending doesn't count against it). */
function useIncomeRate(state: GameState) {
  const samples = useRef<{ t: number; earned: number }[]>([]);
  const [rate, setRate] = useState(0);
  useEffect(() => {
    const list = samples.current;
    list.push({ t: state.lastTick, earned: state.stats.coinsEarned });
    while (list.length > 2 && state.lastTick - list[0].t > 30_000) list.shift();
    const first = list[0];
    const dt = (state.lastTick - first.t) / 1000;
    setRate(dt >= 5 ? (state.stats.coinsEarned - first.earned) / dt : 0);
  }, [state.lastTick, state.stats.coinsEarned]);
  return rate;
}

export default function App() {
  const [state, dispatch] = useGame();
  const [tab, setTab] = useState<Tab>('garden');
  const [openBug, setOpenBug] = useState<string | null>(null);

  const owned = Object.keys(state.collection).length;
  const fruitCount = Object.values(state.fruits).reduce((a, b) => a + b, 0);
  const ripe = state.plots.filter((p) => p.plant && p.plant.growth >= 1).length;
  const income = useIncomeRate(state);

  return (
    <div className="app">
      <header className="topbar">
        <h1>
          <span className="emoji">🐞</span> Bug Garden
        </h1>
        <div className="stats">
          <span className="stat" title={`${Math.floor(state.coins)} coins`}>
            🪙 {formatNum(state.coins)}
            {income > 0 && <span className="rate">+{income < 10 ? income.toFixed(1) : formatNum(income)}/s</span>}
          </span>
          <span className="stat" title="Fertilizer">🧪 {state.fertilizer}</span>
          <span className="stat" title="Compost">🍂 {formatNum(state.compost)}</span>
          {state.season.goldenSeeds > 0 && (
            <span className="stat" title={`Season ${state.season.number}: Golden Seeds`}>
              🌟 {state.season.goldenSeeds}
            </span>
          )}
          <span className="stat" title="Species discovered">
            📖 {owned}/{BUGS.length}
          </span>
        </div>
      </header>

      <nav className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            <span className="emoji">{t.icon}</span> {t.label}
            {t.id === 'garden' && ripe > 0 && <span className="dot">{ripe}</span>}
            {t.id === 'summon' && fruitCount > 0 && <span className="dot">{fruitCount}</span>}
          </button>
        ))}
      </nav>

      <main>
        {tab === 'garden' && <Garden state={state} dispatch={dispatch} />}
        {tab === 'shed' && <Shed state={state} dispatch={dispatch} />}
        {tab === 'summon' && <Summon state={state} dispatch={dispatch} onOpenBug={setOpenBug} />}
        {tab === 'dex' && <Bugdex state={state} dispatch={dispatch} onOpenBug={setOpenBug} />}
        {tab === 'market' && <Market state={state} dispatch={dispatch} />}
        {tab === 'journal' && <Journal state={state} dispatch={dispatch} />}
      </main>

      <footer className="footer muted tiny">
        Species descriptions, photos and conservation statuses from{' '}
        <a href="https://en.wikipedia.org" target="_blank" rel="noreferrer">
          Wikipedia
        </a>{' '}
        (CC BY-SA). Progress saves in this browser.
      </footer>

      <GoldenButterfly state={state} dispatch={dispatch} />
      {state.awaySummary && <AwaySummary summary={state.awaySummary} offlineSeconds={modifiers(state).offlineSeconds} dispatch={dispatch} />}

      {openBug && BUG_BY_ID[openBug] && (
        <BugModal bug={BUG_BY_ID[openBug]} state={state} dispatch={dispatch} onClose={() => setOpenBug(null)} />
      )}

      <div className="toasts" aria-live="polite">
        {state.notices.map((n) => (
          <div key={n.id} className={`toast ${n.kind}`} onClick={() => dispatch({ type: 'dismissNotice', id: n.id })}>
            {n.text}
          </div>
        ))}
      </div>
    </div>
  );
}
