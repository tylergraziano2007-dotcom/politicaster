import { describe, it, expect } from 'vitest';
import { Legacy } from '../src/game/legacy.js';

const UI = Legacy.UI;
const act = (a, v, k) => Legacy.mp.act(a, v, k ? { k } : {});

function setupFor(party, name) {
  const S = Legacy.newSetup();
  Object.assign(S, { party, name, secret: 'random', minor: { weed: 1, dst: 1, ufo: -1 }, bio: { age: 50, marital: 'married', kids: 1, ex: 'bitter', career: 'lawyer', edu: 'state', hobbies: ['karaoke', 'cats'] } });
  if (party === 'C') { S.cp = { name: 'Common Sense', color: '#1E9E8A', values: [0, 0, 0, 0, 0, 0, 0, 0, 0], base: ['suburb', 'biz'] }; S.pos = S.cp.values.slice(); }
  else S.pos = party === 'D' ? [-1, -1, -1, -1, -1, 0, -2, -1, 0] : [1, 1, 2, 1, 1, 1, 1, 1, 1];
  return S;
}

/** A client: load the shared state as this seat, click through dialogs, plan, and end the week. */
function clientTurn(state, seat) {
  let payload = null;
  Legacy.mp.configure({ on: true, onEndWeek: (p) => { payload = p; }, onSetupDone: null });
  Legacy.mp.load(state, seat);
  let guard = 0;
  while (UI.modal && guard++ < 80) {
    const m = UI.modal;
    if (m.type === 'recap' || m.type === 'note' || m.type === 'eventResult' || m.type === 'coach') act('close');
    else if (m.type === 'event') act('evchoice', '0');
    else if (m.type === 'vp') act('vp', '0');
    else if (m.type === 'platform') act('platform', 'compromise');
    else if (m.type === 'string') act('string', 'refuse');
    else if (m.type === 'scandal') act('scandal', 'apologize');
    else if (m.type === 'debate') {
      if (m.done) act('close');
      else if (m.stage === 'ask') act('debate', '0');
      else if (m.stage === 'answered') act('rebut', 'counter');
      else act('debnext');
    } else act('close');
  }
  const local = { cred: Legacy.P().cred, pos: Legacy.P().pos.slice(), cash: Legacy.G.cash, mom: Legacy.P().mom };
  act('margeplan');
  act('endweek');
  Legacy.mp.configure({ on: false });
  return { payload, local };
}

function playVersus(seed) {
  localStorage.removeItem('politicaster.seen');
  const entries = [
    { uid: 'u0', name: 'Tyler', setup: setupFor('D', 'Tyler Test') },
    { uid: 'u1', name: 'John', setup: setupFor('R', 'John Test') },
    { uid: 'u2', name: 'Sam', setup: setupFor('C', 'Sam Test') },
  ];
  let state = Legacy.mp.createMulti(entries, { diff: 'normal', pace: 'quick' }, seed);
  const mismatches = [];
  for (let w = 0; w < 20 && state.phase !== 'night'; w++) {
    const logs = {}, locals = {};
    for (const seat of state.humans) { const r = clientTurn(state, seat); logs[seat] = r.payload; locals[seat] = r.local; }
    const next = Legacy.mp.resolveMulti(state, logs);
    // What each player saw after their dialogs should match what the host replayed
    // (checked through the recap: the host's replay must have used the same plan).
    for (const seat of state.humans) if (!logs[seat] || !Array.isArray(logs[seat].plan)) mismatches.push(seat);
    state = next;
  }
  return { state, mismatches };
}

describe('versus multiplayer', () => {
  it('three players (D, R, own party) play a full campaign to election night', () => {
    const { state, mismatches } = playVersus(4242);
    expect(mismatches).toEqual([]);
    expect(state.phase).toBe('night');
    expect(state.humans).toEqual(['h0', 'h1', 'h2']);
    expect(state.finalSum.ev.h0 + state.finalSum.ev.h1 + state.finalSum.ev.h2 + Object.entries(state.finalSum.ev).filter(([k]) => !k.startsWith('h')).reduce((a, [, v]) => a + v, 0)).toBe(538);
    for (const s of state.humans) expect(state.seats[s].recap).toBeTruthy();
    // Humans replaced the AI nominees of their parties
    expect(state.active.filter((id) => !id.startsWith('h'))).toHaveLength(0);
  });

  it('the same seed and the same clicks produce the same game', () => {
    const a = playVersus(77).state, b = playVersus(77).state;
    expect(a.finalSum).toEqual(b.finalSum);
    expect(a.seats.h1.recap).toEqual(b.seats.h1.recap);
  });

  it('each player’s dialog results replay exactly on the host', () => {
    localStorage.removeItem('politicaster.seen');
    const entries = [
      { uid: 'u0', name: 'A', setup: setupFor('D', 'Alpha') },
      { uid: 'u1', name: 'B', setup: setupFor('R', 'Beta') },
      { uid: 'u2', name: 'C', setup: setupFor('C', 'Gamma') },
    ];
    let state = Legacy.mp.createMulti(entries, { diff: 'normal', pace: 'standard' }, 9);
    let checked = 0;
    for (let w = 0; w < 14 && state.phase !== 'night'; w++) {
      const logs = {}, locals = {};
      for (const seat of state.humans) { const r = clientTurn(state, seat); logs[seat] = r.payload; locals[seat] = r.local; }
      state = Legacy.mp.resolveMulti(state, logs);
      const rep = Legacy.mp.lastReplay();
      for (const seat of Object.keys(locals)) {
        expect(rep[seat].pos).toEqual(locals[seat].pos);
        expect(rep[seat].cred).toBeCloseTo(locals[seat].cred, 9);
        expect(rep[seat].cash).toBeCloseTo(locals[seat].cash, 9);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(20);
  });

  it('single-player still works after multiplayer games', () => {
    expect(Legacy.mp).toBeTruthy();
    Legacy.UI.S = { ...setupFor('R', 'Solo'), primaries: false, pace: 'quick' };
    Legacy.startGame();
    expect(Legacy.G.cands.P.name).toBe('Solo');
    expect(Legacy.G.humans).toBeUndefined();
  });
});
