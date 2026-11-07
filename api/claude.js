/**
 * Vercel serverless function: POST /api/claude
 *
 * Keeps your Anthropic API key on the server. The browser never sends a raw prompt:
 * it sends a request `kind` plus small structured context, and the prompt is built here.
 * That way nobody can use your endpoint as a free general-purpose chatbot.
 *
 * Env vars (Vercel > Settings > Environment Variables):
 *   ANTHROPIC_API_KEY   required
 *   CLAUDE_MODEL_FAST   e.g. claude-haiku-5-5   (high-volume text: headlines, reactions)
 *   CLAUDE_MODEL_SMART  e.g. claude-sonnet-5-5  (debates, bigger moments)
 *   APP_PASSPHRASE      optional shared passphrase for your friend group
 */
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const TONE = 'You write for Politicaster, a satirical presidential campaign game. Tone: cable-news parody, PG-13, clever rather than mean. Roast every party and ideology equally. Never mention real living politicians; use only the names you are given. Never take a side on real political issues.';

const KINDS = {
  headlines: {
    model: 'fast', maxTokens: 400,
    build: (c) => `Write ${clampN(c.count, 3, 8)} short satirical news-ticker headlines (under 14 words each) about this week of the campaign.\nFacts:\n${facts(c)}\nReturn only a JSON array of strings.`,
  },
  rebuttal: {
    model: 'smart', maxTokens: 200,
    build: (c) => `Debate moment. Opponent: ${s(c.opponent)} (${s(c.archetype)}). Question: "${s(c.question)}". The player just answered: "${s(c.answer)}". Write the opponent's one- or two-sentence rebuttal in their voice. Return only JSON: {"line": "..."}`,
  },
  eventFlavor: {
    model: 'fast', maxTokens: 300,
    build: (c) => `Rewrite this campaign event so it feels fresh, keeping the same facts and the same choices. Title: "${s(c.title)}". Text: "${s(c.text)}". Candidate: ${s(c.candidate)}. Return only JSON: {"title": "...", "text": "..."}`,
  },
};

const s = (v) => String(v ?? '').slice(0, 400).replace(/[\r\n]+/g, ' ');
const clampN = (v, a, b) => Math.max(a, Math.min(b, Number(v) || a));
const facts = (c) => (Array.isArray(c.facts) ? c.facts : []).slice(0, 12).map((f) => '- ' + s(f)).join('\n');

// Best-effort rate limit per IP (resets when the function cold-starts).
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  list.push(now);
  hits.set(ip, list);
  return list.length > 30;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'AI content is not configured on this deployment.' });
  if (process.env.APP_PASSPHRASE && req.headers['x-passphrase'] !== process.env.APP_PASSPHRASE) return res.status(401).json({ error: 'Wrong passphrase.' });
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0] || 'local';
  if (limited(ip)) return res.status(429).json({ error: 'Too many requests. Try again in a minute.' });

  const { kind, context } = req.body || {};
  const spec = KINDS[kind];
  if (!spec) return res.status(400).json({ error: `Unknown kind: ${kind}` });

  const model = spec.model === 'smart' ? process.env.CLAUDE_MODEL_SMART : process.env.CLAUDE_MODEL_FAST;
  try {
    const msg = await client.messages.create({
      model, max_tokens: spec.maxTokens, system: TONE,
      messages: [{ role: 'user', content: spec.build(context || {}) }],
    });
    const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('').replace(/```json|```/g, '').trim();
    return res.status(200).json({ result: JSON.parse(text) });
  } catch (e) {
    return res.status(502).json({ error: 'The AI request failed. The game will use its built-in text instead.' });
  }
}
