import { ORDER_INFO } from '../game/bugs';
import { ACHIEVEMENTS, ACHIEVEMENT_BONUS, ORDER_BONUS, orderProgress, type GameState } from '../game/state';

export function Journal({ state }: { state: GameState }) {
  const progress = orderProgress(state.collection);
  const earned = ACHIEVEMENTS.filter((a) => state.achievements.includes(a.id)).length;
  return (
    <div className="journal">
      <section className="panel">
        <div className="panel-head">
          <h2>Bugdex bonuses</h2>
        </div>
        <p className="muted small">Every species you discover helps the garden. Completing an order adds +10% on top.</p>
        <div className="table-wrap">
          <table className="bonuses">
            <thead>
              <tr>
                <th>Order</th>
                <th>Helps with</th>
                <th className="num">Found</th>
                <th className="num">Bonus</th>
              </tr>
            </thead>
            <tbody>
              {progress.map((p) => (
                <tr key={p.order} className={p.owned === p.total ? 'complete' : ''}>
                  <td>
                    <strong>{ORDER_INFO[p.order].label}</strong>
                    <div className="muted tiny">{p.order}</div>
                  </td>
                  <td className="small">{ORDER_BONUS[p.order].label}</td>
                  <td className="num">
                    {p.owned}/{p.total}
                  </td>
                  <td className="num">{p.bonus > 0 ? `+${Math.round(p.bonus * 100)}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Achievements</h2>
          <span className="muted small">
            {earned}/{ACHIEVEMENTS.length} · +{Math.round(earned * ACHIEVEMENT_BONUS * 100)}% fruit yield
          </span>
        </div>
        <ul className="achievements">
          {ACHIEVEMENTS.map((a) => {
            const done = state.achievements.includes(a.id);
            return (
              <li key={a.id} className={done ? 'done' : ''}>
                <span className="emoji" aria-hidden>
                  {done ? a.icon : '🔒'}
                </span>
                <span>
                  <strong>{a.name}</strong>
                  <span className="muted small"> {a.desc}</span>
                  <span className="sr-only">{done ? ' Earned.' : ' Not yet earned.'}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
