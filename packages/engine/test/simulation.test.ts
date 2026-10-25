import { describe, expect, it } from 'vitest';
import { ALPINE_DECK, PETER, Rng, createGame, currentTurn, drawCard, shuffleHand, type GameState } from '../src';
import { assertInvariants, seats } from './helpers';

/** Plays a whole game with random draws (and the odd shuffle), checking the rules after every move. */
function playOut(players: number, seed: number) {
  const pick = new Rng(seed * 31 + 7);
  const ids = 'abcdef'.slice(0, players).split('');
  let { state } = createGame({ players: seats(...ids), pairs: ALPINE_DECK, seed });
  assertInvariants(state, ALPINE_DECK);
  let moves = 0;
  for (let turn = currentTurn(state); turn; turn = currentTurn(state)) {
    if (pick.next() < 0.2) state = shuffleHand(state, turn.offerer).state;
    state = drawCard(state, turn.drawer, pick.int(turn.slots)).state;
    assertInvariants(state, ALPINE_DECK);
    if (++moves > 5000) throw new Error(`game ${players}p/${seed} did not end`);
  }
  return { state, moves };
}

function checkFinished(state: GameState) {
  expect(state.phase).toBe('over');
  const loser = state.players.find((p) => p.id === state.loser)!;
  expect(loser.hand.map((c) => c.face)).toEqual([PETER]);
  for (const p of state.players) if (p !== loser) expect(p.hand).toHaveLength(0);
  expect(state.pairs).toHaveLength(ALPINE_DECK.length);
  expect([...state.finishOrder, loser.id].sort()).toEqual(state.players.map((p) => p.id).sort());
}

describe('random games', () => {
  for (let players = 2; players <= 6; players++) {
    it(`always end correctly with ${players} players`, () => {
      const losses = new Map<string, number>();
      for (let seed = 1; seed <= 400; seed++) {
        const { state } = playOut(players, seed);
        checkFinished(state);
        losses.set(state.loser!, (losses.get(state.loser!) ?? 0) + 1);
      }
      // Every seat should lose sometimes: no seat is structurally safe.
      expect(losses.size).toBe(players);
    });
  }
});
