import { describe, it, expect } from 'vitest';
import { defaultSetup } from '../src/engine/index.js';
import { playCampaign } from '../src/engine/sim.js';

describe('full campaigns run headless', () => {
  for (const [party, primaries] of [['D', true], ['R', false], ['C', false]]) {
    it(`party ${party}${primaries ? ' with primaries' : ''}`, () => {
      const s = defaultSetup({ party, name: 'Smoke', secret: 'random', primaries, pace: 'quick', minor: { weed: 1, ufo: 1, rail: -1 } });
      if (party === 'C') { s.cp = { name: 'Test Party', color: '#1E9E8A', values: [0, 0, 0, 0, 0, 0, 0, 0, 0], base: ['suburb', 'biz'] }; s.pos = s.cp.values.slice(); }
      const r = playCampaign(s, 99);
      expect(r.lostNomination || typeof r.ev === 'number').toBe(true);
    });
  }
});
