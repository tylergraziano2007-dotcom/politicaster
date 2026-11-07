/**
 * Browser client for /api/claude. Every call is optional: on any failure or timeout it
 * returns null, and the game falls back to its handwritten content.
 * In multiplayer, only the host calls this, then writes the result into the shared
 * state, so every player sees the same generated text.
 */
const TIMEOUT_MS = 8000;

export async function generate(kind, context) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-passphrase': localStorage.getItem('politicaster.passphrase') || '' },
      body: JSON.stringify({ kind, context }),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.result ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
