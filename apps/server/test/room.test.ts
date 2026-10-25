import { describe, expect, it } from 'vitest';
import { Rng, currentTurn, type GameState } from '@sp/engine';
import type { ServerMessage, Step } from '@sp/engine/protocol';
import { RoomError, TIMING, disconnect, handle, join, newRoom, nextAlarm, roomInfo, tick, type Outgoing, type RoomState } from '../src/room';

const seeded = (seed: number) => {
  const rng = new Rng(seed);
  return () => rng.next();
};

const errorCode = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    if (e instanceof RoomError) return e.code;
    throw e;
  }
  return 'NO_ERROR';
};

const to = (out: readonly Outgoing[], id: string) => out.filter((o) => o.to === id).map((o) => o.msg);
const steps = (out: readonly Outgoing[], id: string) =>
  to(out, id).flatMap((m) => (m.t === 'step' ? [m.step] : []));

/** A lobby with the given players already joined. */
function lobby(names: string[], random = seeded(1)) {
  let state = newRoom('KATZE', 0);
  const ids: string[] = [];
  const tokens: string[] = [];
  for (const name of names) {
    const r = join(state, name, undefined, 0, random);
    state = r.state;
    ids.push(r.memberId);
    tokens.push((to(r.out, r.memberId)[0] as Extract<ServerMessage, { t: 'welcome' }>).token);
  }
  return { state, ids, tokens, random };
}

describe('joining', () => {
  it('makes the first player the host and tells everyone who is in the room', () => {
    const { state, ids } = lobby(['Rui', 'Lena']);
    const info = roomInfo(state);
    expect(info.members.map((m) => [m.name, m.isHost])).toEqual([
      ['Rui', true],
      ['Lena', false],
    ]);
    expect(JSON.stringify(info)).not.toContain(state.members[0]!.token);
    expect(ids[0]).not.toBe(ids[1]);
  });

  it('cleans names and keeps them unique', () => {
    const { state } = lobby(['  Rui\u0007  ', 'Rui', '', 'A very long name that goes on']);
    expect(state.members.map((m) => m.name)).toEqual(['Rui', 'Rui 2', 'Player', 'A very long name']);
  });

  it('lets a player reconnect with their token instead of joining twice', () => {
    let { state, ids, tokens, random } = lobby(['Rui', 'Lena']);
    state = disconnect(state, ids[1]!, 5, random).state;
    expect(roomInfo(state).members[1]!.connected).toBe(false);
    const again = join(state, 'Lena', tokens[1], 6, random);
    expect(again.memberId).toBe(ids[1]);
    expect(again.state.members).toHaveLength(2);
    expect(roomInfo(again.state).members[1]!.connected).toBe(true);
  });

  it('refuses a seventh player and newcomers once the game has started', () => {
    const full = lobby(['A', 'B', 'C', 'D', 'E', 'F']);
    expect(errorCode(() => join(full.state, 'G', undefined, 0, full.random))).toBe('ROOM_FULL');
    const two = lobby(['A', 'B']);
    const started = handle(two.state, two.ids[0]!, { t: 'start', bots: 0 }, 1, two.random).state;
    expect(errorCode(() => join(started, 'C', undefined, 2, two.random))).toBe('GAME_IN_PROGRESS');
    expect(errorCode(() => join(started, 'C', 'not-a-real-token', 2, two.random))).toBe('GAME_IN_PROGRESS');
  });
});

describe('starting a game', () => {
  it('only the host can start, and there must be at least two players', () => {
    const solo = lobby(['Rui']);
    expect(errorCode(() => handle(solo.state, solo.ids[0]!, { t: 'start', bots: 0 }, 1, solo.random))).toBe('NOT_ENOUGH_PLAYERS');
    const two = lobby(['Rui', 'Lena']);
    expect(errorCode(() => handle(two.state, two.ids[1]!, { t: 'start', bots: 0 }, 1, two.random))).toBe('NOT_HOST');
  });

  it('adds bots up to six players and deals each person only their own cards', () => {
    const { state, ids, random } = lobby(['Rui', 'Lena']);
    const { state: started, out } = handle(state, ids[0]!, { t: 'start', bots: 5 }, 1, random);
    expect(started.status).toBe('playing');
    expect(started.round).toBe(1);
    expect(started.members.filter((m) => m.bot)).toHaveLength(4); // capped at 6 players
    for (const id of ids) {
      const deal = steps(out, id).find((s) => s.kind === 'deal');
      expect(deal && deal.kind === 'deal' && deal.view.you).toBe(id);
      const json = JSON.stringify(to(out, id));
      for (const p of started.game!.players) {
        if (p.id === id) continue;
        for (const card of p.hand) expect(json).not.toContain(card.id);
      }
    }
    expect(out.every((o) => !o.to.startsWith('bot'))).toBe(true);
  });

  it('gives the deal time to animate before the first move', () => {
    const { state, ids, random } = lobby(['Rui', 'Lena']);
    const started = handle(state, ids[0]!, { t: 'start', bots: 1 }, 1000, random).state;
    expect(started.deadline).toBeGreaterThanOrEqual(1000 + TIMING.afterDeal);
  });
});

describe('playing', () => {
  function started(bots = 0) {
    const l = lobby(['Rui', 'Lena', 'Max']);
    const r = handle(l.state, l.ids[0]!, { t: 'start', bots }, 0, l.random);
    return { ...l, state: r.state };
  }

  it('accepts a draw only from the player whose turn it is', () => {
    const { state, random } = started();
    const turn = currentTurn(state.game!)!;
    const other = state.members.find((m) => m.id !== turn.drawer)!.id;
    expect(errorCode(() => handle(state, other, { t: 'draw', slot: 0 }, 1, random))).toBe('NOT_YOUR_TURN');
    expect(errorCode(() => handle(state, turn.drawer, { t: 'draw', slot: 99 }, 1, random))).toBe('INVALID_SLOT');
    const next = handle(state, turn.drawer, { t: 'draw', slot: 0 }, 1, random);
    expect(next.state.game!.turn).toBe(1);
  });

  it('shows the drawn card only to the two players involved', () => {
    const { state, random } = started();
    const turn = currentTurn(state.game!)!;
    const { out } = handle(state, turn.drawer, { t: 'draw', slot: 0 }, 1, random);
    const drawnFor = (id: string) => {
      const step = steps(out, id).find((s) => s.kind === 'action') as Extract<Step, { kind: 'action' }>;
      return step.events.find((e) => e.type === 'cardDrawn');
    };
    const bystander = state.members.find((m) => m.id !== turn.drawer && m.id !== turn.offerer)!.id;
    expect(drawnFor(turn.drawer)).toMatchObject({ card: { face: expect.any(String) } });
    expect(drawnFor(turn.offerer)).toMatchObject({ card: { face: expect.any(String) } });
    expect(drawnFor(bystander)).toMatchObject({ card: null });
  });

  it('draws for a player who runs out of time', () => {
    const { state, random } = started();
    expect(state.deadline).not.toBeNull();
    const early = tick(state, state.deadline! - 1, random);
    expect(early.state.game!.turn).toBe(0);
    const late = tick(state, state.deadline!, random);
    expect(late.state.game!.turn).toBe(1);
  });

  it('gives an absent drawer only a short grace period, and a fresh timer when they return', () => {
    let { state, tokens, ids, random } = started();
    const drawer = currentTurn(state.game!)!.drawer;
    state = disconnect(state, drawer, 100, random).state;
    expect(state.deadline).toBe(100 + TIMING.absentGrace);
    const token = tokens[ids.indexOf(drawer)];
    const back = join(state, 'whoever', token, 200, random);
    expect(back.state.deadline).toBe(200 + TIMING.turnTimeout);
    expect(steps(back.out, drawer)[0]).toMatchObject({ kind: 'sync' });
  });

  it('lets a bot take over the seat of a player who leaves mid-game', () => {
    let { state, ids, random } = started();
    state = handle(state, ids[0]!, { t: 'leave' }, 5, random).state;
    expect(state.members.find((m) => m.id === ids[0])!.bot).toBe(true);
    expect(state.hostId).toBe(ids[1]);
  });

  it('plays whole games through the alarm alone, with bots and absent players', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const random = seeded(seed);
      let { state, ids } = lobby(['Rui', 'Lena'], random);
      state = handle(state, ids[0]!, { t: 'start', bots: seed % 5 }, 0, random).state;
      state = disconnect(state, ids[1]!, 0, random).state;
      let now = 0;
      let moves = 0;
      while (state.status === 'playing') {
        now = nextAlarm(state)!;
        state = tick(state, now, random).state;
        if (++moves > 500) throw new Error('game did not finish');
      }
      const game = state.game as GameState;
      expect(game.phase).toBe('over');
      expect(state.deadline).toBeNull();
    }
  });
});

describe('after the game', () => {
  it('the host takes everyone back to the lobby, without the bots', () => {
    const random = seeded(3);
    let { state, ids } = lobby(['Rui', 'Lena'], random);
    state = handle(state, ids[0]!, { t: 'start', bots: 2 }, 0, random).state;
    while (state.status === 'playing') state = tick(state, nextAlarm(state)!, random).state;
    expect(errorCode(() => handle(state, ids[1]!, { t: 'again' }, 1, random))).toBe('NOT_HOST');
    const back = handle(state, ids[0]!, { t: 'again' }, 1, random).state;
    expect(back.status).toBe('lobby');
    expect(back.game).toBeNull();
    expect(back.members.map((m) => m.id)).toEqual(ids);
  });

  it('expires a room nobody has been connected to for a while', () => {
    let { state, ids, random } = lobby(['Rui']);
    state = disconnect(state, ids[0]!, 1000, random).state;
    expect(nextAlarm(state)).toBe(1000 + TIMING.idleExpiry);
    expect(tick(state, 1000 + TIMING.idleExpiry - 1, random).expired).toBe(false);
    expect(tick(state, 1000 + TIMING.idleExpiry, random).expired).toBe(true);
  });
});

describe('room state', () => {
  it('stays plain JSON so it can be stored', () => {
    const { state, ids, random } = lobby(['Rui', 'Lena']);
    const started: RoomState = handle(state, ids[0]!, { t: 'start', bots: 1 }, 0, random).state;
    expect(JSON.parse(JSON.stringify(started))).toEqual(started);
  });
});
