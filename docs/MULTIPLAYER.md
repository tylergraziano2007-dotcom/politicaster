# How versus multiplayer works

1. In a room, each player picks a party (one each for Democratic and Republican; any number
   can start their own party) and clicks I'm ready. The host clicks Start game.
2. Everyone builds a candidate with the normal setup screens. When all are in, the host's
   browser creates the game and publishes week 1. AI fills any major party nobody picked.
3. Each week every player handles their own breaking news, debates, and scandals, plans
   their actions, and clicks End week. The host's browser resolves the week when everyone
   is in, then everyone sees their own recap.
4. Election night plays out for everyone with the same results.

How it stays fair and in sync:
- Each player's random outcomes (debate answers, events) come from their own seeded stream,
  and the host replays every player's clicks against the exact snapshot that player saw,
  so the host gets exactly the results the player saw. `tests/multiplayer.test.js` checks
  this every week for three players.
- Plans are submitted as-is and executed by the host in seat order.
- If the host disconnects, the earliest-joined connected player becomes host and continues
  from the last published week.
- If a player disconnects, the week resolves without them (their candidate takes no actions).
  The host also gets a "Resolve week now" button once they've submitted, for anyone who walks away.
