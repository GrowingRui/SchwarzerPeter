import { describe, expect, it } from 'vitest';
import { Rng, currentTurn, type GameState } from '@sp/engine';
import { QUICK_SEATS, QUICK_WAIT_MS, parseClientMessage, type ServerMessage, type Step } from '@sp/engine/protocol';
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

describe('bluffing', () => {
  function started() {
    const l = lobby(['Rui', 'Lena', 'Max']);
    const r = handle(l.state, l.ids[0]!, { t: 'start', bots: 0 }, 0, l.random);
    return { ...l, state: r.state };
  }
  const handIds = (s: RoomState, id: string) => s.game!.players.find((p) => p.id === id)!.hand.map((c) => c.id);

  it('saves a new hand order and only tells the others that it changed', () => {
    const { state, ids, random } = started();
    const order = [...handIds(state, ids[0]!)].reverse();
    const { state: next, out } = handle(state, ids[0]!, { t: 'arrange', order }, 1, random);
    expect(handIds(next, ids[0]!)).toEqual(order);
    expect(to(out, ids[0]!)).toEqual([]);
    for (const other of ids.slice(1)) {
      expect(steps(out, other)).toEqual([{ kind: 'rearranged', playerId: ids[0] }]);
    }
    expect(JSON.stringify(out)).not.toContain(order[0]);
  });

  it('rejects an order that isn’t exactly your cards', () => {
    const { state, ids, random } = started();
    const mine = handIds(state, ids[0]!);
    const theirs = handIds(state, ids[1]!)[0]!;
    expect(errorCode(() => handle(state, ids[0]!, { t: 'arrange', order: mine.slice(1) }, 1, random))).toBe('BAD_MESSAGE');
    expect(errorCode(() => handle(state, ids[0]!, { t: 'arrange', order: [...mine.slice(1), theirs] }, 1, random))).toBe('BAD_MESSAGE');
  });

  it('lets a draw use the new order', () => {
    let { state, random } = started();
    const turn = currentTurn(state.game!)!;
    const order = [...handIds(state, turn.offerer)].reverse();
    state = handle(state, turn.offerer, { t: 'arrange', order }, 1, random).state;
    const drawn = handle(state, turn.drawer, { t: 'draw', slot: 0 }, 2, random).out
      .flatMap((o) => (o.to === turn.drawer && o.msg.t === 'step' && o.msg.step.kind === 'action' ? o.msg.step.events : []))
      .find((e) => e.type === 'cardDrawn');
    expect(drawn).toMatchObject({ card: { id: order[0] } });
  });

  it('passes a peek only from the drawer to the player holding the cards', () => {
    const { state, random } = started();
    const turn = currentTurn(state.game!)!;
    const bystander = state.members.find((m) => m.id !== turn.drawer && m.id !== turn.offerer)!.id;
    const peek = handle(state, turn.drawer, { t: 'peek', slot: 1 }, 1, random);
    expect(peek.state).toBe(state);
    expect(peek.out).toEqual([{ to: turn.offerer, msg: { t: 'step', step: { kind: 'peek', playerId: turn.drawer, slot: 1 } } }]);
    expect(handle(state, turn.drawer, { t: 'peek', slot: null }, 1, random).out).toHaveLength(1);
    expect(handle(state, bystander, { t: 'peek', slot: 0 }, 1, random).out).toEqual([]);
    expect(handle(state, turn.drawer, { t: 'peek', slot: 99 }, 1, random).out).toEqual([]);
  });

  it('sends reactions to everyone else without changing the room', () => {
    const { state, ids, random } = started();
    const r = handle(state, ids[1]!, { t: 'react', emote: 'gasp' }, 1, random);
    expect(r.state).toBe(state);
    expect(r.out.map((o) => o.to).sort()).toEqual([ids[0], ids[2]].sort());
    expect(steps(r.out, ids[0]!)).toEqual([{ kind: 'reaction', playerId: ids[1], emote: 'gasp' }]);
  });
});

describe('quick-match tables', () => {
  const quickTable = () => newRoom('QUICK', 0, 'quick');
  const seat = (s: RoomState, name: string, now: number, random: () => number) => join(s, name, undefined, now, random);

  it('has no host, and the first person starts a 15-second countdown', () => {
    const random = seeded(2);
    const { state, out, memberId } = seat(quickTable(), 'Rui', 1000, random);
    expect(state.hostId).toBeNull();
    expect(state.startAt).toBe(1000 + QUICK_WAIT_MS);
    const info = to(out, memberId).find((m) => m.t === 'room');
    expect(info).toMatchObject({ room: { mode: 'quick', startsInMs: QUICK_WAIT_MS, maxPlayers: QUICK_SEATS } });
    expect(nextAlarm(state)).toBe(1000 + QUICK_WAIT_MS);
    expect(errorCode(() => handle(state, memberId, { t: 'start', bots: 3 }, 1001, random))).toBe('NOT_HOST');
  });

  it('starts at once when the table is full, without bots', () => {
    const random = seeded(3);
    let state = quickTable();
    for (const [i, name] of ['A', 'B', 'C', 'D'].entries()) state = seat(state, name, i * 100, random).state;
    expect(state.status).toBe('playing');
    expect(state.members.filter((m) => m.bot)).toHaveLength(0);
    expect(errorCode(() => seat(state, 'E', 500, random))).toBe('GAME_IN_PROGRESS');
  });

  it('fills the empty seats with bots when the wait is over', () => {
    const random = seeded(4);
    let state = seat(quickTable(), 'Rui', 0, random).state;
    state = seat(state, 'Lena', 2000, random).state;
    expect(tick(state, QUICK_WAIT_MS - 1, random).state.status).toBe('lobby');
    const started = tick(state, QUICK_WAIT_MS, random);
    expect(started.state.status).toBe('playing');
    expect(started.state.members).toHaveLength(QUICK_SEATS);
    expect(started.state.members.filter((m) => m.bot)).toHaveLength(2);
    expect(started.out.some((o) => o.msg.t === 'step' && o.msg.step.kind === 'deal')).toBe(true);
  });

  it('frees the seat of someone who leaves or loses connection while waiting', () => {
    const random = seeded(5);
    let state = seat(quickTable(), 'Rui', 0, random).state;
    const lena = seat(state, 'Lena', 100, random);
    state = disconnect(lena.state, lena.memberId, 200, random).state;
    expect(state.members.map((m) => m.name)).toEqual(['Rui']);
    state = handle(state, state.members[0]!.id, { t: 'leave' }, 300, random).state;
    expect(state.members).toHaveLength(0);
    expect(state.startAt).toBeNull();
    expect(tick(state, QUICK_WAIT_MS + 1, random).state.status).toBe('lobby');
  });

  it('plays a whole quick game and offers no host-only rematch', () => {
    const random = seeded(6);
    const first = seat(quickTable(), 'Rui', 0, random);
    let state = first.state;
    state = tick(state, QUICK_WAIT_MS, random).state;
    expect(state.status).toBe('playing');
    while (state.status === 'playing') state = tick(state, nextAlarm(state)!, random).state;
    expect(state.status).toBe('over');
    expect(errorCode(() => handle(state, first.memberId, { t: 'again' }, 1, random))).toBe('NOT_HOST');
  });

  it('treats rooms stored before quick match as private', () => {
    const { mode: _mode, startAt: _startAt, ...old } = newRoom('OLDER', 0);
    const r = join(old, 'Rui', undefined, 0, seeded(7));
    expect(r.state.hostId).toBe(r.memberId);
    expect(roomInfo(r.state).mode).toBe('private');
  });
});

describe('turn timer', () => {
  const timers = (out: readonly Outgoing[], id: string) => steps(out, id).filter((s) => s.kind === 'timer');

  it('tells everyone how long a person has left to draw', () => {
    const l = lobby(['Rui', 'Lena']);
    const started = handle(l.state, l.ids[0]!, { t: 'start', bots: 0 }, 1000, l.random);
    const drawer = currentTurn(started.state.game!)!.drawer;
    for (const id of l.ids) {
      expect(timers(started.out, id)).toEqual([{ kind: 'timer', playerId: drawer, turn: 0, endsInMs: TIMING.turnTimeout + TIMING.afterDeal }]);
    }
    const drew = handle(started.state, drawer, { t: 'draw', slot: 0 }, 2000, l.random);
    if (drew.state.status === 'playing') {
      expect(timers(drew.out, l.ids[0]!)).toEqual([{ kind: 'timer', playerId: currentTurn(drew.state.game!)!.drawer, turn: 1, endsInMs: TIMING.turnTimeout }]);
    }
  });

  it('sends no timer for a bot’s turn', () => {
    for (let seed = 1; seed < 30; seed++) {
      const random = seeded(seed);
      const l = lobby(['Rui'], random);
      const started = handle(l.state, l.ids[0]!, { t: 'start', bots: 1 }, 0, random);
      const drawer = currentTurn(started.state.game!)?.drawer;
      if (drawer?.startsWith('bot')) {
        expect(timers(started.out, l.ids[0]!)).toEqual([]);
        return;
      }
    }
    throw new Error('no game started with a bot to draw');
  });

  it('shortens the timer when the drawer loses connection', () => {
    const l = lobby(['Rui', 'Lena']);
    const state = handle(l.state, l.ids[0]!, { t: 'start', bots: 0 }, 0, l.random).state;
    const drawer = currentTurn(state.game!)!.drawer;
    const other = l.ids.find((id) => id !== drawer)!;
    const gone = disconnect(state, drawer, 500, l.random);
    expect(timers(gone.out, other)).toEqual([{ kind: 'timer', playerId: drawer, turn: 0, endsInMs: TIMING.absentGrace }]);
  });
});

describe('soot', () => {
  it('marks whoever kept the cat, into the next round', () => {
    const random = seeded(8);
    let { state, ids } = lobby(['Rui', 'Lena'], random);
    state = handle(state, ids[0]!, { t: 'start', bots: 0 }, 0, random).state;
    expect(roomInfo(state).sooty).toBeNull();
    while (state.status === 'playing') state = tick(state, nextAlarm(state)!, random).state;
    const loser = state.game!.loser;
    expect(roomInfo(state).sooty).toBe(loser);
    state = handle(state, ids[0]!, { t: 'again' }, 1, random).state;
    expect(roomInfo(state).sooty).toBe(loser);
    state = handle(state, ids[0]!, { t: 'start', bots: 0 }, 2, random).state;
    expect(roomInfo(state).sooty).toBe(loser);
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

  const finished = (names: string[], bots: number, seed: number) => {
    const random = seeded(seed);
    let { state, ids } = lobby(names, random);
    state = handle(state, ids[0]!, { t: 'start', bots }, 0, random).state;
    while (state.status === 'playing') state = tick(state, nextAlarm(state)!, random).state;
    return { state, ids, random };
  };

  it('deals a rematch with the same table once everyone has asked', () => {
    let { state, ids, random } = finished(['Rui', 'Lena'], 2, 9);
    const before = state.members.map((m) => [m.id, m.name]);
    expect(parseClientMessage('{"t":"rematch"}')).toEqual({ t: 'rematch' });

    const one = handle(state, ids[1]!, { t: 'rematch' }, 1, random);
    expect(one.state.status).toBe('over');
    expect(to(one.out, ids[0]!).find((m) => m.t === 'room')).toMatchObject({ room: { rematch: [ids[1]] } });
    expect(handle(one.state, ids[1]!, { t: 'rematch' }, 2, random).state.rematch).toEqual([ids[1]]);

    const both = handle(one.state, ids[0]!, { t: 'rematch' }, 3, random);
    state = both.state;
    expect(state.status).toBe('playing');
    expect(state.round).toBe(2);
    expect(state.rematch).toEqual([]);
    expect(state.members.map((m) => [m.id, m.name])).toEqual(before);
    expect(steps(both.out, ids[1]!).some((s) => s.kind === 'deal')).toBe(true);
  });

  it('works in quick-match tables too', () => {
    const random = seeded(10);
    const first = join(newRoom('QUICK', 0, 'quick'), 'Rui', undefined, 0, random);
    let state = tick(first.state, QUICK_WAIT_MS, random).state;
    while (state.status === 'playing') state = tick(state, nextAlarm(state)!, random).state;
    state = handle(state, first.memberId, { t: 'rematch' }, 1, random).state;
    expect(state.status).toBe('playing');
    expect(state.members).toHaveLength(QUICK_SEATS);
  });

  it('doesn’t wait for people who left or lost connection', () => {
    let { state, ids, random } = finished(['Rui', 'Lena', 'Max'], 0, 11);
    state = handle(state, ids[0]!, { t: 'rematch' }, 1, random).state;
    state = disconnect(state, ids[1]!, 2, random).state;
    expect(state.status).toBe('over');
    state = handle(state, ids[2]!, { t: 'leave' }, 3, random).state;
    expect(state.status).toBe('playing');
    expect(state.members.find((m) => m.id === ids[2])!.bot).toBe(true);
  });

  it('forgets a vote when that person leaves, and only after a game', () => {
    let { state, ids, random } = finished(['Rui', 'Lena', 'Max'], 0, 12);
    state = handle(state, ids[1]!, { t: 'rematch' }, 1, random).state;
    state = handle(state, ids[1]!, { t: 'leave' }, 2, random).state;
    expect(state.rematch).toEqual([]);
    expect(state.status).toBe('over');
    const waiting = lobby(['A', 'B']);
    expect(errorCode(() => handle(waiting.state, waiting.ids[0]!, { t: 'rematch' }, 0, random))).toBe('WRONG_PHASE');
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
