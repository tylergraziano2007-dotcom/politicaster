import { describe, it, expect, afterEach } from 'vitest';
import { mountGame, unmountGame, Legacy } from '../src/game/legacy.js';

const q = (root, sel) => root.querySelector(sel);
const click = (root, sel) => { const el = q(root, sel); if (!el) throw new Error('Missing ' + sel + ' on ' + Legacy.UI.screen + ' / ' + (Legacy.UI.modal && Legacy.UI.modal.type)); el.click(); };

describe('multiplayer through the real interface', () => {
  afterEach(() => unmountGame());

  it('builds a candidate, plays a week by clicking, and submits it', () => {
    window.scrollTo = () => {};
    window.matchMedia = () => ({ matches: false });
    const root = document.createElement('div');
    document.body.appendChild(root);
    let setup = null, payload = null;
    mountGame(root, { mp: { party: 'R', room: 'ABCDE', onSetupDone: (S) => { setup = S; }, onEndWeek: (p) => { payload = p; } } });
    Legacy.mp.startSetup('R', 'ABCDE');
    click(root, '[data-act="next"]');
    click(root, '[data-act="party"][data-v="D"]'); // locked: should not change
    expect(Legacy.UI.S.party).toBe('R');
    click(root, '[data-act="next"]');
    const name = q(root, '#cname'); name.value = 'Click Test'; name.dispatchEvent(new Event('input', { bubbles: true }));
    click(root, '[data-act="next"]'); click(root, '[data-act="next"]'); click(root, '[data-act="next"]');
    ['weed', 'dst', 'ufo'].forEach((k) => click(root, `[data-act="minorset"][data-k="${k}"][data-v="1"]`));
    click(root, '[data-act="next"]');
    expect(setup).toBeTruthy();
    expect(setup.name).toBe('Click Test');
    expect(Legacy.UI.screen).toBe('mpwait');

    // Host side (same module, headless): create the game with a second player.
    const other = Legacy.newSetup(); Object.assign(other, { party: 'D', name: 'Other', minor: { weed: -1, rail: 1, tips: 1 } });
    let state = Legacy.mp.createMulti([{ uid: 'a', name: 'Other', setup: other }, { uid: 'b', name: 'Me', setup }], { diff: 'normal', pace: 'quick' }, 31337);

    for (let week = 0; week < 3; week++) {
      Legacy.mp.load(state, 'h1');
      expect(q(root, '.topbar').textContent).toContain('ABCDE');
      let guard = 0;
      while (Legacy.UI.modal && guard++ < 60) {
        const sel = ['[data-act="vp"]', '[data-act="platform"]', '[data-act="evchoice"]', '[data-act="string"]', '[data-act="scandal"]', '[data-act="debate"]', '[data-act="rebut"]', '[data-act="debnext"]', '.overlay [data-act="close"]'].find((s) => q(root, s));
        click(root, sel);
      }
      click(root, '[data-act="action"][data-v="rally"]');
      const tile = q(root, '.tile.rec') || q(root, '.tiles .tile:not(.dim)');
      tile.click();
      click(root, '[data-act="margeplan"]');
      payload = null;
      click(root, '[data-act="endweek"]');
      expect(payload).toBeTruthy();
      expect(payload.plan.length).toBeGreaterThan(0);
      expect(q(root, '.overlay').textContent).toContain('Waiting');
      state = Legacy.mp.resolveMulti(state, { h0: { log: [], plan: [] }, h1: payload });
      expect(state.week).toBe(week + 2);
    }
  });
});
