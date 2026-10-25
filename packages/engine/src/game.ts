import { Rng, toSeed } from './rng';
import {
  GameError,
  PETER,
  type ActionResult,
  type Card,
  type GameConfig,
  type GameEvent,
  type GameState,
  type Pair,
  type Phase,
  type PlayerId,
  type PlayerSeat,
} from './types';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;

/* ------------------------------------------------------------------ */
/* Setup                                                               */
/* ------------------------------------------------------------------ */

/** Shuffle, deal every card starting left of the dealer, and lay down the pairs dealt. */
export function createGame(config: GameConfig): ActionResult {
  checkSeats(config.players);
  checkPairKeys(config.pairs);
  const rng = new Rng(toSeed(config.seed));
  const n = config.players.length;
  const dealer = config.dealer ?? rng.int(n);
  checkDealer(dealer, n);

  const deck = rng.shuffle([...config.pairs.flatMap((key) => [key, key]), PETER]);
  const hands: string[][] = config.players.map(() => []);
  deck.forEach((face, i) => hands[(dealer + 1 + i) % n]!.push(face));
  return setup(config.players, hands, dealer, rng);
}

/**
 * Start a game from hands chosen by the caller instead of a shuffled deal.
 * Used by tests and, later, by tutorials that need a known position.
 */
export function createGameFromHands(input: {
  readonly players: readonly (PlayerSeat & { readonly hand: readonly string[] })[];
  readonly dealer: number;
  readonly seed: number | string;
}): ActionResult {
  checkSeats(input.players);
  checkDealer(input.dealer, input.players.length);
  const counts = new Map<string, number>();
  for (const p of input.players) for (const face of p.hand) counts.set(face, (counts.get(face) ?? 0) + 1);
  if (counts.get(PETER) !== 1) throw new GameError('INVALID_CONFIG', 'There must be exactly one Schwarzer Peter.');
  for (const [face, count] of counts) {
    if (face !== PETER && count !== 2) throw new GameError('INVALID_CONFIG', `Card "${face}" appears ${count} times; every pair card must appear twice.`);
  }
  return setup(input.players, input.players.map((p) => [...p.hand]), input.dealer, new Rng(toSeed(input.seed)));
}

function setup(seats: readonly PlayerSeat[], hands: string[][], dealer: number, rng: Rng): ActionResult {
  const events: GameEvent[] = [];
  const used = new Set<string>();
  const newId = () => {
    let id = rng.id();
    while (used.has(id)) id = rng.id();
    used.add(id);
    return id;
  };
  const d: Draft = {
    players: seats.map((s, i) => ({ id: s.id, name: s.name, hand: hands[i]!.map((face) => ({ id: newId(), face })) })),
    dealer,
    offerer: null,
    drawer: null,
    pairs: [],
    phase: 'playing',
    loser: null,
    finishOrder: [],
    turn: 0,
  };

  for (const p of d.players) {
    const kept: Card[] = [];
    for (const card of p.hand) {
      const match = kept.findIndex((c) => c.face === card.face && card.face !== PETER);
      if (match >= 0) {
        const [first] = kept.splice(match, 1) as [Card];
        layDown(d, p.id, first, card, true, events);
      } else {
        kept.push(card);
      }
    }
    p.hand = kept;
  }
  for (const p of d.players) if (p.hand.length === 0) markOut(d, p.id, events);

  // The player left of the dealer offers first (skipping anyone already out).
  const n = d.players.length;
  const first = (dealer + 1) % n;
  startNextTurn(d, hasCards(d, first) ? first : nextWithCards(d, first), events);
  return { state: freeze(d, rng), events };
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

/** The drawer takes the card at `slot` from the offerer's hand. */
export function drawCard(state: GameState, playerId: PlayerId, slot: number): ActionResult {
  if (state.phase === 'over') throw new GameError('GAME_OVER', 'The game is over.');
  const seat = seatOf(state, playerId);
  if (seat !== state.drawer || state.offerer === null) throw new GameError('NOT_YOUR_TURN', `It is not ${playerId}'s turn to draw.`);

  const d = draftOf(state);
  const rng = new Rng(state.rng);
  const offerer = d.players[state.offerer]!;
  const drawer = d.players[seat]!;
  if (!Number.isInteger(slot) || slot < 0 || slot >= offerer.hand.length) {
    throw new GameError('INVALID_SLOT', `Slot ${slot} is not in a hand of ${offerer.hand.length} cards.`);
  }

  const events: GameEvent[] = [];
  const [card] = offerer.hand.splice(slot, 1) as [Card];
  events.push({ type: 'cardDrawn', drawer: drawer.id, offerer: offerer.id, slot, card });

  const match = card.face === PETER ? -1 : drawer.hand.findIndex((c) => c.face === card.face);
  if (match >= 0) {
    const [own] = drawer.hand.splice(match, 1) as [Card];
    layDown(d, drawer.id, own, card, false, events);
  } else {
    drawer.hand.push(card);
  }
  d.turn += 1;

  if (offerer.hand.length === 0) markOut(d, offerer.id, events);
  if (drawer.hand.length === 0) markOut(d, drawer.id, events);
  startNextTurn(d, seat, events);
  return { state: freeze(d, rng), events };
}

/** Put your hand in a new order. Allowed at any time while playing, which is how you bluff. */
export function rearrangeHand(state: GameState, playerId: PlayerId, order: readonly string[]): ActionResult {
  if (state.phase === 'over') throw new GameError('GAME_OVER', 'The game is over.');
  const seat = seatOf(state, playerId);
  const hand = state.players[seat]!.hand;
  const byId = new Map(hand.map((c) => [c.id, c]));
  if (order.length !== hand.length || new Set(order).size !== order.length || order.some((id) => !byId.has(id))) {
    throw new GameError('INVALID_ORDER', 'The new order must list every card in your hand exactly once.');
  }
  const d = draftOf(state);
  d.players[seat]!.hand = order.map((id) => byId.get(id)!);
  return { state: freeze(d, new Rng(state.rng)), events: [{ type: 'handRearranged', playerId }] };
}

/** Shuffle your hand randomly. */
export function shuffleHand(state: GameState, playerId: PlayerId): ActionResult {
  if (state.phase === 'over') throw new GameError('GAME_OVER', 'The game is over.');
  const seat = seatOf(state, playerId);
  const rng = new Rng(state.rng);
  const d = draftOf(state);
  d.players[seat]!.hand = rng.shuffle([...d.players[seat]!.hand]);
  return { state: freeze(d, rng), events: [{ type: 'handRearranged', playerId }] };
}

/* ------------------------------------------------------------------ */
/* Queries                                                             */
/* ------------------------------------------------------------------ */

/** Who draws from whom right now, and how many cards there are to pick from. */
export function currentTurn(state: GameState): { offerer: PlayerId; drawer: PlayerId; slots: number } | null {
  if (state.phase === 'over' || state.offerer === null || state.drawer === null) return null;
  const offerer = state.players[state.offerer]!;
  return { offerer: offerer.id, drawer: state.players[state.drawer]!.id, slots: offerer.hand.length };
}

export function seatOf(state: GameState, playerId: PlayerId): number {
  const seat = state.players.findIndex((p) => p.id === playerId);
  if (seat < 0) throw new GameError('UNKNOWN_PLAYER', `No player with id ${playerId}.`);
  return seat;
}

/* ------------------------------------------------------------------ */
/* Internals                                                           */
/* ------------------------------------------------------------------ */

interface Draft {
  players: { id: PlayerId; name: string; hand: Card[] }[];
  dealer: number;
  offerer: number | null;
  drawer: number | null;
  pairs: Pair[];
  phase: Phase;
  loser: PlayerId | null;
  finishOrder: PlayerId[];
  turn: number;
}

function draftOf(s: GameState): Draft {
  return {
    players: s.players.map((p) => ({ id: p.id, name: p.name, hand: [...p.hand] })),
    dealer: s.dealer,
    offerer: s.offerer,
    drawer: s.drawer,
    pairs: [...s.pairs],
    phase: s.phase,
    loser: s.loser,
    finishOrder: [...s.finishOrder],
    turn: s.turn,
  };
}

function freeze(d: Draft, rng: Rng): GameState {
  return { ...d, rng: rng.state };
}

function layDown(d: Draft, playerId: PlayerId, a: Card, b: Card, atDeal: boolean, events: GameEvent[]) {
  const cards = [a, b] as const;
  d.pairs.push({ playerId, cards });
  events.push({ type: 'pairLaidDown', playerId, cards, atDeal });
}

function markOut(d: Draft, playerId: PlayerId, events: GameEvent[]) {
  if (d.finishOrder.includes(playerId)) return;
  d.finishOrder.push(playerId);
  events.push({ type: 'playerOut', playerId });
}

const hasCards = (d: Draft, seat: number) => d.players[seat]!.hand.length > 0;

function nextWithCards(d: Draft, from: number): number {
  const n = d.players.length;
  for (let k = 1; k < n; k++) if (hasCards(d, (from + k) % n)) return (from + k) % n;
  return -1;
}

function prevWithCards(d: Draft, from: number): number {
  const n = d.players.length;
  for (let k = 1; k < n; k++) if (hasCards(d, (from - k + n) % n)) return (from - k + n) % n;
  return -1;
}

/**
 * The turn passes clockwise to the next player with cards, who draws from
 * the nearest player with cards on their right. Ends the game when only
 * one player still holds cards: that player has the Schwarzer Peter.
 */
function startNextTurn(d: Draft, fromSeat: number, events: GameEvent[]) {
  const holders = d.players.filter((p) => p.hand.length > 0);
  if (holders.length <= 1) {
    const loser = holders[0];
    if (!loser || loser.hand.length !== 1 || loser.hand[0]!.face !== PETER) {
      throw new Error('Engine invariant broken: the game ended without a lone Schwarzer Peter.');
    }
    d.phase = 'over';
    d.offerer = null;
    d.drawer = null;
    d.loser = loser.id;
    events.push({ type: 'gameOver', loser: loser.id });
    return;
  }
  const drawer = nextWithCards(d, fromSeat);
  const offerer = prevWithCards(d, drawer);
  d.drawer = drawer;
  d.offerer = offerer;
  events.push({ type: 'nextTurn', offerer: d.players[offerer]!.id, drawer: d.players[drawer]!.id });
}

function checkSeats(players: readonly PlayerSeat[]) {
  if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) {
    throw new GameError('INVALID_CONFIG', `A game needs ${MIN_PLAYERS} to ${MAX_PLAYERS} players.`);
  }
  if (new Set(players.map((p) => p.id)).size !== players.length) {
    throw new GameError('INVALID_CONFIG', 'Player ids must be unique.');
  }
}

function checkPairKeys(pairs: readonly string[]) {
  if (pairs.length < 1) throw new GameError('INVALID_CONFIG', 'The deck needs at least one pair.');
  if (new Set(pairs).size !== pairs.length) throw new GameError('INVALID_CONFIG', 'Pair keys must be unique.');
  if (pairs.includes(PETER)) throw new GameError('INVALID_CONFIG', `"${PETER}" is reserved for the Schwarzer Peter.`);
}

function checkDealer(dealer: number, n: number) {
  if (!Number.isInteger(dealer) || dealer < 0 || dealer >= n) {
    throw new GameError('INVALID_CONFIG', `Dealer must be a seat index from 0 to ${n - 1}.`);
  }
}
