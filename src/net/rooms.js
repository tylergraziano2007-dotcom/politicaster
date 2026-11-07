/** Lobby: create/join rooms, presence, ready-up, host settings. */
import { ref, get, set, update, onValue, onDisconnect, serverTimestamp, runTransaction, remove } from 'firebase/database';
import { db, ensureSignedIn } from './firebase.js';
import { makeRoomCode, MAX_PLAYERS, electHost } from '../engine/protocol.js';
import { ENGINE_VERSION } from '../engine/index.js';

const roomRef = (code, path = '') => ref(db, `rooms/${code}${path ? '/' + path : ''}`);

function trackPresence(code, uid) {
  const me = roomRef(code, `players/${uid}/connected`);
  set(me, true);
  onDisconnect(me).set(false);
}

export async function createRoom(name, settings) {
  const uid = await ensureSignedIn();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeRoomCode();
    const meta = roomRef(code, 'meta');
    const res = await runTransaction(meta, (cur) => cur ? undefined : {
      hostUid: uid, status: 'lobby', mode: 'versus', createdAt: Date.now(), engineVersion: ENGINE_VERSION,
      settings: { diff: 'normal', pace: 'standard', primaries: true, maxPlayers: MAX_PLAYERS, ...settings },
    });
    if (!res.committed) continue; // code already taken, try another
    await set(roomRef(code, `players/${uid}`), { name, joinedAt: Date.now(), ready: false, connected: true, seat: 0 });
    trackPresence(code, uid);
    return { code, uid };
  }
  throw new Error('Couldn’t find a free room code. Try again.');
}

export async function joinRoom(code, name) {
  code = code.trim().toUpperCase();
  const uid = await ensureSignedIn();
  const snap = await get(roomRef(code));
  if (!snap.exists()) throw new Error(`No room with code ${code}. Check the code and try again.`);
  const room = snap.val();
  if (room.meta.engineVersion !== ENGINE_VERSION) throw new Error('That room was created with a different game version. Ask the host to refresh and make a new room.');
  const players = room.players || {};
  if (!players[uid]) {
    if (room.meta.status !== 'lobby') throw new Error('That game has already started.');
    const seats = Object.values(players).map((p) => p.seat);
    if (seats.length >= room.meta.settings.maxPlayers) throw new Error('That room is full.');
    let seat = 0; while (seats.includes(seat)) seat++;
    await set(roomRef(code, `players/${uid}`), { name, joinedAt: Date.now(), ready: false, connected: true, seat });
  }
  trackPresence(code, uid);
  return { code, uid };
}

export async function leaveRoom(code, uid) {
  await remove(roomRef(code, `players/${uid}`));
}

export function setReady(code, uid, ready) {
  return update(roomRef(code, `players/${uid}`), { ready });
}

export function setPlayerChoice(code, uid, fields) {
  return update(roomRef(code, `players/${uid}`), fields);
}

/** Host only (enforced by database rules). */
export function updateSettings(code, fields) {
  return update(roomRef(code, 'meta'), fields);
}

/** Subscribe to the whole room. Returns an unsubscribe function. */
export function watchRoom(code, cb) {
  return onValue(roomRef(code), (snap) => cb(snap.val()));
}

/**
 * If the host has disconnected, the earliest-joined connected player claims host.
 * Safe to call from every client; the transaction makes sure only one wins.
 */
export function claimHostIfNeeded(code, room, uid) {
  const host = room.players && room.players[room.meta.hostUid];
  if (host && host.connected) return;
  if (electHost(room.players) !== uid) return;
  return runTransaction(roomRef(code, 'meta/hostUid'), (cur) => {
    const h = room.players[cur];
    return h && h.connected ? undefined : uid;
  });
}

export const _serverTimestamp = serverTimestamp;
