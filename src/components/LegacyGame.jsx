import { useEffect, useRef } from 'react';
import { mountGame, unmountGame } from '../game/legacy.js';

/** Hosts the single-player game, which renders itself into this container. */
export default function LegacyGame({ onMultiplayer }) {
  const el = useRef(null);
  useEffect(() => {
    mountGame(el.current, { onMultiplayer });
    return () => unmountGame();
  }, [onMultiplayer]);
  return <div ref={el} />;
}
