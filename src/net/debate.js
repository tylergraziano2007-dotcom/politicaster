/** Live debate sync. The host writes the debate; players write only their own answers. */
import { ref, set, update, onValue } from 'firebase/database';
import { db } from './firebase.js';

const d = (code, path = '') => ref(db, `rooms/${code}/debate${path ? '/' + path : ''}`);

export function startDebate(code, version, spec, answerMs) {
  return set(d(code), { version, spec: JSON.stringify(spec), round: 0, phase: 'answer', deadline: Date.now() + answerMs, totals: {}, zused: {}, results: {} });
}
export function watchDebate(code, cb) { return onValue(d(code), (s) => cb(s.val())); }
export function submitAnswer(code, round, uid, idx) { return set(d(code, `answers/${round}/${uid}`), idx); }
export function submitRebut(code, round, uid, pick) { return set(d(code, `rebuts/${round}/${uid}`), pick); }
export function hostUpdate(code, fields) { return update(d(code), fields); }
