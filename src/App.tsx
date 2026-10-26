import { useState } from 'react';
import { BUGS, BUG_BY_ID } from './game/bugs';
import { BugModal } from './components/BugBits';
import { Bugdex } from './components/Bugdex';
import { Garden } from './components/Garden';
import { Market } from './components/Market';
import { Shed } from './components/Shed';
import { Summon } from './components/Summon';
import { formatNum } from './format';
import { useGame } from './useGame';

type Tab = 'garden' | 'shed' | 'summon' | 'dex' | 'market';

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'garden', icon: '🌱', label: 'Garden' },
  { id: 'shed', icon: '🛖', label: 'Shed' },
  { id: 'summon', icon: '🎰', label: 'Summon' },
  { id: 'dex', icon: '📖', label: 'Bugdex' },
  { id: 'market', icon: '🧺', label: 'Market' },
];

export default function App() {
  const [state, dispatch] = useGame();
  const [tab, setTab] = useState<Tab>('garden');
  const [openBug, setOpenBug] = useState<string | null>(null);

  const owned = Object.keys(state.collection).length;
  const fruitCount = Object.values(state.fruits).reduce((a, b) => a + b, 0);
  const ripe = state.plots.filter((p) => p.plant && p.plant.growth >= 1).length;

  return (
    <div className="app">
      <header className="topbar">
        <h1>
          <span className="emoji">🐞</span> Bug Garden
        </h1>
        <div className="stats">
          <span className="stat" title={`${state.coins} coins`}>🪙 {formatNum(state.coins)}</span>
          <span className="stat" title="Fertilizer">🧪 {state.fertilizer}</span>
          <span className="stat" title="Compost">🍂 {formatNum(state.compost)}</span>
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
      </main>

      <footer className="footer muted tiny">
        Species descriptions, photos and conservation statuses from{' '}
        <a href="https://en.wikipedia.org" target="_blank" rel="noreferrer">
          Wikipedia
        </a>{' '}
        (CC BY-SA). Progress saves in this browser.
      </footer>

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
