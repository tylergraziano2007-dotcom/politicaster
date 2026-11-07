# Architecture

## The three rules

1. **Game state is plain JSON.** Everything about a game lives in one object (`G`). It can be
   saved, sent through Firebase, and loaded on another machine. `serialize`/`deserialize` in
   `src/engine/index.js` are the only way state crosses a boundary.
2. **The engine is deterministic.** All game randomness comes from a seeded generator stored in
   `state.rng`. Same state + same commands = same result, on any machine. `tests/determinism.test.js`
   enforces this. Things that must never feed the game's randomness: rendering, setup screens,
   browser storage, clocks. (Each of these leaked once during setup and is now covered by tests.)
3. **Players send commands; the host resolves.** Clients never change shared state directly.

## Multiplayer model: host-authoritative

Firebase has no server code, so one player's browser acts as referee:

```
 player browsers                         Firebase                       host browser
 ───────────────                         ────────                       ────────────
 plan the week ──► commands/{v}/{uid} ──────────────────────────────► all done?
                                                                         │ load state v
                                                                         │ apply commands (seat order)
 render latest ◄── state {version v+1} ◄─────────────────────────────── endWeek, publish v+1
```

- Commands are applied in **seat order**, so results never depend on network timing.
- If the host drops, the earliest-joined connected player claims host (`claimHostIfNeeded`). Because
  the engine is deterministic and the last state is in Firebase, nothing diverges.
- Only the host calls Claude, then writes the generated text into state, so everyone sees the same
  headline or rebuttal.
- Database rules (`database.rules.json`) enforce who can write what: only the host writes `state`,
  each player writes only their own `commands`.

## What works now

- **Versus multiplayer, end to end** (see docs/MULTIPLAYER.md), with AI headlines from the host.

- Single-player game, unchanged, mounted inside React (`LegacyGame`).
- Deterministic engine with headless simulation and tests.
- Lobby: create/join by 5-letter code, presence, ready-up, host-only settings, host takeover.
- Turn-sync plumbing: publish state, submit commands, resolve turns.
- Claude endpoint with server-built prompts, passphrase, and rate limit; client with fallback.

## How versus fits the old single-player engine

Humans are stored as `h0`..`h3` with per-player data in `G.seats`. `activateSeat()` renames one human to `P` and swaps their data in, so all the single-player code runs unchanged for that player. The host replays each player's recorded clicks against the snapshot they saw, using that player's own RNG stream, then merges results and runs everyone's plans.

## Engine roadmap (next: co-op and teams)

The legacy engine assumes one human candidate with the id `P`. To play versus, it needs several:

1. **Seats instead of `P`.** Replace `G.cands.P` with candidates keyed by seat (`h0`…`h3`), and
   make `P()` take a seat argument. Most functions already take a candidate object; the work is in
   the places that hard-code `'P'` (plans, cash, exposure, secret, debates).
2. **Per-seat turn data.** Move `plan`, `cash`, `staff`, `apWeek`, `prep`, `secret`, `exposure`,
   `flips`, `dirt`, and `strings` under each seat.
3. **Per-seat dialogs.** Events and debates currently live in `UI.modal`, which is local. In
   multiplayer they become entries in `G.pending[seat]` that the owner answers with a command
   (`{ type: 'choice', modal, value }`), so the host can resolve them.
4. **Shared moments.** Debates between humans: both submit answers, the host scores them together.
5. **Co-op roles.** One shared candidate; each seat controls a subset of actions (candidate,
   manager, comms, field), plus the secret-agenda system we designed.
6. **React UI for multiplayer.** A new game screen built from the existing render functions, reading
   from the shared state and sending commands instead of mutating `G`.

Single-player keeps working throughout: it's just a game with one human seat.

## AI-generated content plan

`api/claude.js` accepts a `kind` (`headlines`, `rebuttal`, `eventFlavor`) plus small structured
context, and builds the prompt itself, so the endpoint can't be used as a general chatbot. Every
call is optional: on failure the game uses its handwritten text. Use the fast model for volume
(headlines) and the smart model for moments that matter (debate rebuttals).
