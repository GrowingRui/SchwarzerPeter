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

Either way, `src/play/Table.tsx` gets its game as a stream of steps (`deal`, `action`, `hover`, `sync`) from a `GameHost`. It plays them one at a time with card animations, and it only ever receives what this player may see. The practice host waits for the table's `ready()` before a bot moves. The online host (`src/play/room-client.ts`) gets steps from the server, which sets the pace itself.

## The game server

`apps/server/src/room.ts` holds all room logic as plain functions (join, start, draw, leave, timers) and is tested in Node. `apps/server/src/worker.ts` wraps it in a Durable Object: it stores the room after every change, delivers messages over hibernating WebSockets, and uses the alarm for bot moves and timeouts.

- `POST /api/rooms` creates a room with a 5-letter code. It only accepts origins listed in `ALLOWED_ORIGINS` (`wrangler.jsonc`) or localhost.
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
