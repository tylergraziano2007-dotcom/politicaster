/**
 * Headless simulation: plays whole campaigns with no UI.
 * Used by tests (determinism, smoke) and the balance script.
 */
import { Legacy } from '../game/legacy.js';
import { createGame } from './index.js';

const pickFrom = (arr, r) => arr[Math.floor(r() * arr.length)];

/** Resolve any open dialogs the way a simple bot would. Returns 'night' if the campaign ended. */
function resolveModals(r) {
  const UI = Legacy.UI;
  let guard = 0;
  while (UI.modal && guard++ < 40) {
    const m = UI.modal;
    if (m.type === 'event') { const ch = pickFrom(m.ev.c, r); Legacy.applyFx(ch.fx, m.extra); Legacy.showNext(); }
    else if (m.type === 'vp') { const o = m.opts[0]; Legacy.P().vp = { name: o.name, home: o.home, type: o.k, baggage: o.baggage }; Legacy.applyFx(o.fx, {}); Legacy.computePolls(); UI.modal = Legacy.platformFight(); }
    else if (m.type === 'platform') Legacy.platformChoice(pickFrom(['accept', 'compromise', 'refuse'], r));
    else if (m.type === 'string') Legacy.stringChoice(pickFrom(['comply', 'refuse'], r));
    else if (m.type === 'scandal') Legacy.scandalChoice('apologize');
    else if (m.type === 'primaryResults') { UI.modal = null; Legacy.afterPrimaryResults(); }
    else if (m.type === 'debate') {
      let g = 0;
      while (!m.done && g++ < 60) {
        if (m.stage === 'ask') Legacy.answerDebate(Math.floor(r() * m.qs[m.i].answers.length));
        else if (m.stage === 'answered') Legacy.rebutDebate(pickFrom(['counter', 'slide'], r));
        else Legacy.nextDebate();
      }
      Legacy.showNext();
    } else {
      const then = m.then; UI.modal = null;
      if (then === 'weekStart') Legacy.weekStart();
      else if (then === 'night') return 'night';
      else Legacy.showNext();
    }
  }
  return null;
}

/**
 * Play one full campaign.
 * @param setup  a setup object (see defaultSetup)
 * @param seed   game seed (same seed + same setup + same bot = same result)
 * @param bot    'marge' (skilled) or 'idle'
 */
export function playCampaign(setup, seed, bot = 'marge') {
  // The bot's own choices also come from a seeded stream so runs are reproducible.
  let bs = (seed ^ 0x9e3779b9) >>> 0;
  const r = () => { bs = (bs + 0x6d2b79f5) | 0; let t = Math.imul(bs ^ (bs >>> 15), bs | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  // Start from a clean cross-game event memory so simulations are reproducible.
  // (Real games capture that memory into state at creation, so multiplayer stays consistent.)
  try { localStorage.removeItem('politicaster.seen'); } catch { /* not in a browser */ }
  createGame(setup, { seed });
  for (let i = 0; i < 80; i++) {
    if (resolveModals(r) === 'night') break;
    const G = Legacy.G;
    if (G.phase === 'over') return { lostNomination: true, state: G };
    if (G.phase !== 'primary' && G.phase !== 'general') break;
    if (bot === 'marge') Legacy.margePlanWeek();
    Legacy.endWeek();
  }
  const G = Legacy.G;
  if (G.phase === 'over') return { lostNomination: true, state: G };
  const final = Legacy.project(1.5, 1.5);
  G.finalSum = Legacy.summarize(final);
  const d = Legacy.decideWinner();
  return { won: d.winner === 'P', ev: G.finalSum.ev.P, house: d.house, state: G };
}
