# Politicaster: Road to the Presidency

A satirical presidential campaign game. Play solo, or play **versus** with up to four friends:
each person runs their own candidate. AI-written news headlines kick in once you add a Claude
API key (optional). How versus works: docs/MULTIPLAYER.md.

Stack: React 18 + Vite, Firebase Realtime Database + Anonymous Auth, Vercel (hosting + serverless function).

## Run it locally (Windows / PowerShell)

```powershell
cd politicaster
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173). Single-player works with no setup.
Multiplayer needs Firebase (next section).

Other commands:

```powershell
npm test            # engine, determinism, protocol, and UI tests
npm run balance     # slow: win rates for a skilled bot at each difficulty
npm run build       # production build into dist/
```

## Connect Firebase (for multiplayer)

1. Go to https://console.firebase.google.com and create a project (or reuse your Monopoly one).
2. **Build > Authentication > Sign-in method:** enable **Anonymous**.
3. **Build > Realtime Database:** create a database (start in locked mode).
4. **Realtime Database > Rules:** paste the contents of `database.rules.json` and publish.
5. **Project settings > Your apps:** add a Web app and copy its config.
6. Copy `.env.example` to `.env.local` and fill in the five `VITE_FIREBASE_*` values:

```powershell
Copy-Item .env.example .env.local
notepad .env.local
```

7. Restart `npm run dev`. On the title screen, **Play with friends** now creates and joins rooms.
   To test alone, join your own room from an incognito window or a second browser (two normal
   tabs in one browser count as the same player).

## Deploy to Vercel

1. Push this folder to a new GitHub repo. `package.json` and `index.html` should sit at the
   **root of the repo**, not inside a subfolder. If you do put it in a subfolder, set Vercel's
   **Root Directory** to that folder.
2. In Vercel, **Add New > Project**, import the repo. It detects Vite automatically.
3. **Settings > Environment Variables:** add the five `VITE_FIREBASE_*` values, plus
   `ANTHROPIC_API_KEY`, `CLAUDE_MODEL_FAST`, `CLAUDE_MODEL_SMART`, and optionally `APP_PASSPHRASE`.
4. Redeploy. Add your Vercel domain under Firebase **Authentication > Settings > Authorized domains**.

The Claude key only ever lives in Vercel. Never give it a `VITE_` prefix, or it would be shipped to
every browser. Set a monthly spending limit in the Anthropic Console as a safety net.

## Project map

```
api/claude.js            Vercel function: builds prompts server-side, calls Claude, returns JSON
src/game/legacy.js       The full game (engine + string-rendered UI), ported from the prototype
src/engine/index.js      Facade every other module uses: createGame, applyCommand, serialize…
src/engine/sim.js        Headless campaigns for tests and balance
src/engine/protocol.js   Multiplayer data layout, turn rules, host election
src/net/firebase.js      Firebase init + anonymous sign-in
src/net/rooms.js         Lobby: create/join, presence, ready, settings, host takeover
src/net/sync.js          Turn sync: publish state, submit commands, resolve turns (host)
src/ai/claude.js         Browser client for /api/claude with timeout and fallback
src/components/          React shell: LegacyGame, Lobby, Room
tests/                   Vitest suites
docs/ARCHITECTURE.md     How it fits together and what's next
```
