/**
 * Engine facade.
 *
 * Everything outside src/game talks to the game through this file, never to the
 * legacy module directly. That keeps the multiplayer layer stable while the engine
 * underneath is refactored (see docs/ARCHITECTURE.md, "Engine roadmap").
 *
 * Rules the multiplayer layer relies on:
 *  1. Game state is plain JSON (no functions, no class instances). serialize() round-trips it.
 *  2. All game randomness comes from state.rng, so the same state + the same commands
 *     always produce the same result.
 *  3. Only the host calls resolve functions. Other players only submit commands.
 */
import { Legacy } from '../game/legacy.js';

export const ENGINE_VERSION = 5;

/** Build a default setup object (the choices a player makes before announcing). */
export function defaultSetup(overrides = {}) {
  return { ...Legacy.newSetup(), ...overrides };
}

/** Start a new single-human game headlessly. Returns the new state. */
export function createGame(setup, { seed } = {}) {
  Legacy.UI.S = { ...setup, seed };
  Legacy.UI.mq = [];
  Legacy.startGame();
  return Legacy.G;
}

/** Load a state into the engine (for example, a snapshot received from Firebase). */
export function loadState(state) {
  Legacy.G = state;
}

export function currentState() {
  return Legacy.G;
}

export function serialize(state) {
  return JSON.stringify(state);
}

export function deserialize(json) {
  const s = JSON.parse(json);
  if (s.v !== ENGINE_VERSION) throw new Error(`Saved game is from engine v${s.v}; this build expects v${ENGINE_VERSION}.`);
  return s;
}

/**
 * Commands are the only way players change a game. In multiplayer, clients send these
 * to Firebase and the host applies them in order. Shape: { type, ...payload }.
 *   { type: 'plan', items: [{ k, a?, ...extra }] }   replace this week's plan
 *   { type: 'choice', modal: 'event'|'platform'|..., value }
 *   { type: 'endWeek' }
 */
export function applyCommand(state, cmd) {
  loadState(state);
  switch (cmd.type) {
    case 'plan':
      Legacy.G.plan = [];
      for (const it of cmd.items) {
        const { k, a = null, ...extra } = it;
        Legacy.addPlan(k, a, extra);
      }
      break;
    case 'endWeek':
      Legacy.endWeek();
      break;
    default:
      throw new Error(`Unknown command: ${cmd.type}`);
  }
  return Legacy.G;
}
