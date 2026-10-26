import { useMemo } from 'react';
import { ORDER_INFO, bugsInOrder, rareShare } from '../game/bugs';
import {
  PLANTS,
  PLANT_BY_ID,
  QUALITIES,
  QUALITY_LABEL,
  SEED_PRICE,
  SEED_TIER_NAMES,
  parseFruitKey,
} from '../game/plants';
import {
  FERTILIZER_PRICE,
  HERBICIDE_PRICE,
  REGROW_FROM,
  SHOP_REFRESH_MS,
  SHOP_REFRESH_PRICE,
  STAPLE_SEEDS,
  modifiers,
  sellPrice,
  type Action,
  type GameState,
} from '../game/state';
import { FruitIcon } from './Icons';

function effectText(id: string) {
  const p = PLANT_BY_ID[id];
  if (p.order) return `Summons ${p.order}`;
  return p.luck > 0 ? `Any order · luck +${p.luck}` : 'Any order';
}

export function Market({ state, dispatch }: { state: GameState; dispatch: (a: Action) => void }) {
  const m = modifiers(state);
  const refreshIn = Math.max(0, SHOP_REFRESH_MS - (state.lastTick - state.shop.refreshedAt));
  const freeRefresh = refreshIn === 0;

  const fruitStacks = useMemo(
    () =>
      Object.entries(state.fruits)
        .map(([key, count]) => ({ key, count, parsed: parseFruitKey(key)! }))
        .filter((f) => f.parsed && f.count > 0),
    [state.fruits],
  );

  return (
    <div className="market">
      <section className="panel">
        <div className="panel-head">
          <h2>Seed stall</h2>
          <button className="btn small" onClick={() => dispatch({ type: 'refreshShop', now: Date.now() })} disabled={!freeRefresh && state.coins < SHOP_REFRESH_PRICE}>
            ↻ {freeRefresh ? 'Restock (free)' : `Restock now (${SHOP_REFRESH_PRICE} 🪙)`}
          </button>
        </div>
        <p className="muted small">
          New stock in {Math.floor(refreshIn / 60000)}:{String(Math.floor((refreshIn % 60000) / 1000)).padStart(2, '0')}. Rare seeds turn up less often.
        </p>
        <div className="shop-grid">
          {STAPLE_SEEDS.map((id) => (
            <div key={id} className="shop-item">
              <FruitIcon id={id} size={34} />
              <strong>{PLANT_BY_ID[id].fruitName} seed</strong>
              <span className="muted small">{effectText(id)}</span>
              <span className="muted tiny">Always in stock</span>
              <button className="btn small" disabled={state.coins < SEED_PRICE[PLANT_BY_ID[id].seedTier]} onClick={() => dispatch({ type: 'buySeed', plantId: id })}>
                Buy · {SEED_PRICE[PLANT_BY_ID[id].seedTier]} 🪙
              </button>
            </div>
          ))}
          {state.shop.slots.map((slot, i) => {
            const p = PLANT_BY_ID[slot.plantId];
            return (
              <div key={i} className={`shop-item ${slot.stock === 0 ? 'sold' : ''}`}>
                <span className={`tier-chip st-${p.seedTier}`}>{SEED_TIER_NAMES[p.seedTier]}</span>
                <FruitIcon id={p.id} size={34} />
                <strong>{p.fruitName} seed</strong>
                <span className="muted small">{effectText(p.id)}</span>
                <span className="muted tiny">{slot.stock > 0 ? `${slot.stock} left` : 'Sold out'}</span>
                <button className="btn small" disabled={slot.stock === 0 || state.coins < SEED_PRICE[p.seedTier]} onClick={() => dispatch({ type: 'buySlot', index: i })}>
                  Buy · {SEED_PRICE[p.seedTier]} 🪙
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <div className="market-row">
        <section className="panel">
          <h3>Garden supplies</h3>
          <div className="supply">
            <span>🧪 Fertilizer</span>
            <span className="muted small">You have {state.fertilizer}</span>
            <button className="btn small" disabled={state.coins < FERTILIZER_PRICE} onClick={() => dispatch({ type: 'buyFertilizer' })}>
              Buy · {FERTILIZER_PRICE} 🪙
            </button>
          </div>
          <div className="supply">
            <span>🍂 Compost → 🧪</span>
            <span className="muted small">
              {state.compost} compost ({m.compostPerFertilizer} per fertilizer)
            </span>
            <button className="btn small" disabled={state.compost < m.compostPerFertilizer} onClick={() => dispatch({ type: 'makeFertilizer' })}>
              Make fertilizer
            </button>
          </div>
          {m.canSpray && (
            <div className="supply">
              <span>🧴 Herbicide</span>
              <span className="muted small">You have {state.herbicide}</span>
              <button className="btn small" disabled={state.coins < HERBICIDE_PRICE} onClick={() => dispatch({ type: 'buyHerbicide' })}>
                Buy · {HERBICIDE_PRICE} 🪙
              </button>
            </div>
          )}
        </section>

        <section className="panel">
          <h3>Fruit stand</h3>
          {m.standRate > 0 && (
            <fieldset className="stand-config">
              <legend className="small">
                Sells {m.standRate} fruit/s automatically{m.sellMult > 1 && ` · reputation +${Math.round((m.sellMult - 1) * 100)}%`}
              </legend>
              {QUALITIES.map((q) => (
                <label key={q} className="small">
                  <input
                    type="checkbox"
                    checked={state.stand.qualities.includes(q)}
                    onChange={(e) =>
                      dispatch({
                        type: 'setStand',
                        qualities: e.target.checked ? [...state.stand.qualities, q] : state.stand.qualities.filter((x) => x !== q),
                      })
                    }
                  />{' '}
                  {QUALITY_LABEL[q]}
                </label>
              ))}
            </fieldset>
          )}
          {fruitStacks.length === 0 ? (
            <p className="muted">No fruit to sell.</p>
          ) : (
            <div className="sell-list">
              {fruitStacks.map(({ key, count, parsed }) => {
                const price = sellPrice(key, m);
                return (
                  <div key={key} className="supply">
                    <span>
                      <FruitIcon id={parsed.plant.id} size={22} /> {QUALITY_LABEL[parsed.quality]} {parsed.plant.fruitName} ×{count}
                    </span>
                    <span className="muted small">{price % 1 ? price.toFixed(2) : price} 🪙 each</span>
                    <span className="row">
                      <button className="btn small" onClick={() => dispatch({ type: 'sellFruit', key, count: 1 })}>
                        Sell 1
                      </button>
                      {count > 1 && (
                        <button className="btn small" onClick={() => dispatch({ type: 'sellFruit', key, count })}>
                          All
                        </button>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          <p className="muted tiny">Fruit is usually worth more in the capsule machine.</p>
        </section>
      </div>

      <section className="panel">
        <h3>Seed almanac</h3>
        <p className="muted small">
          Orders with a bigger share of threatened species (Vulnerable or worse on Wikipedia) have scarcer seeds — slower to grow,
          pricier, and less likely to drop.
        </p>
        <div className="table-wrap">
          <table className="almanac">
            <thead>
              <tr>
                <th>Fruit</th>
                <th>Summons</th>
                <th>Seed</th>
                <th className="num">Threatened share</th>
                <th className="num">Grow time</th>
                <th className="num">Regrows in</th>
              </tr>
            </thead>
            <tbody>
              {PLANTS.map((p) => (
                <tr key={p.id}>
                  <td>
                    <FruitIcon id={p.id} size={20} /> {p.fruitName}
                  </td>
                  <td>
                    {p.order ? (
                      <>
                        {p.order} <span className="muted">({ORDER_INFO[p.order].label.toLowerCase()}, {bugsInOrder(p.order).length} spp.)</span>
                      </>
                    ) : (
                      <>Any order{p.luck > 0 && <span className="muted"> · luck +{p.luck}</span>}</>
                    )}
                  </td>
                  <td>
                    <span className={`tier-chip st-${p.seedTier}`}>{SEED_TIER_NAMES[p.seedTier]}</span>
                  </td>
                  <td className="num">{p.order ? `${Math.round(rareShare(p.order) * 100)}%` : '—'}</td>
                  <td className="num">{Math.round(p.growTime)}s</td>
                  <td className="num">{Math.round(p.growTime * (1 - REGROW_FROM))}s</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel danger-zone">
        <h3>Settings</h3>
        <button
          className="btn small danger"
          onClick={() => {
            if (window.confirm('Start over? Your garden, fruit and Bugdex will be wiped.')) dispatch({ type: 'reset', now: Date.now() });
          }}
        >
          Reset game
        </button>
      </section>
    </div>
  );
}
