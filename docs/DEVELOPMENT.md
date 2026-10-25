# Developer notes

How the Schwarzer Peter project is built. For the game itself, see the [README](../README.md).

## Project layout

```
apps/web          Website (index.html, deck.html) and the game (play.html, React in src/play). Vite + Tailwind, deployed on Vercel.
packages/engine   The game rules in plain TypeScript, shared by the website, bots and the game server.
brand_assets      Logo source file and brand guidelines.
```

## Getting started

```
npm install
npm run dev        # website at http://localhost:3000 (same as: node serve.mjs)
npm test           # engine tests
npm run typecheck
npm run build      # production build in apps/web/dist
```

`node screenshot.mjs http://localhost:3000 [label]` saves a full-page screenshot to `temporary screenshots/`, using your installed Chrome or Edge.

## The game page

`src/play/host.ts` runs a practice game in the browser: it owns the full engine state and the bots, and gives the table only what you may see (`viewFor`/`eventFor`) as a stream of steps. `src/play/Table.tsx` plays those steps one at a time with card animations and calls `ready()` when it has caught up, which is when the next bot moves. An online host for Phase 3 will produce the same steps from the server.

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
