import { PETER, type GameState } from '../src';

export const seats = (...ids: string[]) => ids.map((id) => ({ id, name: id.toUpperCase() }));

export const faces = (state: GameState, playerId: string) =>
  state.players.find((p) => p.id === playerId)!.hand.map((c) => c.face);

export const ids = (state: GameState) => ({
  offerer: state.offerer === null ? null : state.players[state.offerer]!.id,
  drawer: state.drawer === null ? null : state.players[state.drawer]!.id,
});

/** Slot of the first card with this face in a player's hand. */
export const slotOf = (state: GameState, playerId: string, face: string) => {
  const slot = state.players.find((p) => p.id === playerId)!.hand.findIndex((c) => c.face === face);
  if (slot < 0) throw new Error(`${playerId} has no ${face}`);
  return slot;
};

/** Checks that must hold after every action. */
export function assertInvariants(state: GameState, pairKeys: readonly string[]) {
  const all = [...state.players.flatMap((p) => p.hand), ...state.pairs.flatMap((p) => p.cards)];
  if (all.length !== pairKeys.length * 2 + 1) throw new Error(`card count ${all.length}`);
  if (new Set(all.map((c) => c.id)).size !== all.length) throw new Error('duplicate card ids');
  if (all.filter((c) => c.face === PETER).length !== 1) throw new Error('Peter count');
  for (const p of state.players) {
    const fs = p.hand.map((c) => c.face);
    if (new Set(fs).size !== fs.length) throw new Error(`${p.id} holds a pair`);
  }
  for (const pair of state.pairs) {
    if (pair.cards[0].face !== pair.cards[1].face) throw new Error('mismatched pair on table');
  }
  if (state.phase === 'playing') {
    if (state.offerer === null || state.drawer === null) throw new Error('no turn while playing');
    if (state.offerer === state.drawer) throw new Error('drawing from yourself');
    if (!state.players[state.offerer]!.hand.length || !state.players[state.drawer]!.hand.length) {
      throw new Error('empty-handed player in the turn');
    }
  }
}
