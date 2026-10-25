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
 *
 * Live steps are shown the moment they arrive, without waiting for animations:
 * - peek: the player drawing from you is pointing at one of your cards (null: at none)
 * - rearranged: a player moved their cards around (only that it happened, never the order)
 * - reaction: a player sent an emote
 */
export type Step =
  | { readonly kind: 'deal'; readonly events: readonly GameEvent[]; readonly view: PlayerView }
  | { readonly kind: 'action'; readonly events: readonly GameEvent[]; readonly view: PlayerView }
  | { readonly kind: 'hover'; readonly playerId: PlayerId; readonly slot: number }
  | { readonly kind: 'sync'; readonly view: PlayerView }
  | { readonly kind: 'peek'; readonly playerId: PlayerId; readonly slot: number | null }
  | { readonly kind: 'rearranged'; readonly playerId: PlayerId }
  | { readonly kind: 'reaction'; readonly playerId: PlayerId; readonly emote: Emote };

export type LiveStep = Extract<Step, { kind: 'peek' | 'rearranged' | 'reaction' }>;
export const isLiveStep = (s: Step): s is LiveStep => s.kind === 'peek' || s.kind === 'rearranged' || s.kind === 'reaction';

/** The fixed set of reactions. No free text, so the table stays friendly. */
export const EMOTES = ['grin', 'gasp', 'laugh', 'sweat', 'shrug', 'clap'] as const;
export type Emote = (typeof EMOTES)[number];

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
  | { readonly t: 'leave' }
  /** Your hand in a new order: every card id, once. */
  | { readonly t: 'arrange'; readonly order: readonly string[] }
  /** While drawing: the face-down card you're pointing at, or null. */
  | { readonly t: 'peek'; readonly slot: number | null }
  | { readonly t: 'react'; readonly emote: Emote };

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
    case 'arrange':
      return Array.isArray(o.order) && o.order.length <= 40 && o.order.every((id) => typeof id === 'string' && id.length <= 32)
        ? { t: 'arrange', order: o.order as string[] }
        : null;
    case 'peek':
      return o.slot === null || (Number.isInteger(o.slot) && (o.slot as number) >= 0 && (o.slot as number) < 64)
        ? { t: 'peek', slot: o.slot as number | null }
        : null;
    case 'react':
      return (EMOTES as readonly unknown[]).includes(o.emote) ? { t: 'react', emote: o.emote as Emote } : null;
    default:
      return null;
  }
}
