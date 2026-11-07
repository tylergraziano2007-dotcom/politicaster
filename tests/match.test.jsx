import { describe, it, expect, vi } from 'vitest';
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

// ---- In-memory stand-in for Firebase ----
const store = { room: null, roomSubs: new Set(), state: null, stateSubs: new Set(), cmds: {}, cmdSubs: {} };
const emitRoom = () => store.roomSubs.forEach((f) => f(JSON.parse(JSON.stringify(store.room))));
vi.mock('../src/net/rooms.js', () => ({
  setPlayerChoice: async (code, uid, fields) => { Object.assign(store.room.players[uid], fields); emitRoom(); },
  updateSettings: async (code, fields) => { for (const k in fields) { if (k.startsWith('settings/')) store.room.meta.settings[k.slice(9)] = fields[k]; else store.room.meta[k] = fields[k]; } emitRoom(); },
}));
vi.mock('../src/net/sync.js', () => ({
  publishState: async (code, state, version) => { if (store.state && store.state.version >= version) return; store.state = { version, json: JSON.stringify(state) }; store.stateSubs.forEach((f) => f({ version, state: JSON.parse(store.state.json) })); },
  watchState: (code, cb) => { store.stateSubs.add(cb); if (store.state) cb({ version: store.state.version, state: JSON.parse(store.state.json) }); return () => store.stateSubs.delete(cb); },
  submitCommands: async (code, v, uid, payload, done) => { store.cmds[v] = store.cmds[v] || {}; store.cmds[v][uid] = { cmds: JSON.parse(JSON.stringify(payload)), done }; (store.cmdSubs[v] || []).forEach((f) => f({ ...store.cmds[v] })); },
  watchCommands: (code, v, cb) => { (store.cmdSubs[v] = store.cmdSubs[v] || []).push(cb); cb({ ...(store.cmds[v] || {}) }); return () => {}; },
}));
vi.mock('../src/ai/headlines.js', () => ({ addAiHeadlines: async (s) => s }));

const { default: Match } = await import('../src/components/Match.jsx');
const { Legacy } = await import('../src/game/legacy.js');

function Harness() {
  const [room, setRoom] = useState(store.room);
  useEffect(() => { store.roomSubs.add(setRoom); return () => store.roomSubs.delete(setRoom); }, []);
  return <Match code="TESTX" uid="me" room={room} onLeave={() => {}} />;
}
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const q = (sel) => document.querySelector(sel);
const click = async (sel) => { const el = q(sel); if (!el) throw new Error('Missing ' + sel + ' / ' + Legacy.UI.screen + ' / ' + (Legacy.UI.modal && Legacy.UI.modal.type)); await act(async () => { el.click(); }); await flush(); };

describe('match screen with a stand-in for Firebase', () => {
  it('host builds a candidate, creates the game, plays a week, and force-resolves', async () => {
    window.scrollTo = () => {}; window.matchMedia = () => ({ matches: false });
    const other = Legacy.newSetup(); Object.assign(other, { party: 'D', name: 'Friend', minor: { weed: -1, rail: 1, tips: 1 } });
    store.room = {
      meta: { hostUid: 'me', status: 'setup', mode: 'versus', settings: { diff: 'normal', pace: 'quick', maxPlayers: 4 } },
      players: {
        me: { name: 'Tyler', seat: 0, connected: true, ready: true, party: 'R', joinedAt: 1 },
        pal: { name: 'John', seat: 1, connected: true, ready: true, party: 'D', joinedAt: 2, setup: JSON.stringify(other) },
      },
    };
    const div = document.createElement('div'); document.body.appendChild(div);
    await act(async () => { createRoot(div).render(<Harness />); });
    await flush();
    expect(Legacy.UI.screen).toBe('setup');
    await click('[data-act="next"]'); await click('[data-act="next"]');
    const name = q('#cname'); await act(async () => { name.value = 'Host Test'; name.dispatchEvent(new Event('input', { bubbles: true })); });
    await click('[data-act="next"]'); await click('[data-act="next"]'); await click('[data-act="next"]');
    for (const k of ['weed', 'dst', 'ufo']) await click(`[data-act="minorset"][data-k="${k}"][data-v="1"]`);
    await click('[data-act="next"]');
    await flush(); await flush();
    expect(store.room.meta.status).toBe('playing');
    expect(store.state.version).toBe(1);
    expect(Legacy.UI.screen).toBe('game');
    let guard = 0;
    while (Legacy.UI.modal && guard++ < 60) {
      const sel = ['[data-act="vp"]', '[data-act="platform"]', '[data-act="evchoice"]', '[data-act="string"]', '[data-act="scandal"]', '[data-act="debate"]', '[data-act="rebut"]', '[data-act="debnext"]', '.overlay [data-act="close"]'].find((s) => q(s));
      await click(sel);
    }
    await click('[data-act="margeplan"]');
    await click('[data-act="endweek"]');
    expect(store.cmds[1].me.done).toBe(true);
    // John hasn't submitted, so the host sees the force-resolve control.
    expect(q('.host-ctrl')).toBeTruthy();
    await click('.host-ctrl .btn');
    await flush(); await flush();
    expect(store.state.version).toBe(2);
    expect(Legacy.G.week).toBe(2);
    expect(Legacy.UI.modal && Legacy.UI.modal.type).toBe('recap');
  });
});
