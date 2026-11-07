# How multiplayer works

## Lobby
- Each player picks a party. With **primaries on**, several players can share a party and face
  off in its primary (plus AI rivals). Own-party players skip the primary and gather ballot
  signatures, starting the general on more state ballots with extra cash.
- With **primaries off**, it's one player per major party and everyone starts as a nominee.
- Everyone readies up; the host clicks Start. Everyone builds a candidate.

## Primaries (3 rounds)
Iowa & New Hampshire, Nevada & South Carolina, Super Tuesday. Each party's primary runs at the
same time, with its own results and dropouts. Humans are never auto-dropped.

## Convention
- If a human wins, each human who lost that primary chooses: **run as an independent**,
  **become the running mate**, or **become an advisor**. If two pick running mate, the first
  in seat order gets it and the other advises.
- If an AI wins a party's primary, the humans who lost it are out and can keep watching.
  If every human is out, the game ends.

## Running mates and advisors
- 2 actions a week for the ticket, paid from the ticket's cash.
- A **secret agenda** (pet issue, narrow win, shadow campaign, or quiet saboteur). Completing
  it earns 150 legacy points and counts as a personal win even if the ticket loses.
- The nominee sees occasional clues, and can **drop** them (costs 6 credibility); a dropped
  player continues as an independent with a late start.
- A human running mate plays the **vice presidential debate** live.

## Live debates
Everyone in the race is on one stage. For each of 5 questions: everyone answers at once
(30 seconds), answers are revealed together, then everyone picks a rival to counter, zing
(once per debate), or let it slide. The host scores each step; the final ranking sets
momentum (first gains the most, last loses some). Anyone offline gets an automatic answer.

## Staying in sync
- Each player's random outcomes come from their own seeded stream, and the host replays every
  player's clicks against the exact snapshot they saw. `tests/multiplayer.test.js` verifies the
  host gets exactly what each player saw, every week.
- If the host disconnects, the earliest-joined connected player takes over from the last week.
- The host gets a "Resolve week now" button for anyone who walks away mid-week.
