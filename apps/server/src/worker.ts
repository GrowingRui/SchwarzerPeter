/**
 * Schwarzer Peter game server: a Cloudflare Worker with one Durable Object per room.
 *
 *   POST /api/rooms                 create a room, returns { code }
 *   GET  /api/rooms/:code/ws        WebSocket for playing in that room
 *
 * Uses the WebSocket Hibernation API, so an idle room costs nothing while
 * players are thinking. The room state is stored after every change.
 */
import { DurableObject } from 'cloudflare:workers';
import { ROOM_CODE, ROOM_CODE_ALPHABET, parseClientMessage, type ServerMessage } from '@sp/engine/protocol';
import { RoomError, disconnect, handle, join, newRoom, nextAlarm, tick, type Outgoing, type RoomResult, type RoomState } from './room';

export interface Env {
  ROOMS: DurableObjectNamespace<Room>;
  /** Comma-separated origins allowed to create rooms, e.g. https://schwarzerpeter.vercel.app */
  ALLOWED_ORIGINS?: string;
}

interface Attachment {
  memberId: string | null;
}

/** Crypto-strength randomness for tokens, bots and shuffles. */
const random = () => crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32;

export class Room extends DurableObject<Env> {
  private state: RoomState | null | undefined;

  /** Called once by the worker when the room is created. Fails if the code is taken. */
  async init(code: string): Promise<boolean> {
    if (await this.load()) return false;
    await this.save(newRoom(code, Date.now()));
    return true;
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ memberId: null } satisfies Attachment);
    if (!(await this.load())) {
      send(server, { t: 'error', code: 'ROOM_NOT_FOUND', message: 'This room doesn’t exist. Check the code, or create a new room.' });
      server.close(4004, 'Room not found');
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, data: string | ArrayBuffer): Promise<void> {
    const state = await this.load();
    if (!state) return;
    const msg = parseClientMessage(typeof data === 'string' ? data : '');
    if (!msg) return send(ws, { t: 'error', code: 'BAD_MESSAGE', message: 'That message wasn’t understood.' });
    const att = ws.deserializeAttachment() as Attachment;
    const now = Date.now();
    try {
      if (msg.t === 'hello') {
        if (att.memberId) return;
        const result = join(state, msg.name, msg.token, now, random);
        ws.serializeAttachment({ memberId: result.memberId } satisfies Attachment);
        await this.commit(result);
      } else {
        if (!att.memberId) return send(ws, { t: 'error', code: 'NOT_JOINED', message: 'Join the room first.' });
        const result = handle(state, att.memberId, msg, now, random);
        if (msg.t === 'leave') ws.serializeAttachment({ memberId: null } satisfies Attachment);
        await this.commit(result);
      }
    } catch (e) {
      if (e instanceof RoomError) return send(ws, { t: 'error', code: e.code, message: e.message });
      throw e;
    }
  }

  async webSocketClose(ws: WebSocket, code: number): Promise<void> {
    try {
      ws.close(code === 1005 || code === 1006 ? 1000 : code, 'Bye');
    } catch {
      /* already closed */
    }
    await this.dropped(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.dropped(ws);
  }

  async alarm(): Promise<void> {
    const state = await this.load();
    if (!state) return;
    const result = tick(state, Date.now(), random);
    if (result.expired) {
      for (const ws of this.ctx.getWebSockets()) ws.close(4010, 'Room closed');
      await this.ctx.storage.deleteAll();
      this.state = null;
      return;
    }
    await this.commit(result);
  }

  /* ---------------------------------------------------------------- */

  /** A socket went away. If it was that player's last one, they're disconnected. */
  private async dropped(ws: WebSocket) {
    const memberId = (ws.deserializeAttachment() as Attachment | null)?.memberId;
    if (!memberId) return;
    const stillHere = this.ctx.getWebSockets().some((other) => other !== ws && (other.deserializeAttachment() as Attachment | null)?.memberId === memberId);
    const state = await this.load();
    if (!state || stillHere) return;
    await this.commit(disconnect(state, memberId, Date.now(), random));
  }

  private async commit(result: RoomResult) {
    await this.save(result.state);
    this.deliver(result.out);
    const at = nextAlarm(result.state);
    if (at === null) await this.ctx.storage.deleteAlarm();
    else await this.ctx.storage.setAlarm(Math.max(at, Date.now() + 10));
  }

  private deliver(out: readonly Outgoing[]) {
    if (!out.length) return;
    const sockets = this.ctx.getWebSockets();
    for (const { to, msg } of out) {
      for (const ws of sockets) {
        if ((ws.deserializeAttachment() as Attachment | null)?.memberId === to) send(ws, msg);
      }
    }
  }

  private async load(): Promise<RoomState | null> {
    if (this.state === undefined) this.state = (await this.ctx.storage.get<RoomState>('room')) ?? null;
    return this.state;
  }

  private async save(state: RoomState) {
    this.state = state;
    await this.ctx.storage.put('room', state);
  }
}

function send(ws: WebSocket, msg: ServerMessage) {
  try {
    ws.send(JSON.stringify(msg));
  } catch {
    /* socket closing */
  }
}

/* -------------------------------------------------------------------- */
/* Worker entry                                                          */
/* -------------------------------------------------------------------- */

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    if (url.pathname === '/api/rooms' && request.method === 'POST') {
      if (!cors['Access-Control-Allow-Origin']) return new Response('Origin not allowed', { status: 403 });
      for (let attempt = 0; attempt < 8; attempt++) {
        const code = Array.from({ length: 5 }, () => ROOM_CODE_ALPHABET[Math.floor(random() * ROOM_CODE_ALPHABET.length)]).join('');
        const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
        if (await stub.init(code)) return Response.json({ code }, { status: 201, headers: cors });
      }
      return Response.json({ error: 'Could not find a free room code. Try again.' }, { status: 503, headers: cors });
    }

    const ws = url.pathname.match(/^\/api\/rooms\/([A-Z]+)\/ws$/);
    if (ws) {
      const code = ws[1]!;
      if (!ROOM_CODE.test(code)) return new Response('Invalid room code', { status: 400 });
      return env.ROOMS.get(env.ROOMS.idFromName(code)).fetch(request);
    }

    if (url.pathname === '/') return new Response('Schwarzer Peter game server', { headers: { 'Content-Type': 'text/plain' } });
    return new Response('Not found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin') ?? '';
  const allowed = (env.ALLOWED_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean);
  const ok = origin && (allowed.includes('*') || allowed.includes(origin) || /^http:\/\/localhost:\d+$/.test(origin));
  return ok
    ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' }
    : {};
}
