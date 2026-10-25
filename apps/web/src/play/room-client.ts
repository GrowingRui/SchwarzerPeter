import type { ClientMessage, ErrorCode, RoomInfo, ServerMessage, Step } from '@sp/engine/protocol';
import type { PlayerId } from '@sp/engine';
import type { GameHost } from './host';
import { SERVER_URL, saveName } from './config';
import { t } from '../i18n';

export interface RoomSnapshot {
  readonly status: 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed';
  readonly joined: boolean;
  readonly you: PlayerId | null;
  readonly room: RoomInfo | null;
  /** A problem that ends the visit (room missing, full, already playing). */
  readonly fatal: { code: ErrorCode; message: string } | null;
  /** A problem with the last action, shown briefly. */
  readonly notice: string | null;
}

const FATAL: readonly ErrorCode[] = ['ROOM_NOT_FOUND', 'ROOM_FULL', 'GAME_IN_PROGRESS'];
const tokenKey = (code: string) => `sp.room.${code}`;

/** Create a room on the game server and return its code. */
export async function createRoom(): Promise<string> {
  const res = await fetch(`${SERVER_URL}/api/rooms`, { method: 'POST' });
  if (!res.ok) throw new Error(`The game server answered ${res.status}.`);
  const { code } = (await res.json()) as { code: string };
  return code;
}

/**
 * One browser's connection to a room. Reconnects on its own and keeps the
 * seat with a token stored per room, so a reload drops you back in the game.
 */
export class RoomClient {
  private ws: WebSocket | null = null;
  private snap: RoomSnapshot = { status: 'idle', joined: false, you: null, room: null, fatal: null, notice: null };
  private listeners = new Set<() => void>();
  private stepListeners = new Set<(step: Step) => void>();
  private buffer: Step[] = [];
  private name = '';
  private retries = 0;
  private stopped = false;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private noticeTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(readonly code: string) {}

  /** True if this browser already has a seat in the room. */
  get hasSeat(): boolean {
    return !!this.token;
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = () => this.snap;

  join(name: string) {
    this.name = name;
    saveName(name);
    this.stopped = false;
    this.open();
  }

  send(msg: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  /** Leave for good: give up the seat (a bot takes it mid-game). */
  leave() {
    this.send({ t: 'leave' });
    this.forgetToken();
    this.close();
  }

  close() {
    this.stopped = true;
    clearTimeout(this.retryTimer);
    this.ws?.close(1000);
    this.ws = null;
  }

  /** A game host for the table, backed by this connection. */
  host(): GameHost {
    return {
      you: this.snap.you ?? '',
      subscribe: (listener) => {
        this.stepListeners.add(listener);
        const queued = this.buffer;
        this.buffer = [];
        queued.forEach(listener);
        return () => this.stepListeners.delete(listener);
      },
      draw: (slot) => this.send({ t: 'draw', slot }),
      arrange: (order) => this.send({ t: 'arrange', order }),
      peek: (slot) => this.send({ t: 'peek', slot }),
      react: (emote) => this.send({ t: 'react', emote }),
      ready: () => undefined, // the server sets the pace
      dispose: () => undefined, // the connection outlives one table
    };
  }

  /* ---------------------------------------------------------------- */

  private open() {
    clearTimeout(this.retryTimer);
    this.update({ status: this.snap.joined ? 'reconnecting' : 'connecting' });
    const ws = new WebSocket(`${SERVER_URL.replace(/^http/, 'ws')}/api/rooms/${this.code}/ws`);
    this.ws = ws;
    ws.onopen = () => {
      const token = this.token;
      ws.send(JSON.stringify(token ? { t: 'hello', name: this.name, token } : { t: 'hello', name: this.name }));
    };
    ws.onmessage = (e) => this.receive(JSON.parse(String(e.data)) as ServerMessage);
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (this.stopped) return this.update({ status: 'closed' });
      // Try again with a growing pause: 1s, 2s, 4s, then every 8s.
      const delay = Math.min(8000, 1000 * 2 ** this.retries++);
      this.update({ status: 'reconnecting' });
      this.retryTimer = setTimeout(() => this.open(), delay);
    };
  }

  private receive(m: ServerMessage) {
    switch (m.t) {
      case 'welcome':
        this.retries = 0;
        this.token = m.token;
        this.update({ status: 'open', joined: true, you: m.you });
        break;
      case 'room':
        if (m.room.status === 'lobby') this.buffer = [];
        this.update({ room: m.room });
        break;
      case 'step':
        if (this.stepListeners.size) this.stepListeners.forEach((l) => l(m.step));
        else this.buffer.push(m.step);
        break;
      case 'error':
        if (FATAL.includes(m.code)) {
          this.forgetToken();
          this.update({ fatal: { code: m.code, message: m.message } });
          this.close();
        } else {
          clearTimeout(this.noticeTimer);
          // Show our own wording, in the page language, rather than the server's English.
          const key = `error.${m.code}`;
          const text = t(key);
          this.update({ notice: text === key ? t('error.default') : text });
          this.noticeTimer = setTimeout(() => this.update({ notice: null }), 4000);
        }
        break;
    }
  }

  private update(patch: Partial<RoomSnapshot>) {
    this.snap = { ...this.snap, ...patch };
    this.listeners.forEach((l) => l());
  }

  private get token(): string | undefined {
    try {
      return localStorage.getItem(tokenKey(this.code)) ?? undefined;
    } catch {
      return undefined;
    }
  }

  private set token(value: string | undefined) {
    try {
      if (value) localStorage.setItem(tokenKey(this.code), value);
    } catch {
      /* private mode: no reconnecting after a reload */
    }
  }

  private forgetToken() {
    try {
      localStorage.removeItem(tokenKey(this.code));
    } catch {
      /* ignore */
    }
  }
}
