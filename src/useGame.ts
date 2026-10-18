import { useEffect, useReducer, useRef } from 'react';
import { SAVE_KEY, deserialize, reducer, serialize, type Action, type GameState } from './game/state';

function readSave(): string | null {
  try {
    return localStorage.getItem(SAVE_KEY);
  } catch {
    return null;
  }
}

function writeSave(s: GameState) {
  try {
    localStorage.setItem(SAVE_KEY, serialize(s));
  } catch {
    /* storage unavailable: play without saving */
  }
}

export function useGame(): [GameState, (a: Action) => void] {
  const [state, dispatch] = useReducer(reducer, undefined, () => deserialize(readSave(), Date.now()));
  const latest = useRef(state);
  latest.current = state;

  // Game clock.
  useEffect(() => {
    const id = setInterval(() => dispatch({ type: 'tick', now: Date.now() }), 1000);
    return () => clearInterval(id);
  }, []);

  // Autosave every few seconds and whenever the page is hidden.
  useEffect(() => {
    const save = () => writeSave(latest.current);
    const id = setInterval(save, 5000);
    const onHide = () => document.visibilityState === 'hidden' && save();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', save);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', save);
    };
  }, []);

  // Notices fade out on their own.
  useEffect(() => {
    if (state.notices.length === 0) return;
    const oldest = state.notices[0];
    const id = setTimeout(() => dispatch({ type: 'dismissNotice', id: oldest.id }), 3800);
    return () => clearTimeout(id);
  }, [state.notices]);

  return [state, dispatch];
}
