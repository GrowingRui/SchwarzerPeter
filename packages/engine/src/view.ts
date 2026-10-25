import type { Card, GameEvent, GameState, Pair, Phase, PlayerId } from './types';

/** What one player is allowed to know. Safe to send to that player's browser. */
export interface PlayerView {
  /** The viewer, or null for a spectator. */
  readonly you: PlayerId | null;
  readonly phase: Phase;
  readonly turn: number;
  readonly seats: readonly {
    readonly id: PlayerId;
    readonly name: string;
    readonly cardCount: number;
    readonly isOut: boolean;
    readonly isDealer: boolean;
  }[];
  /** The viewer's own cards, in their order. Empty for spectators. */
  readonly hand: readonly Card[];
  readonly offerer: PlayerId | null;
  readonly drawer: PlayerId | null;
  readonly pairs: readonly Pair[];
  readonly loser: PlayerId | null;
  readonly finishOrder: readonly PlayerId[];
}

export function viewFor(state: GameState, viewer: PlayerId | null): PlayerView {
  const me = state.players.find((p) => p.id === viewer) ?? null;
  const idAt = (seat: number | null) => (seat === null ? null : state.players[seat]!.id);
  return {
    you: me ? me.id : null,
    phase: state.phase,
    turn: state.turn,
    seats: state.players.map((p, i) => ({
      id: p.id,
      name: p.name,
      cardCount: p.hand.length,
      isOut: state.finishOrder.includes(p.id),
      isDealer: i === state.dealer,
    })),
    hand: me ? [...me.hand] : [],
    offerer: idAt(state.offerer),
    drawer: idAt(state.drawer),
    pairs: state.pairs,
    loser: state.loser,
    finishOrder: state.finishOrder,
  };
}

/** Hide a drawn card from everyone except the two players who handled it. */
export function eventFor(event: GameEvent, viewer: PlayerId | null): GameEvent {
  if (event.type === 'cardDrawn' && viewer !== event.drawer && viewer !== event.offerer) {
    return { ...event, card: null };
  }
  return event;
}
