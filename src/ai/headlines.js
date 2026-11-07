import { generate } from './claude.js';

/**
 * Host only: ask Claude for a few fresh ticker headlines about the week that just
 * resolved, and add them to the shared state before publishing. If AI isn't set up
 * (or the request fails), the state is returned unchanged with its built-in headlines.
 */
export async function addAiHeadlines(state) {
  try {
    const names = Object.values(state.cands).filter((c) => state.active.includes(c.id)).map((c) => c.name);
    const facts = [
      `Candidates: ${names.join(', ')}`,
      ...(state.ticker || []).slice(0, 6).map((t) => t.text),
    ];
    const result = await generate('headlines', { facts, count: 4 });
    if (Array.isArray(result) && result.length) {
      state.ticker = result.slice(0, 4).map((t) => ({ net: 'BSN', text: String(t).slice(0, 140) })).concat(state.ticker || []).slice(0, 14);
    }
  } catch { /* fall back silently */ }
  return state;
}
