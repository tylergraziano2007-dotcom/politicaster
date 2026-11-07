/**
 * Turn sync (host-authoritative). Data layout is documented in src/engine/protocol.js.
 * The match screen (src/components/Match.jsx) drives these.
 */
import { ref, set, onValue, runTransaction } from 'firebase/database';
import { db } from './firebase.js';
import { serialize, deserialize } from '../engine/index.js';

const r = (code, path) => ref(db, `rooms/${code}/${path}`);

/** Host: publish a new state snapshot. Versions only move forward. */
export function publishState(code, state, version) {
  return runTransaction(r(code, 'state'), (cur) => {
    if (cur && cur.version >= version) return undefined;
    return { version, week: state.week || 0, phase: state.phase || '', json: serialize(state), at: Date.now() };
  });
}

/** Everyone: subscribe to the latest published state. */
export function watchState(code, cb) {
  return onValue(r(code, 'state'), (snap) => {
    const v = snap.val();
    if (v) cb({ version: v.version, state: deserialize(v.json) });
  });
}

/** Player: submit this week's clicks and plan, and mark yourself done. */
export function submitCommands(code, version, uid, payload, done) {
  return set(r(code, `commands/${version}/${uid}`), { cmds: JSON.parse(JSON.stringify(payload)), done: !!done, at: Date.now() });
}

export function watchCommands(code, version, cb) {
  return onValue(r(code, `commands/${version}`), (snap) => cb(snap.val() || {}));
}
