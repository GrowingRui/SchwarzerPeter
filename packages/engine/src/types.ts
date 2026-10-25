/** Face of the single card without a partner. */
export const PETER = 'peter';

export type PlayerId = string;

export interface Card {
  /** Random per game, so an id never reveals which card it is. */
  readonly id: string;
  /** Pair key (e.g. "steinbock") or PETER. */
  readonly face: string;
}

export interface Player {
  readonly id: PlayerId;
  readonly name: string;
  readonly hand: readonly Card[];
}

export interface Pair {
  readonly playerId: PlayerId;
  readonly cards: readonly [Card, Card];
}

export type Phase = 'playing' | 'over';

export interface GameState {
  /** Seats in clockwise order. */
  readonly players: readonly Player[];
  /** Seat index of the dealer. */
  readonly dealer: number;
  /** Seat index whose hand is drawn from this turn; null once the game is over. */
  readonly offerer: number | null;
  /** Seat index who draws this turn; null once the game is over. */
  readonly drawer: number | null;
  /** Pairs laid face up on the table, in the order they were laid down. */
  readonly pairs: readonly Pair[];
  readonly phase: Phase;
  /** Player left holding the Schwarzer Peter. */
  readonly loser: PlayerId | null;
  /** Players who got rid of all their cards, in the order they went out. */
  readonly finishOrder: readonly PlayerId[];
  /** Number of draws made so far. */
  readonly turn: number;
  /** Random generator state. */
  readonly rng: number;
}

export type GameEvent =
  | { readonly type: 'pairLaidDown'; readonly playerId: PlayerId; readonly cards: readonly [Card, Card]; readonly atDeal: boolean }
  | {
      readonly type: 'cardDrawn';
      readonly drawer: PlayerId;
      readonly offerer: PlayerId;
      readonly slot: number;
      /** Hidden (null) for everyone except the drawer and the offerer, see eventFor(). */
      readonly card: Card | null;
    }
  | { readonly type: 'handRearranged'; readonly playerId: PlayerId }
  | { readonly type: 'playerOut'; readonly playerId: PlayerId }
  | { readonly type: 'nextTurn'; readonly offerer: PlayerId; readonly drawer: PlayerId }
  | { readonly type: 'gameOver'; readonly loser: PlayerId };

export interface ActionResult {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}

export interface PlayerSeat {
  readonly id: PlayerId;
  readonly name: string;
}

export interface GameConfig {
  /** 2 to 6 players, in clockwise seat order. */
  readonly players: readonly PlayerSeat[];
  /** One key per pair, e.g. the 18 animals of the Alpine deck. */
  readonly pairs: readonly string[];
  readonly seed: number | string;
  /** Seat index of the dealer. Defaults to a random seat. */
  readonly dealer?: number;
}

export type GameErrorCode =
  | 'INVALID_CONFIG'
  | 'GAME_OVER'
  | 'NOT_YOUR_TURN'
  | 'INVALID_SLOT'
  | 'UNKNOWN_PLAYER'
  | 'INVALID_ORDER';

export class GameError extends Error {
  constructor(readonly code: GameErrorCode, message: string) {
    super(message);
    this.name = 'GameError';
  }
}
