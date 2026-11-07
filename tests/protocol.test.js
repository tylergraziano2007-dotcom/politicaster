import { describe, it, expect } from 'vitest';
import { makeRoomCode, waitingOn, electHost, ROOM_CODE_CHARS } from '../src/engine/protocol.js';

describe('multiplayer protocol helpers', () => {
  it('room codes are 5 unambiguous characters', () => {
    const c = makeRoomCode();
    expect(c).toHaveLength(5);
    for (const ch of c) expect(ROOM_CODE_CHARS).toContain(ch);
  });
  it('waits only on connected players who are not done', () => {
    const players = { a: { connected: true }, b: { connected: true }, c: { connected: false } };
    expect(waitingOn(players, { a: { done: true } })).toEqual(['b']);
  });
  it('elects the earliest-joined connected player as host', () => {
    const players = { x: { connected: false, joinedAt: 1 }, y: { connected: true, joinedAt: 3 }, z: { connected: true, joinedAt: 2 } };
    expect(electHost(players)).toBe('z');
  });
});
