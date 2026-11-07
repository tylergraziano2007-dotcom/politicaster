/**
 * Balance report. Slow, so it only runs with `npm run balance`.
 * Prints win rates for a skilled bot (Marge planning every week) at each difficulty.
 */
import { describe, it } from 'vitest';
import { defaultSetup } from '../src/engine/index.js';
import { playCampaign } from '../src/engine/sim.js';

const RUN = process.env.BALANCE === '1';
const N = Number(process.env.BALANCE_N || 20);

describe.skipIf(!RUN)('balance', () => {
  for (const diff of ['easy', 'normal', 'hard']) {
    it(`skilled player, general election, ${diff}`, () => {
      let wins = 0, ev = 0;
      for (let i = 0; i < N; i++) {
        const r = playCampaign(defaultSetup({ party: 'D', name: 'Bot', secret: 'none', primaries: false, diff, minor: { weed: 1, dst: 1, hotdog: -1 } }), 1000 + i);
        if (r.won) wins++; ev += r.ev || 0;
      }
      console.log(`${diff}: won ${wins}/${N} (${Math.round((wins / N) * 100)}%), average ${Math.round(ev / N)} electoral votes`);
    }, 600000);
  }
});
