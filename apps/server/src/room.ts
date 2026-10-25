/**
 * Room logic, free of any Cloudflare API so it can be tested in Node.
 * Every function takes the room state and returns the new state plus the
 * messages to send. The Durable Object (worker.ts) stores the state,
 * delivers the messages and runs the alarm.
 */
import {
  ALPINE_DECK,
  GameError,
  MAX_PLAYERS,
  createGame,
  currentTurn,
  drawCard,
  eventFor,
  viewFor,
  type GameEvent,
  type GameState,
  type PlayerId,
} from '@sp/engine';
import { cleanName, type ClientMessage, type ErrorCode, type RoomInfo, type ServerMessage, type Step } from '@sp/engine/protocol';

export interface Member {
  readonly id: PlayerId;
  readonly name: string;
  /** Secret that lets this player reconnect. Empty for bots. */
  readonly token: string;
  readonly bot: boolean;
  readonly connected: boolean;
}

export interface RoomState {
  readonly code: string;
  readonly hostId: PlayerId | null;
  readonly members: readonly Member[];
  readonly status: 'lobby' | 'playing' | 'over';
  readonly round: number;
  readonly game: GameState | null;
  /** When the current turn is played automatically (bot, absent player or timeout). */
  readonly deadline: number | null;
  /** The game turn that deadline belongs to, so a stale alarm does nothing. */
  readonly deadlineTurn: number | null;
  readonly lastActivity: number;
}

export interface Outgoing {
  readonly to: PlayerId;
  readonly msg: ServerMessage;
}

export interface RoomResult {
  readonly state: RoomState;
  readonly out: readonly Outgoing[];
}

export class RoomError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}

/** Source of randomness, injectable for tests. */
export type Random = () => number;

export const TIMING = {
  /** Bots wait this long (plus up to botJitter) so everyone's animations can keep up. */
  botDelay: 2800,
  botJitter: 900,
  /** Extra time before the first move, while the deal is animated. */
  afterDeal: 5500,
  /** A connected player who doesn't draw in time gets a random card. */
  turnTimeout: 45_000,
  /** A disconnected player's turn is played for them after this grace period. */
  absentGrace: 12_000,
  /** Rooms nobody is connected to are deleted after this long. */
  idleExpiry: 30 * 60_000,
};

const BOT_NAMES = ['Heidi', 'Ueli', 'Vreni', 'Sepp', 'Luca', 'Mia', 'Gian', 'Anna'];

export function newRoom(code: string, now: number): RoomState {
  return { code, hostId: null, members: [], status: 'lobby', round: 0, game: null, deadline: null, deadlineTurn: null, lastActivity: now };
}

/** Public room info: never includes tokens. */
export function roomInfo(s: RoomState): RoomInfo {
  return {
    code: s.code,
    status: s.status,
    round: s.round,
    maxPlayers: MAX_PLAYERS,
    members: s.members.map((m) => ({ id: m.id, name: m.name, isBot: m.bot, isHost: m.id === s.hostId, connected: m.bot || m.connected })),
  };
}

/* ------------------------------------------------------------------ */
/* Joining and leaving                                                 */
/* ------------------------------------------------------------------ */

/** A browser said hello: reconnect with its token, or join as a new player. */
export function join(s: RoomState, rawName: string, token: string | undefined, now: number, random: Random): RoomResult & { memberId: PlayerId } {
  const existing = token ? s.members.find((m) => !m.bot && m.token === token) : undefined;
  if (existing) {
    const name = s.status === 'lobby' ? cleanName(rawName) || existing.name : existing.name;
    const state = touch(updateMember(s, existing.id, { connected: true, name }), now);
    const out: Outgoing[] = [{ to: existing.id, msg: { t: 'welcome', you: existing.id, token: existing.token } }, ...broadcastRoom(state)];
    if (state.game) out.push({ to: existing.id, msg: { t: 'step', step: { kind: 'sync', view: viewFor(state.game, existing.id) } } });
    return { state: reschedule(state, now, random, { force: isDrawer(state, existing.id) }), out, memberId: existing.id };
  }
  if (s.status !== 'lobby') throw new RoomError('GAME_IN_PROGRESS', 'This game has already started.');
  if (s.members.length >= MAX_PLAYERS) throw new RoomError('ROOM_FULL', 'This room is full.');

  const id = `p${randomId(random, 8)}`;
  const member: Member = { id, name: uniqueName(s, cleanName(rawName) || 'Player'), token: randomId(random, 32), bot: false, connected: true };
  const state = touch({ ...s, members: [...s.members, member], hostId: s.hostId ?? id }, now);
  return { state, out: [{ to: id, msg: { t: 'welcome', you: id, token: member.token } }, ...broadcastRoom(state)], memberId: id };
}

/** The player's last connection closed. */
export function disconnect(s: RoomState, memberId: PlayerId, now: number, random: Random): RoomResult {
  if (!s.members.some((m) => m.id === memberId)) return { state: s, out: [] };
  const state = touch(updateMember(s, memberId, { connected: false }), now);
  return { state: reschedule(state, now, random, { force: isDrawer(state, memberId) }), out: broadcastRoom(state) };
}

/* ------------------------------------------------------------------ */
/* Messages from players                                               */
/* ------------------------------------------------------------------ */

export function handle(s: RoomState, memberId: PlayerId, msg: ClientMessage, now: number, random: Random): RoomResult {
  const me = s.members.find((m) => m.id === memberId);
  if (!me) throw new RoomError('NOT_JOINED', 'Say hello first.');
  s = touch(s, now);
  switch (msg.t) {
    case 'hello':
      throw new RoomError('BAD_MESSAGE', 'Already joined.');
    case 'start':
      return start(s, memberId, msg.bots, now, random);
    case 'draw':
      return playDraw(s, memberId, msg.slot, now, random);
    case 'again':
      return backToLobby(s, memberId);
    case 'leave':
      return leave(s, memberId, now, random);
  }
}

function start(s: RoomState, memberId: PlayerId, bots: number, now: number, random: Random): RoomResult {
  if (memberId !== s.hostId) throw new RoomError('NOT_HOST', 'Only the host can start the game.');
  if (s.status !== 'lobby') throw new RoomError('WRONG_PHASE', 'The game has already started.');
  const humans = s.members.filter((m) => !m.bot);
  const botCount = Math.max(0, Math.min(bots, MAX_PLAYERS - humans.length));
  if (humans.length + botCount < 2) throw new RoomError('NOT_ENOUGH_PLAYERS', 'Invite a friend or add a bot to start.');

  const taken = new Set(humans.map((m) => m.name));
  const free = shuffle(BOT_NAMES.filter((n) => !taken.has(n)), random);
  const botMembers: Member[] = Array.from({ length: botCount }, (_, i) => ({
    id: `bot${i + 1}`,
    name: free[i] ?? `Bot ${i + 1}`,
    token: '',
    bot: true,
    connected: true,
  }));
  const members = [...humans, ...botMembers];
  const { state: game, events } = createGame({
    players: members.map((m) => ({ id: m.id, name: m.name })),
    pairs: ALPINE_DECK,
    seed: Math.floor(random() * 2 ** 31),
  });

  let state: RoomState = { ...s, members, game, status: game.phase === 'over' ? 'over' : 'playing', round: s.round + 1 };
  const out = [...broadcastRoom(state), ...sendSteps(state, (id) => ({ kind: 'deal', events: events.map((e) => eventFor(e, id)), view: viewFor(game, id) }))];
  state = reschedule(state, now, random, { force: true, extra: TIMING.afterDeal });
  return { state, out };
}

function playDraw(s: RoomState, memberId: PlayerId, slot: number, now: number, random: Random): RoomResult {
  if (s.status !== 'playing' || !s.game) throw new RoomError('WRONG_PHASE', 'There is no game in progress.');
  return applyDraw(s, memberId, slot, now, random, false);
}

function backToLobby(s: RoomState, memberId: PlayerId): RoomResult {
  if (memberId !== s.hostId) throw new RoomError('NOT_HOST', 'Only the host can start another round.');
  if (s.status !== 'over') throw new RoomError('WRONG_PHASE', 'The game isn’t over yet.');
  // Bots leave with the old game, and so do players who left during it.
  const state: RoomState = { ...s, status: 'lobby', game: null, members: s.members.filter((m) => !m.bot), deadline: null, deadlineTurn: null };
  return { state, out: broadcastRoom(state) };
}

function leave(s: RoomState, memberId: PlayerId, now: number, random: Random): RoomResult {
  let state: RoomState;
  if (s.status === 'lobby') {
    state = { ...s, members: s.members.filter((m) => m.id !== memberId) };
  } else {
    // Mid-game a bot takes over the seat for the rest of the round.
    state = updateMember(s, memberId, { bot: true, token: '', connected: false });
  }
  if (state.hostId === memberId) state = { ...state, hostId: state.members.find((m) => !m.bot)?.id ?? null };
  state = reschedule(state, now, random, { force: isDrawer(state, memberId) });
  return { state, out: broadcastRoom(state) };
}

/* ------------------------------------------------------------------ */
/* Turns                                                               */
/* ------------------------------------------------------------------ */

/** The alarm fired: play the current turn if its deadline has passed. */
export function tick(s: RoomState, now: number, random: Random): RoomResult & { expired: boolean } {
  if (s.status === 'playing' && s.game && s.deadline !== null && now >= s.deadline && s.game.turn === s.deadlineTurn) {
    const turn = currentTurn(s.game);
    if (turn) return { ...applyDraw(s, turn.drawer, Math.floor(random() * turn.slots), now, random, true), expired: false };
  }
  const nobodyHere = !s.members.some((m) => !m.bot && m.connected);
  return { state: s, out: [], expired: nobodyHere && now - s.lastActivity >= TIMING.idleExpiry };
}

/** When the Durable Object should wake up next. */
export function nextAlarm(s: RoomState): number | null {
  if (s.deadline !== null) return s.deadline;
  const nobodyHere = !s.members.some((m) => !m.bot && m.connected);
  return nobodyHere ? s.lastActivity + TIMING.idleExpiry : null;
}

function applyDraw(s: RoomState, drawerId: PlayerId, slot: number, now: number, random: Random, automatic: boolean): RoomResult {
  const game = s.game!;
  const turn = currentTurn(game);
  if (!turn) throw new RoomError('GAME_OVER', 'The game is over.');
  if (turn.drawer !== drawerId) throw new RoomError('NOT_YOUR_TURN', 'It’s not your turn to draw.');

  let result: { state: GameState; events: readonly GameEvent[] };
  try {
    result = drawCard(game, drawerId, slot);
  } catch (e) {
    if (e instanceof GameError) throw new RoomError(e.code === 'INVALID_SLOT' ? 'INVALID_SLOT' : 'NOT_YOUR_TURN', e.message);
    throw e;
  }

  const out: Outgoing[] = [];
  // Automatic draws from a person's hand hesitate first, like a real hand would.
  const offerer = s.members.find((m) => m.id === turn.offerer);
  if (automatic && offerer && !offerer.bot && turn.slots > 1) {
    const looks = 2 + Math.floor(random() * 3);
    for (let i = 0; i < looks; i++) out.push({ to: offerer.id, msg: { t: 'step', step: { kind: 'hover', playerId: drawerId, slot: Math.floor(random() * turn.slots) } } });
    out.push({ to: offerer.id, msg: { t: 'step', step: { kind: 'hover', playerId: drawerId, slot } } });
  }

  const next = result.state;
  let state: RoomState = { ...s, game: next, status: next.phase === 'over' ? 'over' : 'playing' };
  out.push(...sendSteps(state, (id) => ({ kind: 'action', events: result.events.map((e) => eventFor(e, id)), view: viewFor(next, id) })));
  if (state.status === 'over') out.push(...broadcastRoom(state));
  state = reschedule(state, now, random, { force: true });
  return { state, out };
}

/**
 * Decide when the current turn happens automatically. An existing deadline for
 * this turn is kept unless something changed for the drawer (force).
 */
function reschedule(s: RoomState, now: number, random: Random, opts: { force?: boolean; extra?: number } = {}): RoomState {
  const turn = s.status === 'playing' && s.game ? currentTurn(s.game) : null;
  if (!turn || !s.game) return { ...s, deadline: null, deadlineTurn: null };
  if (!opts.force && s.deadlineTurn === s.game.turn && s.deadline !== null) return s;
  const drawer = s.members.find((m) => m.id === turn.drawer)!;
  const delay = drawer.bot
    ? TIMING.botDelay + Math.floor(random() * TIMING.botJitter)
    : drawer.connected
      ? TIMING.turnTimeout
      : TIMING.absentGrace;
  return { ...s, deadline: now + delay + (opts.extra ?? 0), deadlineTurn: s.game.turn };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function sendSteps(s: RoomState, stepFor: (id: PlayerId) => Step): Outgoing[] {
  return s.members.filter((m) => !m.bot).map((m) => ({ to: m.id, msg: { t: 'step', step: stepFor(m.id) } }));
}

function broadcastRoom(s: RoomState): Outgoing[] {
  const room = roomInfo(s);
  return s.members.filter((m) => !m.bot).map((m) => ({ to: m.id, msg: { t: 'room', room } }));
}

function updateMember(s: RoomState, id: PlayerId, patch: Partial<Member>): RoomState {
  return { ...s, members: s.members.map((m) => (m.id === id ? { ...m, ...patch } : m)) };
}

const touch = (s: RoomState, now: number): RoomState => ({ ...s, lastActivity: now });

const isDrawer = (s: RoomState, id: PlayerId) => !!s.game && currentTurn(s.game)?.drawer === id;

function uniqueName(s: RoomState, name: string): string {
  const taken = new Set(s.members.map((m) => m.name));
  if (!taken.has(name)) return name;
  for (let i = 2; ; i++) if (!taken.has(`${name} ${i}`)) return `${name} ${i}`;
}

function randomId(random: Random, length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < length; i++) id += chars[Math.floor(random() * chars.length)];
  return id;
}

function shuffle<T>(items: T[], random: Random): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items;
}
