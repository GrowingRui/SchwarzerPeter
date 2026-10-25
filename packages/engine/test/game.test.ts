import { describe, expect, it } from 'vitest';
import {
  ALPINE_DECK,
  GameError,
  PETER,
  createGame,
  createGameFromHands,
  currentTurn,
  drawCard,
  rearrangeHand,
  shuffleHand,
  type GameState,
} from '../src';
import { assertInvariants, faces, ids, seats, slotOf } from './helpers';

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    if (e instanceof GameError) return e.code;
    throw e;
  }
  return 'NO_ERROR';
};

describe('createGame', () => {
  it('deals the whole deck with unique, opaque card ids', () => {
    const { state } = createGame({ players: seats('a', 'b', 'c'), pairs: ALPINE_DECK, seed: 1 });
    assertInvariants(state, ALPINE_DECK);
    const all = [...state.players.flatMap((p) => p.hand), ...state.pairs.flatMap((p) => p.cards)];
    expect(all).toHaveLength(37);
    for (const card of all) {
      expect(card.id).toMatch(/^[0-9a-z]{10}$/);
      expect(card.id).not.toContain(card.face);
    }
  });

  it('is reproducible from the seed', () => {
    const config = { players: seats('a', 'b', 'c', 'd'), pairs: ALPINE_DECK, seed: 'room-KATZE' };
    expect(createGame(config).state).toEqual(createGame(config).state);
    expect(createGame({ ...config, seed: 'other' }).state).not.toEqual(createGame(config).state);
  });

  it('deals starting left of the dealer, so the dealer may get one card fewer', () => {
    const { state } = createGame({ players: seats('a', 'b', 'c'), pairs: ALPINE_DECK, seed: 7, dealer: 0 });
    const dealt = (id: string) =>
      faces(state, id).length + state.pairs.filter((p) => p.playerId === id).length * 2;
    // 37 cards: b and c (left of the dealer) get 12 + 1, the dealer gets 12.
    expect([dealt('a'), dealt('b'), dealt('c')]).toEqual([12, 13, 12]);
  });

  it('lays down every pair a player is dealt', () => {
    for (let seed = 0; seed < 50; seed++) {
      const { state, events } = createGame({ players: seats('a', 'b'), pairs: ALPINE_DECK, seed });
      assertInvariants(state, ALPINE_DECK);
      expect(events.filter((e) => e.type === 'pairLaidDown').every((e) => e.type === 'pairLaidDown' && e.atDeal)).toBe(true);
    }
  });

  it('rejects bad setups', () => {
    expect(code(() => createGame({ players: seats('a'), pairs: ALPINE_DECK, seed: 1 }))).toBe('INVALID_CONFIG');
    expect(code(() => createGame({ players: seats('a', 'b', 'c', 'd', 'e', 'f', 'g'), pairs: ALPINE_DECK, seed: 1 }))).toBe('INVALID_CONFIG');
    expect(code(() => createGame({ players: seats('a', 'a'), pairs: ALPINE_DECK, seed: 1 }))).toBe('INVALID_CONFIG');
    expect(code(() => createGame({ players: seats('a', 'b'), pairs: ['fuchs', 'fuchs'], seed: 1 }))).toBe('INVALID_CONFIG');
    expect(code(() => createGame({ players: seats('a', 'b'), pairs: [PETER], seed: 1 }))).toBe('INVALID_CONFIG');
    expect(code(() => createGame({ players: seats('a', 'b'), pairs: ALPINE_DECK, seed: 1, dealer: 2 }))).toBe('INVALID_CONFIG');
    expect(code(() => createGameFromHands({ players: [{ id: 'a', name: 'A', hand: ['fuchs'] }, { id: 'b', name: 'B', hand: [PETER] }], dealer: 0, seed: 1 }))).toBe('INVALID_CONFIG');
  });
});

describe('turn order', () => {
  it('starts with the player left of the dealer offering to the next player', () => {
    const { state } = createGameFromHands({
      dealer: 0,
      seed: 1,
      players: [
        { id: 'a', name: 'A', hand: ['fuchs', 'igel'] },
        { id: 'b', name: 'B', hand: ['fuchs', 'eule'] },
        { id: 'c', name: 'C', hand: ['igel', 'eule', PETER] },
      ],
    });
    expect(ids(state)).toEqual({ offerer: 'b', drawer: 'c' });
    expect(currentTurn(state)).toEqual({ offerer: 'b', drawer: 'c', slots: 2 });
  });

  it('passes clockwise: whoever just drew offers to the next player', () => {
    let { state } = createGameFromHands({
      dealer: 0,
      seed: 1,
      players: [
        { id: 'a', name: 'A', hand: ['fuchs', 'igel', 'wolf'] },
        { id: 'b', name: 'B', hand: ['fuchs', 'eule', 'kuh'] },
        { id: 'c', name: 'C', hand: ['igel', 'eule', 'kuh', 'wolf', PETER] },
      ],
    });
    state = drawCard(state, 'c', slotOf(state, 'b', 'fuchs')).state; // c draws from b, no match
    expect(ids(state)).toEqual({ offerer: 'c', drawer: 'a' });
    state = drawCard(state, 'a', slotOf(state, 'c', PETER)).state; // a draws from c
    expect(ids(state)).toEqual({ offerer: 'a', drawer: 'b' });
  });

  it('skips the starting player if they were dealt only pairs', () => {
    const { state, events } = createGameFromHands({
      dealer: 0,
      seed: 1,
      players: [
        { id: 'a', name: 'A', hand: ['igel'] },
        { id: 'b', name: 'B', hand: ['fuchs', 'fuchs'] },
        { id: 'c', name: 'C', hand: ['igel', PETER] },
      ],
    });
    expect(events).toContainEqual({ type: 'playerOut', playerId: 'b' });
    expect(ids(state)).toEqual({ offerer: 'c', drawer: 'a' });
  });
});

describe('drawCard', () => {
  const start = () =>
    createGameFromHands({
      dealer: 2,
      seed: 3,
      players: [
        { id: 'a', name: 'A', hand: ['fuchs', 'igel'] },
        { id: 'b', name: 'B', hand: ['fuchs', 'eule', PETER] },
        { id: 'c', name: 'C', hand: ['igel', 'eule'] },
      ],
    }).state; // a offers to b

  it('lays down a pair when the drawn card matches', () => {
    const before = start();
    const { state, events } = drawCard(before, 'b', slotOf(before, 'a', 'fuchs'));
    expect(faces(state, 'b').sort()).toEqual(['eule', PETER].sort());
    expect(faces(state, 'a')).toEqual(['igel']);
    expect(state.pairs.at(-1)?.cards.map((c) => c.face)).toEqual(['fuchs', 'fuchs']);
    expect(events.map((e) => e.type)).toEqual(['cardDrawn', 'pairLaidDown', 'nextTurn']);
    assertInvariants(state, ['fuchs', 'igel', 'eule']);
  });

  it('adds the card to the hand when it does not match', () => {
    let { state } = createGameFromHands({
      dealer: 0,
      seed: 3,
      players: [
        { id: 'a', name: 'A', hand: ['fuchs', 'eule'] },
        { id: 'b', name: 'B', hand: ['igel', PETER] },
        { id: 'c', name: 'C', hand: ['fuchs', 'igel', 'eule'] },
      ],
    }); // b offers to c
    state = drawCard(state, 'c', slotOf(state, 'b', PETER)).state;
    expect(faces(state, 'c')).toEqual(['fuchs', 'igel', 'eule', PETER]);
    expect(faces(state, 'b')).toEqual(['igel']);
  });

  it('never pairs the Schwarzer Peter', () => {
    const before = start();
    const { state } = drawCard(before, 'b', slotOf(before, 'a', 'igel'));
    expect(state.pairs.every((p) => p.cards[0].face !== PETER)).toBe(true);
  });

  it('only lets the current drawer draw, from a real slot', () => {
    const state = start();
    expect(code(() => drawCard(state, 'a', 0))).toBe('NOT_YOUR_TURN');
    expect(code(() => drawCard(state, 'c', 0))).toBe('NOT_YOUR_TURN');
    expect(code(() => drawCard(state, 'zed', 0))).toBe('UNKNOWN_PLAYER');
    expect(code(() => drawCard(state, 'b', 2))).toBe('INVALID_SLOT');
    expect(code(() => drawCard(state, 'b', -1))).toBe('INVALID_SLOT');
    expect(code(() => drawCard(state, 'b', 0.5))).toBe('INVALID_SLOT');
  });

  it('does not change the state it was given', () => {
    const state = start();
    const snapshot = JSON.parse(JSON.stringify(state));
    drawCard(state, 'b', 0);
    expect(state).toEqual(snapshot);
  });

  it('puts the offerer out when their last card is taken', () => {
    let { state } = createGameFromHands({
      dealer: 2,
      seed: 3,
      players: [
        { id: 'a', name: 'A', hand: ['fuchs'] },
        { id: 'b', name: 'B', hand: ['igel', PETER] },
        { id: 'c', name: 'C', hand: ['fuchs', 'igel'] },
      ],
    }); // a offers to b
    const result = drawCard(state, 'b', 0);
    state = result.state;
    expect(result.events).toContainEqual({ type: 'playerOut', playerId: 'a' });
    expect(state.finishOrder).toEqual(['a']);
    // b now offers to c; a is skipped from now on.
    expect(ids(state)).toEqual({ offerer: 'b', drawer: 'c' });
  });

  it('when the drawer empties their hand, the next player draws from the nearest player with cards on their right', () => {
    let { state } = createGameFromHands({
      dealer: 3,
      seed: 3,
      players: [
        { id: 'a', name: 'A', hand: ['fuchs', 'igel', PETER] },
        { id: 'b', name: 'B', hand: ['fuchs'] },
        { id: 'c', name: 'C', hand: ['igel', 'eule'] },
        { id: 'd', name: 'D', hand: ['eule'] },
      ],
    }); // a offers to b
    state = drawCard(state, 'b', slotOf(state, 'a', 'fuchs')).state; // b pairs and is out
    expect(state.finishOrder).toEqual(['b']);
    expect(ids(state)).toEqual({ offerer: 'a', drawer: 'c' });
  });

  it('plays a two-player game to the end', () => {
    let { state } = createGameFromHands({
      dealer: 1,
      seed: 9,
      players: [
        { id: 'a', name: 'A', hand: ['fuchs', 'igel'] },
        { id: 'b', name: 'B', hand: ['fuchs', 'igel', PETER] },
      ],
    }); // a offers to b
    expect(ids(state)).toEqual({ offerer: 'a', drawer: 'b' });
    state = drawCard(state, 'b', slotOf(state, 'a', 'fuchs')).state;
    expect(ids(state)).toEqual({ offerer: 'b', drawer: 'a' });
    state = drawCard(state, 'a', slotOf(state, 'b', PETER)).state;
    expect(ids(state)).toEqual({ offerer: 'a', drawer: 'b' });
    const end = drawCard(state, 'b', slotOf(state, 'a', 'igel'));
    expect(end.state.phase).toBe('over');
    expect(end.state.loser).toBe('a');
    expect(end.state.finishOrder).toEqual(['b']);
    expect(end.events.at(-1)).toEqual({ type: 'gameOver', loser: 'a' });
    expect(currentTurn(end.state)).toBeNull();
    expect(code(() => drawCard(end.state, 'a', 0))).toBe('GAME_OVER');
  });

  it('ends at the deal if only the Peter holder has cards left', () => {
    const { state, events } = createGameFromHands({
      dealer: 0,
      seed: 1,
      players: [
        { id: 'a', name: 'A', hand: ['fuchs', 'fuchs'] },
        { id: 'b', name: 'B', hand: [PETER] },
      ],
    });
    expect(state.phase).toBe('over');
    expect(state.loser).toBe('b');
    expect(events.at(-1)).toEqual({ type: 'gameOver', loser: 'b' });
  });
});

describe('rearranging a hand', () => {
  const state = createGame({ players: seats('a', 'b', 'c'), pairs: ALPINE_DECK, seed: 5 }).state;
  const handIds = (s: GameState, id: string) => s.players.find((p) => p.id === id)!.hand.map((c) => c.id);

  it('accepts any order of the same cards, even when it is not your turn', () => {
    const order = [...handIds(state, 'a')].reverse();
    const { state: next, events } = rearrangeHand(state, 'a', order);
    expect(handIds(next, 'a')).toEqual(order);
    expect(events).toEqual([{ type: 'handRearranged', playerId: 'a' }]);
  });

  it('rejects orders that add, drop or repeat cards', () => {
    const hand = handIds(state, 'a');
    const other = handIds(state, 'b')[0]!;
    expect(code(() => rearrangeHand(state, 'a', hand.slice(1)))).toBe('INVALID_ORDER');
    expect(code(() => rearrangeHand(state, 'a', [...hand.slice(1), other]))).toBe('INVALID_ORDER');
    expect(code(() => rearrangeHand(state, 'a', [hand[0]!, ...hand.slice(0, -1)]))).toBe('INVALID_ORDER');
  });

  it('shuffles without changing the cards', () => {
    const { state: next } = shuffleHand(state, 'b');
    expect([...handIds(next, 'b')].sort()).toEqual([...handIds(state, 'b')].sort());
    expect(next.rng).not.toBe(state.rng);
  });
});
