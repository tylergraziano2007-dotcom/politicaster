import { useState } from 'react';
import { createRoom, joinRoom } from '../net/rooms.js';
import { firebaseConfigured } from '../net/firebase.js';

export default function Lobby({ onBack, onEnter }) {
  const [name, setName] = useState(localStorage.getItem('politicaster.name') || '');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function go(kind) {
    if (!name.trim()) { setError('Enter your name first.'); return; }
    setBusy(true); setError('');
    localStorage.setItem('politicaster.name', name.trim());
    try {
      const room = kind === 'create' ? await createRoom(name.trim()) : await joinRoom(code, name.trim());
      onEnter(room);
    } catch (e) {
      setError(e.message || 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wrap lobby">
      <div className="brand">Politicaster</div>
      <h1 className="lobby-title">Play with friends</h1>
      <p className="muted">Up to four players. One person creates a room and shares the code; everyone else joins with it.</p>
      {!firebaseConfigured && (
        <div className="panel notice" role="alert">
          Multiplayer isn’t connected yet. Add your Firebase keys to <code>.env.local</code> and restart the dev server. The README walks through it.
        </div>
      )}
      <div className="field">
        <label htmlFor="pname">Your name</label>
        <input id="pname" type="text" maxLength={24} value={name} onChange={(e) => setName(e.target.value)} placeholder="Tyler" />
      </div>
      <div className="lobby-grid">
        <div className="panel">
          <h3>Start a room</h3>
          <p className="muted">You’ll be the host. The host’s browser runs the game for everyone.</p>
          <button className="btn chy" disabled={busy || !firebaseConfigured} onClick={() => go('create')}>Create room</button>
        </div>
        <div className="panel">
          <h3>Join a room</h3>
          <div className="field" style={{ margin: '0 0 10px' }}>
            <label htmlFor="rcode">Room code</label>
            <input id="rcode" type="text" maxLength={5} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="K7QMX" className="code-input" />
          </div>
          <button className="btn primary" disabled={busy || !firebaseConfigured || code.trim().length !== 5} onClick={() => go('join')}>Join room</button>
        </div>
      </div>
      {error && <p className="err" role="alert">{error}</p>}
      <div className="setup-nav"><button className="btn" onClick={onBack}>Back to single-player</button></div>
    </div>
  );
}
