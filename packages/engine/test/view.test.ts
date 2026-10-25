import { describe, expect, it } from 'vitest';
import { ALPINE_DECK, createGame, drawCard, eventFor, viewFor } from '../src';
import { seats } from './helpers';

describe('viewFor', () => {
  const { state } = createGame({ players: seats('a', 'b', 'c', 'd'), pairs: ALPINE_DECK, seed: 11 });

  it('shows your own hand and only card counts for everyone else', () => {
    const view = viewFor(state, 'a');
    expect(view.you).toBe('a');
    expect(view.hand).toEqual(state.players[0]!.hand);
    expect(view.seats.map((s) => s.cardCount)).toEqual(state.players.map((p) => p.hand.length));
  });

  it('never contains another player’s card ids or faces', () => {
    for (const viewer of ['a', 'b', 'c', 'd']) {
      const json = JSON.stringify(viewFor(state, viewer));
      for (const p of state.players) {
        if (p.id === viewer) continue;
        for (const card of p.hand) expect(json).not.toContain(card.id);
      }
    }
  });

  it('gives spectators no hand at all', () => {
    const view = viewFor(state, null);
    expect(view.you).toBeNull();
    expect(view.hand).toEqual([]);
    const json = JSON.stringify(view);
    for (const card of state.players.flatMap((p) => p.hand)) expect(json).not.toContain(card.id);
  });
});

describe('eventFor', () => {
  it('shows the drawn card only to the drawer and the offerer', () => {
    const { state } = createGame({ players: seats('a', 'b', 'c'), pairs: ALPINE_DECK, seed: 4, dealer: 0 });
    // b offers to c
    const { events } = drawCard(state, 'c', 0);
    const drawn = events.find((e) => e.type === 'cardDrawn')!;
    expect(eventFor(drawn, 'c')).toEqual(drawn);
    expect(eventFor(drawn, 'b')).toEqual(drawn);
    expect(eventFor(drawn, 'a')).toMatchObject({ type: 'cardDrawn', card: null, slot: 0 });
    expect(eventFor(drawn, null)).toMatchObject({ card: null });
  });
});
