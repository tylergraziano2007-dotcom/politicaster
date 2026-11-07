import { describe, it, expect, afterEach } from 'vitest';
import { mountGame, unmountGame, Legacy } from '../src/game/legacy.js';

const click = (root, sel) => {
  const el = root.querySelector(sel);
  if (!el) throw new Error('Missing ' + sel);
  el.click();
};

describe('game UI mounts and responds to clicks', () => {
  afterEach(() => unmountGame());

  it('walks from the title screen into a campaign', () => {
    window.scrollTo = () => {};
    window.matchMedia = () => ({ matches: false });
    const root = document.createElement('div');
    document.body.appendChild(root);
    let mp = false;
    mountGame(root, { onMultiplayer: () => { mp = true; } });
    expect(root.textContent).toContain('Politicaster');
    click(root, '[data-act="multiplayer"]');
    expect(mp).toBe(true);
    click(root, '[data-act="new"]');
    for (let i = 0; i < 2; i++) click(root, '[data-act="next"]');
    const name = root.querySelector('#cname');
    name.value = 'UI Test';
    name.dispatchEvent(new Event('input', { bubbles: true }));
    click(root, '[data-act="next"]');
    click(root, '[data-act="next"]');
    click(root, '[data-act="next"]');
    ['weed', 'dst', 'ufo'].forEach((k) => click(root, `[data-act="minorset"][data-k="${k}"][data-v="1"]`));
    click(root, '[data-act="next"]');
    click(root, '[data-act="next"]');
    expect(Legacy.G).toBeTruthy();
    expect(['primary', 'general']).toContain(Legacy.G.phase);
    expect(root.querySelector('.topbar')).toBeTruthy();
  });

  it('removes its listeners on unmount', () => {
    const root = document.createElement('div');
    mountGame(root, {});
    unmountGame();
    expect(root.innerHTML).toBe('');
  });
});
