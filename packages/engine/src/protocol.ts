/**
 * Messages between the browser and the game server (Phase 3).
 * Shared by apps/web and apps/server so both sides agree on every shape.
 */
import type { GameEvent, PlayerId } from './types';
import type { PlayerView } from './view';

/**
 * One thing for the table to show. The table plays steps one at a time.
 * - deal: a new game was dealt (animate the deal)
 * - action: someone drew a card (animate the draw)
 * - hover: a player is choosing one of your cards
 * - sync: jump straight to this view, e.g. after reconnecting
 */
export type Step =
  | { readonly kind: 'deal'; readonly events: readonly GameEvent[]; readonly view: PlayerView }
  | { readonly kind: 'action'; readonly events: readonly GameEvent[]; readonly view: PlayerView }
  | { readonly kind: 'hover'; readonly playerId: PlayerId; readonly slot: number }
  | { readonly kind: 'sync'; readonly view: PlayerView };

export type RoomStatus = 'lobby' | 'playing' | 'over';

export interface RoomMember {
  readonly id: PlayerId;
  readonly name: string;
  readonly isBot: boolean;
  readonly isHost: boolean;
  readonly connected: boolean;
}

export interface RoomInfo {
  readonly code: string;
  readonly status: RoomStatus;
  /** Goes up by one for every game started in this room. */
  readonly round: number;
  readonly members: readonly RoomMember[];
  readonly maxPlayers: number;
}

export type ClientMessage =
  | { readonly t: 'hello'; readonly name: string; readonly token?: string }
  | { readonly t: 'start'; readonly bots: number }
  | { readonly t: 'draw'; readonly slot: number }
  | { readonly t: 'again' }
  | { readonly t: 'leave' };

export type ErrorCode =
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'GAME_IN_PROGRESS'
  | 'NOT_HOST'
  | 'NOT_ENOUGH_PLAYERS'
  | 'NOT_JOINED'
  | 'BAD_MESSAGE'
  | 'NOT_YOUR_TURN'
  | 'INVALID_SLOT'
  | 'GAME_OVER'
  | 'WRONG_PHASE';

export type ServerMessage =
  | { readonly t: 'welcome'; readonly you: PlayerId; readonly token: string }
  | { readonly t: 'room'; readonly room: RoomInfo }
  | { readonly t: 'step'; readonly step: Step }
  | { readonly t: 'error'; readonly code: ErrorCode; readonly message: string };

/** Five letters, no I or O so codes are easy to read aloud. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export const ROOM_CODE = /^[A-HJ-NP-Z]{5}$/;
export const NAME_MAX = 16;

/** Names: trimmed, no control characters, at most NAME_MAX characters. */
export function cleanName(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
}

/** Parse and validate a message from a browser. Returns null for anything malformed. */
export function parseClientMessage(raw: unknown): ClientMessage | null {
  if (typeof raw !== 'string' || raw.length > 1000) return null;
  let m: unknown;
  try {
    m = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!m || typeof m !== 'object') return null;
  const o = m as Record<string, unknown>;
  switch (o.t) {
    case 'hello':
      if (typeof o.name !== 'string') return null;
      if (o.token !== undefined && (typeof o.token !== 'string' || o.token.length > 64)) return null;
      return o.token ? { t: 'hello', name: o.name, token: o.token } : { t: 'hello', name: o.name };
    case 'start':
      return Number.isInteger(o.bots) && (o.bots as number) >= 0 && (o.bots as number) <= 5 ? { t: 'start', bots: o.bots as number } : null;
    case 'draw':
      return Number.isInteger(o.slot) && (o.slot as number) >= 0 && (o.slot as number) < 64 ? { t: 'draw', slot: o.slot as number } : null;
    case 'again':
      return { t: 'again' };
    case 'leave':
      return { t: 'leave' };
    default:
      return null;
  }
}
