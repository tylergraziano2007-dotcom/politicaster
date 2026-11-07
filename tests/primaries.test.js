import { describe, it, expect } from 'vitest';
import { Legacy } from '../src/game/legacy.js';

const UI = Legacy.UI;
const act = (a, v, k) => Legacy.mp.act(a, v, k ? { k } : {});

function setupFor(party, name) {
  const S = Legacy.newSetup();
  Object.assign(S, { party, name, secret: 'random', minor: { weed: 1, dst: 1, ufo: -1 }, bio: { age: 50, marital: 'married', kids: 1, ex: 'none', career: 'lawyer', edu: 'state', hobbies: ['karaoke', 'cats'] } });
  if (party === 'C') { S.cp = { name: 'Common Sense', color: '#1E9E8A', values: [0, 0, 0, 0, 0, 0, 0, 0, 0], base: ['suburb', 'biz'] }; S.pos = S.cp.values.slice(); }
  else S.pos = party === 'D' ? [-1, -1, -1, -1, -1, 0, -2, -1, 0] : [1, 1, 2, 1, 1, 1, 1, 1, 1];
  return S;
}

function clientTurn(state, seat, opts = {}) {
  let payload = null;
  Legacy.mp.configure({ on: true, onEndWeek: (p) => { payload = p; } });
  Legacy.mp.load(state, seat);
  if (payload) return payload; // auto-submitted (out of the race)
  let guard = 0;
  while (UI.modal && guard++ < 80) {
    const m = UI.modal;
    if (m.type === 'loserpath') act('loserpath', opts.path || 'vp');
    else if (m.type === 'event') act('evchoice', '0');
    else if (m.type === 'vp') act('vp', '0');
    else if (m.type === 'platform') act('platform', 'compromise');
    else if (m.type === 'string') act('string', 'refuse');
    else if (m.type === 'scandal') act('scandal', 'apologize');
    else act('close');
  }
  if (UI.screen === 'game') {
    if (opts.kick) act('kickhelper', opts.kick);
    act('margeplan');
  }
  act('endweek');
  Legacy.mp.configure({ on: false });
  return payload;
}

/** The host runs a live debate: humans pick the first answer and counter the first rival. */
function runDebate(state) {
  const spec = Legacy.mp.debatePrepare(state);
  const totals = {}, zused = {};
  for (let r = 0; r < 5; r++) {
    const picks = {}, rebuts = {};
    spec.stages.forEach((st) => st.parts.forEach((p) => { if (!p.ai) { picks[p.id] = r % 3; const o = st.parts.find((x) => x.id !== p.id); rebuts[p.id] = { target: o && o.id, type: r === 2 ? 'zinger' : 'counter' }; } }));
    const a = Legacy.mp.debateScoreAnswers(spec, r, picks);
    const b = Legacy.mp.debateScoreRebuts(spec, r, rebuts, zused);
    for (const id in a) totals[id] = (totals[id] || 0) + a[id].pts;
    for (const id in b) { totals[id] = (totals[id] || 0) + b[id].pts + (b[id].hit || 0); if (b[id].type === 'zinger') zused[id] = true; }
  }
  return { spec, next: Legacy.mp.debateApply(state, spec, totals) };
}

function playGame(entries, settings, seed, hooks = {}) {
  localStorage.removeItem('politicaster.seen');
  let state = Legacy.mp.createMulti(entries, settings, seed);
  const seen = { debates: [], phases: new Set(), kicked: false };
  for (let t = 0; t < 40 && state.phase !== 'night' && state.phase !== 'over'; t++) {
    seen.phases.add(state.phase);
    if (state.liveDebate) { const { spec, next } = runDebate(state); seen.debates.push(spec); state = next; continue; }
    const logs = {};
    for (const seat of state.humans) logs[seat] = clientTurn(state, seat, hooks.opts ? hooks.opts(state, seat) : {}) || { log: [], plan: [] };
    state = Legacy.mp.resolveMulti(state, logs);
  }
  return { state, seen };
}

describe('multiplayer primaries, convention, and live debates', () => {
  it('two Democrats and a Republican: primaries, a running mate with an agenda, live debates, election night', () => {
    const entries = [
      { uid: 'u0', name: 'Tyler', setup: setupFor('D', 'Tyler D') },
      { uid: 'u1', name: 'John', setup: setupFor('D', 'John D') },
      { uid: 'u2', name: 'Sam', setup: setupFor('R', 'Sam R') },
    ];
    const { state, seen } = playGame(entries, { diff: 'normal', pace: 'standard', primaries: true }, 2024);
    expect(seen.phases.has('primary')).toBe(true);
    expect(seen.debates.some((d) => d.kind === 'primary')).toBe(true);
    // One primary debate stage per party, each ranked separately
    const pd = seen.debates.find((d) => d.kind === 'primary');
    expect(pd.stages.length).toBe(2);
    if (state.phase === 'night') {
      expect(seen.phases.has('convention')).toBe(true);
      expect(seen.debates.some((d) => d.kind === 'pres')).toBe(true);
      const helpers = state.humans.filter((h) => state.seats[h].role);
      const outs = state.humans.filter((h) => state.seats[h].out);
      // Each Democrat either won, joined the ticket, or (if an AI won) is out
      expect(helpers.length + outs.length + state.humans.filter((h) => state.active.includes(h)).length).toBeGreaterThanOrEqual(3);
      for (const h of helpers) { expect(state.seats[h].agenda).toBeTruthy(); expect(typeof state.seats[h].agendaDone).toBe('boolean'); }
      if (helpers.some((h) => state.seats[h].role === 'vp')) expect(seen.debates.some((d) => d.kind === 'vp')).toBe(true);
      expect(Object.values(state.finalSum.ev).reduce((a, b) => a + b, 0)).toBe(538);
    } else {
      expect(state.phase).toBe('over');
    }
  });

  it('a live debate produces one winner and one loser, not two winners', () => {
    const entries = [
      { uid: 'a', name: 'A', setup: setupFor('D', 'Alpha') },
      { uid: 'b', name: 'B', setup: setupFor('R', 'Beta') },
    ];
    let state = Legacy.mp.createMulti(entries, { diff: 'normal', pace: 'quick', primaries: false }, 55);
    for (let t = 0; t < 20 && !state.liveDebate; t++) {
      const logs = {}; for (const s of state.humans) logs[s] = clientTurn(state, s);
      state = Legacy.mp.resolveMulti(state, logs);
    }
    expect(state.liveDebate && state.liveDebate.kind).toBe('pres');
    const { next } = runDebate(state);
    const d = [next.seats.h0.debates, next.seats.h1.debates];
    expect(d[0].total).toBe(1); expect(d[1].total).toBe(1);
    expect(d[0].won + d[1].won).toBe(1);
    expect(d[0].lost + d[1].lost).toBe(1);
    expect(next.liveDebate).toBeNull();
  });

  it('the nominee can drop a helper, who then runs as an independent', () => {
    const entries = [
      { uid: 'u0', name: 'N', setup: setupFor('D', 'Nominee Hopeful') },
      { uid: 'u1', name: 'L', setup: setupFor('D', 'Loser Hopeful') },
    ];
    let kickAt = null;
    const { state } = playGame(entries, { diff: 'easy', pace: 'quick', primaries: true }, 777, {
      opts: (st, seat) => {
        if (st.phase !== 'general') return { path: 'advisor' };
        const helper = st.humans.find((h) => st.seats[h].role);
        if (helper && st.seats[seat] && st.active.includes(seat) && st.week === 3) { kickAt = helper; return { kick: helper }; }
        return {};
      },
    });
    if (state.phase === 'over') return; // an AI won the primary; nothing to drop
    if (kickAt) {
      expect(state.seats[kickAt].role).toBeFalsy();
      expect(state.cands[kickAt].party).toBe('C');
      expect(state.active).toContain(kickAt);
    }
  });
});
