import { describe, it, expect } from 'vitest';
import { defaultSetup, serialize, deserialize } from '../src/engine/index.js';
import { playCampaign } from '../src/engine/sim.js';

const setup = (party, primaries) => defaultSetup({
  party, name: 'Test Candidate', secret: 'none', primaries, pace: 'quick', diff: 'normal',
  minor: { weed: 1, dst: 1, hotdog: -1 }, bio: { age: 55, marital: 'married', kids: 2, ex: 'none', career: 'teacher', edu: 'state', hobbies: ['fishing', 'cats'] },
});

describe('deterministic engine', () => {
  it('same seed works for a general-election game too', () => {
    const a = playCampaign(setup('R', false), 777);
    const b = playCampaign(setup('R', false), 777);
    expect(JSON.parse(serialize(a.state))).toEqual(JSON.parse(serialize(b.state)));
  });

  it('same seed and same setup produce the identical game', () => {
    const a = playCampaign(setup('D', true), 12345);
    const b = playCampaign(setup('D', true), 12345);
    expect(JSON.parse(serialize(a.state))).toEqual(JSON.parse(serialize(b.state)));
  });

  it('different seeds produce different games', () => {
    const a = playCampaign(setup('R', false), 1);
    const b = playCampaign(setup('R', false), 2);
    expect(JSON.parse(serialize(a.state))).not.toEqual(JSON.parse(serialize(b.state)));
  });

  it('state survives a serialize round trip (what Firebase stores)', () => {
    const a = playCampaign(setup('R', false), 7);
    expect(deserialize(serialize(a.state))).toEqual(JSON.parse(serialize(a.state)));
  });
});
