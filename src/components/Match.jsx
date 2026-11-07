import { useEffect, useRef, useState } from 'react';
import { mountGame, unmountGame, Legacy } from '../game/legacy.js';
import { setPlayerChoice, updateSettings } from '../net/rooms.js';
import { publishState, watchState, submitCommands, watchCommands } from '../net/sync.js';
import { waitingOn } from '../engine/protocol.js';
import { addAiHeadlines } from '../ai/headlines.js';

/**
 * A versus match. Phases come from room.meta.status:
 *   setup   - everyone builds a candidate; the host creates the game when all are in
 *   playing - everyone plans each week; the host resolves when all have submitted
 */
export default function Match({ code, uid, room, onLeave }) {
  const el = useRef(null);
  const roomRef = useRef(room);
  const verRef = useRef(0);
  const stateRef = useRef(null);
  const cmdsRef = useRef({});
  const startedSetup = useRef(false);
  const creating = useRef(false);
  const resolvingVer = useRef(0);
  const [version, setVersion] = useState(0);
  const [waitingNames, setWaitingNames] = useState([]);
  const [error, setError] = useState('');

  roomRef.current = room;
  const me = room.players && room.players[uid];
  const isHost = room.meta.hostUid === uid;
  const status = room.meta.status;

  // Mount the game once.
  useEffect(() => {
    mountGame(el.current, {
      mp: {
        party: (me && me.party) || 'D',
        room: code,
        onSetupDone: (S) => setPlayerChoice(code, uid, { setup: JSON.stringify(S) }),
        onEndWeek: (payload) => submitCommands(code, verRef.current, uid, payload, true).catch((e) => setError(e.message)),
        onExit: onLeave,
      },
    });
    return () => unmountGame();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Setup: show the candidate builder until this player submits.
  useEffect(() => {
    if (status === 'setup' && me && !me.setup && !startedSetup.current) {
      startedSetup.current = true;
      Legacy.mp.startSetup(me.party || 'D', code);
    }
    if (status === 'setup' && me && me.setup) Legacy.mp.showWaitScreen();
  }, [status, me && me.setup]); // eslint-disable-line react-hooks/exhaustive-deps

  // Setup: waiting list, and the host creates the game once every connected player is ready.
  useEffect(() => {
    if (status !== 'setup') return;
    const players = Object.entries(room.players || {}).filter(([, p]) => p.connected);
    Legacy.mp.setWaiting(players.filter(([, p]) => !p.setup).map(([, p]) => p.name));
    if (!isHost || creating.current || !players.length || !players.every(([, p]) => p.setup)) return;
    creating.current = true;
    const entries = players.sort((a, b) => a[1].seat - b[1].seat).map(([id, p]) => ({ uid: id, name: p.name, setup: JSON.parse(p.setup) }));
    const seed = (Math.random() * 4294967296) | 0;
    try {
      const G = Legacy.mp.createMulti(entries, room.meta.settings, seed);
      publishState(code, G, 1).then(() => updateSettings(code, { status: 'playing' }));
    } catch (e) {
      creating.current = false;
      setError('Couldn’t start the game: ' + e.message);
    }
  }, [room, status, isHost]); // eslint-disable-line react-hooks/exhaustive-deps

  // Everyone: load each new published week from this player's seat.
  useEffect(() => watchState(code, ({ version: v, state }) => {
    if (v <= verRef.current) return;
    verRef.current = v;
    stateRef.current = state;
    const seat = Object.keys(state.seats || {}).find((s) => state.seats[s].uid === uid);
    if (seat) Legacy.mp.load(state, seat);
    setVersion(v);
  }), [code, uid]);

  // Host: resolve the week once everyone has submitted (or when forced).
  async function tryResolve(force) {
    const state = stateRef.current;
    const v = verRef.current;
    if (!state || state.phase === 'night' || resolvingVer.current === v) return;
    const cmds = cmdsRef.current;
    const waiting = waitingOn(roomRef.current.players, cmds);
    if (waiting.length && !force) return;
    resolvingVer.current = v;
    const logs = {};
    for (const s of state.humans) {
      const c = cmds[state.seats[s].uid];
      logs[s] = c && c.done && c.cmds ? { log: c.cmds.log || [], plan: c.cmds.plan || [] } : { log: [], plan: [] };
    }
    try {
      const next = await addAiHeadlines(Legacy.mp.resolveMulti(state, logs));
      await publishState(code, next, v + 1);
    } catch (e) {
      resolvingVer.current = 0;
      setError('Couldn’t resolve the week: ' + e.message);
    }
  }

  // Everyone: who are we waiting on? Host: resolve when complete.
  useEffect(() => {
    if (!version) return undefined;
    return watchCommands(code, version, (cmds) => {
      cmdsRef.current = cmds;
      const ids = waitingOn(roomRef.current.players, cmds);
      const names = ids.map((id) => roomRef.current.players[id] && roomRef.current.players[id].name).filter(Boolean);
      setWaitingNames(names);
      Legacy.mp.setWaiting(names);
      if (roomRef.current.meta.hostUid === uid) tryResolve(false);
    });
  }, [version, code]); // eslint-disable-line react-hooks/exhaustive-deps

  // If someone disconnects, the host may now be able to resolve.
  useEffect(() => { if (isHost && version) tryResolve(false); }, [room.players, isHost]); // eslint-disable-line react-hooks/exhaustive-deps

  const meDone = cmdsRef.current[uid] && cmdsRef.current[uid].done;
  return (
    <>
      <div ref={el} />
      {isHost && status === 'playing' && meDone && waitingNames.length > 0 && (
        <div className="host-ctrl">
          <span>Host controls</span>
          <button className="btn sm chy" onClick={() => tryResolve(true)}>Resolve week now</button>
          <small>Skips anyone still planning. Their week passes with no actions.</small>
        </div>
      )}
      {error && <div className="host-ctrl err-box" role="alert">{error}</div>}
    </>
  );
}
