# Schwarzer Peter

The traditional German and Swiss card game, played online. Live site: https://schwarzerpeter.vercel.app

## Project layout

```
apps/web          Website and (soon) game screens. Vite + Tailwind, deployed on Vercel.
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
