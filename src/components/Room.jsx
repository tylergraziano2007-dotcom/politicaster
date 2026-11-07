import { useEffect, useState } from 'react';
import { watchRoom, setReady, leaveRoom, updateSettings, claimHostIfNeeded, setPlayerChoice } from '../net/rooms.js';
import Match from './Match.jsx';

const MODES = [
  ['versus', 'Versus', 'Everyone runs their own candidate.', true],
  ['coop', 'Co-op', 'One shared campaign with staff roles. Coming soon.', false],
  ['teams', 'Teams', 'Two co-op teams face off. Coming soon.', false],
];
const PARTIES = [['D', 'Democratic', 'var(--dem)'], ['R', 'Republican', 'var(--rep)'], ['C', 'Own party', 'var(--alt1)']];

export default function Room({ code, uid, onLeave }) {
  const [room, setRoom] = useState(null);

  useEffect(() => watchRoom(code, (r) => {
    setRoom(r);
    if (r) claimHostIfNeeded(code, r, uid);
  }), [code, uid]);

  if (!room) return <div className="wrap"><p className="muted">Connecting to room {code}…</p></div>;
  const me = room.players && room.players[uid];
  if (!me) return <div className="wrap"><p>You’re no longer in this room.</p><button className="btn" onClick={onLeave}>Back</button></div>;
  if (room.meta.status !== 'lobby') return <Match code={code} uid={uid} room={room} onLeave={onLeave} />;

  const isHost = room.meta.hostUid === uid;
  const players = Object.entries(room.players || {}).sort((a, b) => a[1].seat - b[1].seat);
  const prims = room.meta.settings.primaries !== false;
  const takenBy = (party) => !prims && players.find(([id, p]) => p.party === party && id !== uid);
  const dupes = !prims && ['D', 'R'].some((pt) => players.filter(([, p]) => p.party === pt).length > 1);
  const everyoneReady = players.length >= 2 && players.every(([, p]) => p.ready && p.connected && p.party);
  const canStart = isHost && everyoneReady && !dupes;
  const set = (fields) => isHost && updateSettings(code, fields);
  const startMsg = players.length < 2 ? 'Need at least 2 players' : dupes ? 'Two players picked the same party (turn primaries on, or pick different parties)' : !players.every(([, p]) => p.party) ? 'Everyone needs to pick a party' : !everyoneReady ? 'Waiting for everyone to be ready' : 'Start game';

  return (
    <div className="wrap lobby">
      <div className="brand">Politicaster</div>
      <div className="room-head">
        <h1 className="lobby-title">Room <span className="room-code">{code}</span></h1>
        <button className="btn sm" onClick={() => navigator.clipboard && navigator.clipboard.writeText(code)}>Copy code</button>
      </div>
      <div className="lobby-grid">
        <div className="panel">
          <h3>Players ({players.length} of {room.meta.settings.maxPlayers})</h3>
          {players.map(([id, p]) => (
            <div key={id} className="player-row">
              <span className={`dot ${p.connected ? 'on' : 'off'}`} aria-hidden="true" />
              <b>{p.name}</b>
              {id === room.meta.hostUid && <small className="tagchip">Host</small>}
              {id === uid && <small className="muted">(you)</small>}
              {p.party && <small className="party-chip" style={{ background: PARTIES.find((x) => x[0] === p.party)[2] }}>{PARTIES.find((x) => x[0] === p.party)[1]}</small>}
              <span className={p.ready ? 'up' : 'muted'} style={{ marginLeft: 'auto' }}>{!p.connected ? 'Disconnected' : p.ready ? 'Ready' : 'Not ready'}</span>
            </div>
          ))}
          <div className="field" style={{ marginBottom: 0 }}>
            <span className="lab">Your party</span>
            <div className="seg">
              {PARTIES.map(([k, n]) => {
                const t = k !== 'C' && takenBy(k);
                return <button key={k} className={me.party === k ? 'on' : ''} disabled={!!t} title={t ? `${t[1].name} already picked this` : ''} onClick={() => setPlayerChoice(code, uid, { party: k, ready: false })}>{n}{t ? ' (taken)' : ''}</button>;
              })}
            </div>
            <p className="muted" style={{ fontSize: 13, margin: '6px 0 0' }}>{prims ? 'Players in the same party face off in its primary, along with AI rivals. Own-party players skip the primary and gather ballot signatures.' : 'With primaries off, one player per major party. Any number can start their own party.'} AI candidates fill any major party nobody picks.</p>
          </div>
          <button className={`btn ${me.ready ? '' : 'chy'}`} style={{ marginTop: 12 }} disabled={!me.party} onClick={() => setReady(code, uid, !me.ready)}>{me.ready ? 'Not ready' : 'I’m ready'}</button>
        </div>
        <div className="panel">
          <h3>Game settings</h3>
          {!isHost && <p className="muted">Only the host can change these.</p>}
          <div className="opts" style={{ marginBottom: 12 }}>
            {MODES.map(([k, n, d, live]) => (
              <button key={k} className={`opt ${room.meta.mode === k ? 'on' : ''}`} disabled={!isHost || !live} onClick={() => set({ mode: k })}><b>{n}</b><small>{d}</small></button>
            ))}
          </div>
          <div className="seg" style={{ marginRight: 8 }}>
            {['easy', 'normal', 'hard'].map((d) => <button key={d} className={room.meta.settings.diff === d ? 'on' : ''} disabled={!isHost} onClick={() => set({ 'settings/diff': d })}>{d[0].toUpperCase() + d.slice(1)}</button>)}
          </div>
          <div className="seg">
            {['quick', 'standard'].map((p) => <button key={p} className={room.meta.settings.pace === p ? 'on' : ''} disabled={!isHost} onClick={() => set({ 'settings/pace': p })}>{p[0].toUpperCase() + p.slice(1)}</button>)}
          </div>
          <div className="seg" style={{ marginTop: 8 }}>
            <button className={prims ? 'on' : ''} disabled={!isHost} onClick={() => set({ 'settings/primaries': true })}>Primaries on</button>
            <button className={!prims ? 'on' : ''} disabled={!isHost} onClick={() => set({ 'settings/primaries': false })}>Skip to the general</button>
          </div>
          <p className="muted" style={{ fontSize: 13 }}>Debates are live: everyone needs to be online for them. Anyone who isn’t gets an automatic answer.</p>
        </div>
      </div>
      <div className="setup-nav">
        <button className="btn" onClick={async () => { await leaveRoom(code, uid); onLeave(); }}>Leave room</button>
        {isHost ? <button className="btn chy" disabled={!canStart} onClick={() => updateSettings(code, { status: 'setup' })}>{startMsg}</button> : <span className="muted">{everyoneReady ? 'Waiting for the host to start' : 'Waiting for everyone to be ready'}</span>}
      </div>
    </div>
  );
}
