/**
 * Multiplayer protocol (host-authoritative).
 *
 * Firebase Realtime Database layout:
 *
 * rooms/{code}/meta      { hostUid, status: 'lobby'|'playing'|'over', mode: 'versus'|'coop'|'teams',
 *                          createdAt, engineVersion, settings: { diff, pace, primaries, maxPlayers } }
 * rooms/{code}/players/{uid}  { name, joinedAt, ready, connected, seat: 0..3, party?: 'D'|'R'|'C', role? }
 * rooms/{code}/state     { version, week, json }        written ONLY by the host
 * rooms/{code}/commands/{version}/{uid}  { cmd, at }    each player writes only their own
 * rooms/{code}/chat/{pushId}  { uid, name, text, at }
 *
 * Turn flow
 *  1. The host publishes state version N.
 *  2. Every connected human submits a command batch for version N (their plan + choices),
 *     then marks themselves done.
 *  3. When all connected humans are done (or the turn timer expires), the host loads
 *     state N, applies every batch in seat order, resolves the week, and publishes N+1.
 *  4. Clients render whatever the latest state says. Clients never resolve turns.
 *
 * Why host-authoritative: Firebase has no server code, so one browser acts as the referee.
 * Because the engine is seeded and deterministic, any player can take over as host
 * mid-game from the last published state without anything diverging.
 */
export const TURN_SECONDS = { quick: 90, standard: 150 };
export const MAX_PLAYERS = 4;
export const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I

export function makeRoomCode(rand = Math.random) {
  let c = '';
  for (let i = 0; i < 5; i++) c += ROOM_CODE_CHARS[Math.floor(rand() * ROOM_CODE_CHARS.length)];
  return c;
}

/** Everyone who still needs to submit for this turn. */
export function waitingOn(players, commandsForVersion) {
  return Object.entries(players || {})
    .filter(([uid, p]) => p.connected && !(commandsForVersion && commandsForVersion[uid] && commandsForVersion[uid].done))
    .map(([uid]) => uid);
}

/** Deterministic host election: the earliest-joined connected player. */
export function electHost(players) {
  const live = Object.entries(players || {}).filter(([, p]) => p.connected).sort((a, b) => a[1].joinedAt - b[1].joinedAt || (a[0] < b[0] ? -1 : 1));
  return live.length ? live[0][0] : null;
}
