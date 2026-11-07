import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

const db = { node: null, subs: new Set() };
const emit = () => db.subs.forEach((f) => f(db.node ? JSON.parse(JSON.stringify(db.node)) : null));
const setPath = (obj, path, val) => { const ks = path.split('/'); let o = obj; ks.slice(0, -1).forEach((k) => { o[k] = o[k] || {}; o = o[k]; }); o[ks[ks.length - 1]] = val; };
vi.mock('../src/net/debate.js', () => ({
  startDebate: async (code, version, spec, ms) => { db.node = { version, spec: JSON.stringify(spec), round: 0, phase: 'answer', deadline: Date.now() + ms, totals: {}, zused: {}, results: {} }; emit(); },
  watchDebate: (code, cb) => { db.subs.add(cb); cb(db.node); return () => db.subs.delete(cb); },
  submitAnswer: async (code, round, uid, idx) => { setPath(db.node, `answers/${round}/${uid}`, idx); emit(); },
  submitRebut: async (code, round, uid, pick) => { setPath(db.node, `rebuts/${round}/${uid}`, pick); emit(); },
  hostUpdate: async (code, fields) => { for (const k in fields) setPath(db.node, k, fields[k]); emit(); },
}));
const { default: LiveDebate } = await import('../src/components/LiveDebate.jsx');
const { Legacy } = await import('../src/game/legacy.js');

const setupFor = (party, name) => { const S = Legacy.newSetup(); Object.assign(S, { party, name, secret: 'none', minor: { weed: 1, dst: 1, ufo: -1 } }); S.pos = party === 'D' ? [-1, -1, -1, -1, -1, 0, -2, -1, 0] : [1, 1, 2, 1, 1, 1, 1, 1, 1]; return S; };

describe('live debate screen', () => {
  it('runs five questions with answers, rebuttals, auto-answers, and a final ranking', async () => {
    window.matchMedia = () => ({ matches: false });
    let state = Legacy.mp.createMulti([{ uid: 'u0', name: 'Host', setup: setupFor('D', 'Host Cand') }, { uid: 'u1', name: 'Pal', setup: setupFor('R', 'Pal Cand') }], { diff: 'normal', pace: 'quick', primaries: false }, 99);
    const UI = Legacy.UI;
    for (let t = 0; t < 20 && !state.liveDebate; t++) {
      const logs = {};
      for (const s of state.humans) { let pl = null; Legacy.mp.configure({ on: true, onEndWeek: (p) => { pl = p; } }); Legacy.mp.load(state, s);
        let g = 0; while (UI.modal && g++ < 60) { const m = UI.modal; const a = m.type === 'event' ? ['evchoice', '0'] : m.type === 'vp' ? ['vp', '0'] : m.type === 'platform' ? ['platform', 'accept'] : m.type === 'string' ? ['string', 'refuse'] : m.type === 'scandal' ? ['scandal', 'apologize'] : ['close']; Legacy.mp.act(a[0], a[1], {}); }
        Legacy.mp.act('margeplan', undefined, {}); Legacy.mp.act('endweek', undefined, {}); logs[s] = pl; }
      Legacy.mp.configure({ on: false });
      state = Legacy.mp.resolveMulti(state, logs);
    }
    expect(state.liveDebate).toBeTruthy();
    let result = null;
    const div = document.createElement('div'); document.body.appendChild(div);
    const timings = { answer: 120, reveal: 30, rebut: 120, done: 30 };
    await act(async () => { createRoot(div).render(<LiveDebate code="X" uid="u0" isHost state={state} version={5} players={{ u0: { connected: true }, u1: { connected: true } }} timings={timings} onDone={(ns) => { result = ns; }} />); });
    const sleep = (ms) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
    let clicked = 0;
    for (let i = 0; i < 400 && !result; i++) {
      await sleep(25);
      const n = db.node; if (!n) continue;
      const choice = div.querySelector('.choice:not([disabled])');
      if (n.phase === 'answer' && choice && !(n.answers && n.answers[n.round] && n.answers[n.round].u0 !== undefined)) { await act(async () => { choice.click(); }); clicked++; }
      if (n.phase === 'rebut' && !(n.rebuts && n.rebuts[n.round] && n.rebuts[n.round].u0)) {
        const tgt = div.querySelector('.seg button'); if (tgt) await act(async () => { tgt.click(); });
        const btn = [...div.querySelectorAll('.choice')].find((b) => !b.disabled && b.textContent.includes('Counter')); if (btn) await act(async () => { btn.click(); });
      }
    }
    expect(result).toBeTruthy();
    expect(clicked).toBe(5);
    expect(result.liveDebate).toBeNull();
    const a = result.seats.h0.debates, b = result.seats.h1.debates;
    expect(a.total + b.total).toBe(2);
    expect(a.won + b.won).toBe(1);
    // The silent player was auto-answered every round
    for (let r = 0; r < 5; r++) expect(db.node.results[r].a.h1.auto).toBe(true);
  });
});
