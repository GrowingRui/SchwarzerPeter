# Developer notes

How the Schwarzer Peter project is built. For the game itself, see the [README](../README.md).

## Project layout

```
apps/web          Website (index.html, deck.html) and the game (play.html, React in src/play). Vite + Tailwind, deployed on Vercel.
apps/server       Game server for online rooms: a Cloudflare Worker with one Durable Object per room.
packages/engine   The game rules in plain TypeScript, plus the browser/server message protocol (@sp/engine/protocol).
brand_assets      Logo source file and brand guidelines.
```

## Getting started

```
npm install
npm run dev          # website at http://localhost:3000 (same as: node serve.mjs)
npm run dev:server   # game server at http://localhost:8787 (needed for online rooms)
npm test             # engine and room tests
npm run typecheck
npm run build        # production build in apps/web/dist
```

To try an online game locally, run both dev commands, create a room at http://localhost:3000/play.html?create=1, and join it from a private window or another browser. A second tab in the same browser shares your seat, because the seat is remembered per browser.

`node screenshot.mjs http://localhost:3000 [label]` saves a full-page screenshot to `temporary screenshots/`, using your installed Chrome or Edge.

## The game page

`play.html` has three modes:

| URL | Screen |
|---|---|
| `/play` | Practice against 1 to 5 bots, all in the browser (`src/play/host.ts`) |
| `/play?create=1` | Create an online room |
| `/play?room=KATZE` | Join room KATZE: name, lobby, then the game (`src/play/Online.tsx`) |
| `/play?quick=1` | Quick match: name, then a seat at the table that is filling up (`&go=1` skips the name screen) |

Either way, `src/play/Table.tsx` gets its game as a stream of steps (`deal`, `action`, `hover`, `sync`) from a `GameHost`. Live steps (`peek`, `rearranged`, `reaction`) skip the animation queue and show at once. It plays them one at a time with card animations, and it only ever receives what this player may see. The practice host waits for the table's `ready()` before a bot moves. The online host (`src/play/room-client.ts`) gets steps from the server, which sets the pace itself.

## Bluffing

You can rearrange your hand at any time (drag, arrow keys or Shuffle); the browser sends the new order (`arrange`) and the others only learn *that* you rearranged. While you choose a card, the browser sends the slot you point at (`peek`), and the server passes it only to the player holding those cards. Emotes (`react`) are a fixed list (`EMOTES` in the protocol), limited to one per second per player. Peeks and emotes never change the stored room, so they cost no storage writes. In practice games, bots sometimes shuffle before you draw and react to big moments.

## Quick match

`POST /api/quick` asks the `Matchmaker` Durable Object (one instance for the whole game) for a seat. It hands out the same table code to up to 4 people within 12 seconds, then opens a new table. It stores only the current table code and a seat count, no names. A quick table is a room with `mode: 'quick'`: it has no host, the first person to sit down starts a 15-second countdown (`QUICK_WAIT_MS`), and the game starts when 4 people are there (`QUICK_SEATS`) or when the countdown ends, with bots in the empty seats. Leaving or losing the connection while waiting frees the seat. Someone who arrives just after a table started is sent to a new table automatically. After the game, "Find another table" starts a new quick match.

There are no accounts: names live only in the room and are deleted with it.

## Turn timer and soot

Whenever a person has to draw online, the server sends a live `timer` step (`playerId`, game `turn`, `endsInMs`) to everyone at the table: 45 seconds normally, 12 seconds if the drawer has lost connection. The table shows it once its view has caught up to that turn: a bar under the drawer's seat, and for yourself a bar above your hand plus a warning in the last 15 seconds. Practice games have no timer.

The room remembers who kept the cat (`sooty` in the room info). In the next round in that room, that player's avatar carries a soot smudge and the round opens with a short announcement. Practice games do the same when you choose Rematch with the same bots.

## Rematch and celebrations

After an online game, everyone sees Rematch. Each press sends `rematch`; the room lists who asked (`rematch` in the room info), and once every person still connected has asked, the server deals a new round at the same table with the same bots. People who left or lost connection aren't waited for. In private rooms the host can also choose Change players (`again`), which takes everyone back to the lobby. A new round gets a new table: `room-client.ts` holds that round's steps until the new table subscribes.

`src/play/Celebrate.tsx` draws the small end-of-game moments: embers when you lay down your last card, confetti on the result screen when you're safe, and a puff of smoke around the cat when you kept it. They only animate transform and opacity and are hidden for reduced motion.

## Languages

The site is in English and German. All text lives in `apps/web/src/i18n.ts`. Static pages are written in English, and each translated element carries `data-i18n="key"` (or `data-i18n-attr="attr:key"` for attributes); German visitors see the German text before the page appears. The game calls `t(key)` and `tn(key, n)` for plurals. The language comes from `?lang=`, then the saved choice (`sp.lang`), then the browser language. The EN/DE switch saves the choice and reloads. To add text, add the English and German entries in `i18n.ts`; to add a language, add its dictionary there and to `LANGS`.

## The game server

`apps/server/src/room.ts` holds all room logic as plain functions (join, start, draw, leave, timers) and is tested in Node. `apps/server/src/worker.ts` wraps it in a Durable Object: it stores the room after every change, delivers messages over hibernating WebSockets, and uses the alarm for bot moves and timeouts.

- `POST /api/rooms` creates a room with a 5-letter code. It only accepts origins listed in `ALLOWED_ORIGINS` (`wrangler.jsonc`) or localhost.
- Creating rooms and asking for quick-match seats is limited per address by the `Limiter` Durable Object (one per IP, `src/limits.ts`): 8 rooms in a row, then one more per minute; 12 quick-match requests, then one per 15 seconds. Too many answers `429` with `Retry-After`, and the page says how long to wait. The limiter forgets an address once its allowance is full again.
- `GET /api/rooms/:code/ws` is the WebSocket. The first message is `hello` with a name, plus the saved token when reconnecting.
- Bots move about 3 seconds apart so everyone's animations keep up. A player who doesn't draw within 45 seconds gets a random card. Someone who disconnects has their turns drawn for them after 12 seconds, and their seat is kept until they reconnect. Rooms nobody has been connected to for 30 minutes are deleted.

Deploying: `npm run deploy:server` (after `npx wrangler login`), then set the worker's URL as `VITE_SERVER_URL` in `apps/web/.env.production`.

## The engine in short

```ts
import { createGame, drawCard, currentTurn, viewFor, ALPINE_DECK } from '@sp/engine';

let { state } = createGame({ players: [{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Ben' }], pairs: ALPINE_DECK, seed: 42 });
const turn = currentTurn(state);            // { offerer, drawer, slots }
({ state } = drawCard(state, turn.drawer, 0));
viewFor(state, 'a');                        // only what Ana may see: her hand plus card counts
```

Every action returns a new state plus a list of events (`cardDrawn`, `pairLaidDown`, `playerOut`, `nextTurn`, `gameOver`…), so the UI can animate them. The same seed always gives the same game.

Rules: all cards are dealt starting left of the dealer, and dealt pairs are laid down. The player left of the dealer offers first, and the turn passes clockwise. You always draw from the nearest player on your right who still has cards. The last player holding the Schwarzer Peter loses.
