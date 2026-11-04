#!/usr/bin/env node
/**
 * End-to-end test of online play against a running game server.
 *
 *   node scripts/online-test.mjs                 local server (npm run dev:server)
 *   node scripts/online-test.mjs --live          the deployed server
 *   node scripts/online-test.mjs <url>           any server
 *   add --quick                                  also test quick match (adds ~15 s)
 *
 * Two pretend players create a room, join, play a whole game with one bot,
 * drop and rejoin mid-game, ask for a rematch and check that round 2 is dealt.
 * Exits with 1 and says which step failed if anything goes wrong.
 */

const LIVE = 'https://schwarzer-peter.sp-server.workers.dev';
const args = process.argv.slice(2);
const SERVER = (args.includes('--live') ? LIVE : args.find((a) => !a.startsWith('--')) ?? 'http://localhost:8787').replace(/\/$/, '');
const QUICK = args.includes('--quick');
// The server only lets the website (or localhost) create rooms.
const ORIGIN = /localhost|127\.0\.0\.1/.test(SERVER) ? 'http://localhost:3005' : 'https://schwarzerpeter.vercel.app';
const GAME_TIMEOUT = 120_000;

/* ------------------------------------------------------------------ */

let failed = false;
const started = Date.now();
const secs = () => `${((Date.now() - started) / 1000).toFixed(1)}s`;
const ok = (text) => console.log(`  \x1b[32m✓\x1b[0m ${text} \x1b[2m(${secs()})\x1b[0m`);

async function step(text, fn) {
  try {
    const result = await fn();
    ok(text);
    return result;
  } catch (e) {
    console.log(`  \x1b[31m✗ ${text}\x1b[0m\n    ${e instanceof Error ? e.message : e}`);
    failed = true;
    throw e;
  }
}

async function post(path) {
  const res = await fetch(`${SERVER}${path}`, { method: 'POST', headers: { Origin: ORIGIN }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`POST ${path} answered ${res.status}: ${await res.text()}`);
  return res.json();
}

/** A pretend player: one WebSocket, the latest room info and table view, and a few helpers. */
class Player {
  constructor(name, code) {
    this.name = name;
    this.code = code;
    this.token = undefined;
    this.you = null;
    this.room = null;
    this.view = null;
    this.errors = [];
    this.waiters = new Set();
    this.autoDraw = false;
  }

  connect() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${SERVER.replace(/^http/, 'ws')}/api/rooms/${this.code}/ws`);
      this.ws = ws;
      const timer = setTimeout(() => reject(new Error(`${this.name} could not connect within 10 s`)), 10_000);
      ws.onopen = () => {
        clearTimeout(timer);
        ws.send(JSON.stringify(this.token ? { t: 'hello', name: this.name, token: this.token } : { t: 'hello', name: this.name }));
        resolve();
      };
      ws.onerror = () => {
        clearTimeout(timer);
        reject(new Error(`${this.name} could not open a WebSocket to ${SERVER}`));
      };
      ws.onmessage = (e) => this.receive(JSON.parse(String(e.data)));
    });
  }

  receive(m) {
    if (m.t === 'welcome') {
      this.you = m.you;
      this.token = m.token;
    } else if (m.t === 'room') this.room = m.room;
    else if (m.t === 'error') this.errors.push(m.code);
    else if (m.t === 'step' && 'view' in m.step) this.view = m.step.view;
    if (this.autoDraw) this.drawIfMyTurn();
    this.waiters.forEach((w) => w());
  }

  send(msg) {
    this.ws.send(JSON.stringify(msg));
  }

  /** Draw a random card whenever it's our turn, like an impatient person would. */
  drawIfMyTurn() {
    const v = this.view;
    if (!v || v.phase !== 'playing' || v.drawer !== this.you || this.room?.status !== 'playing') return;
    if (this.drewOnTurn === v.turn) return;
    const from = v.seats.find((s) => s.id === v.offerer);
    if (!from?.cardCount) return;
    this.drewOnTurn = v.turn;
    this.send({ t: 'draw', slot: Math.floor(Math.random() * from.cardCount) });
  }

  /** Wait until `check()` is true, re-checking on every message. */
  until(check, what, ms = 10_000) {
    if (check()) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const done = () => {
        if (!check()) return;
        clearTimeout(timer);
        this.waiters.delete(done);
        resolve();
      };
      const timer = setTimeout(() => {
        this.waiters.delete(done);
        reject(new Error(`${this.name}: timed out waiting for ${what}`));
      }, ms);
      this.waiters.add(done);
    });
  }

  drop() {
    this.ws.onclose = null;
    this.ws.close();
  }
}

/* ------------------------------------------------------------------ */

async function privateRoom() {
  console.log('\nRoom with friends');
  const { code } = await step('create a room', () => post('/api/rooms'));
  const anna = new Player('Anna', code);
  const ben = new Player('Ben', code);
  const players = [anna, ben];

  await step(`both players join room ${code}`, async () => {
    await anna.connect();
    await anna.until(() => anna.you && anna.room, 'a welcome');
    await ben.connect();
    await ben.until(() => ben.you && anna.room?.members.length === 2, 'two people in the lobby');
    if (!anna.room.members.find((m) => m.id === anna.you)?.isHost) throw new Error('the room creator is not the host');
  });

  await step('the host starts with one bot and the cards are dealt', async () => {
    anna.send({ t: 'start', bots: 1 });
    await Promise.all(players.map((p) => p.until(() => p.room?.status === 'playing' && p.view, 'the deal')));
    const total = anna.view.seats.length;
    if (total !== 3) throw new Error(`expected 3 seats, got ${total}`);
  });

  players.forEach((p) => {
    p.autoDraw = true;
    p.drawIfMyTurn();
  });

  await step('a player drops out mid-game and gets their seat back', async () => {
    await anna.until(() => (anna.view?.turn ?? 0) >= 2 || anna.room?.status === 'over', 'a few turns', 30_000);
    if (anna.room.status === 'over') return; // a very short game: nothing to rejoin
    const seat = ben.you;
    ben.drop();
    await anna.until(() => anna.room.members.find((m) => m.id === seat)?.connected === false, 'Ben to show as away');
    ben.view = null;
    await ben.connect();
    await ben.until(() => ben.view && ben.room, 'Ben to be back at the table');
    if (ben.you !== seat) throw new Error(`Ben came back as ${ben.you}, not ${seat}`);
    ben.drawIfMyTurn();
  });

  await step('the game is played to the end', async () => {
    await Promise.all(players.map((p) => p.until(() => p.room?.status === 'over' && p.view?.phase === 'over', 'the end of the game', GAME_TIMEOUT)));
    const loser = anna.view.loser;
    if (!loser) throw new Error('the game ended without anyone keeping the cat');
    if (anna.room.sooty !== loser) throw new Error('the loser did not get the soot smudge');
    const name = anna.view.seats.find((s) => s.id === loser)?.name;
    console.log(`    \x1b[2m${name} kept the cat after ${anna.view.turn} turns\x1b[0m`);
  });

  await step('both ask for a rematch and round 2 is dealt', async () => {
    players.forEach((p) => p.send({ t: 'rematch' }));
    await Promise.all(players.map((p) => p.until(() => p.room?.round === 2 && p.room.status === 'playing', 'round 2')));
  });

  await step('both leave the room', async () => {
    players.forEach((p) => (p.autoDraw = false));
    anna.send({ t: 'leave' });
    ben.send({ t: 'leave' });
    await new Promise((r) => setTimeout(r, 300));
    players.forEach((p) => p.drop());
  });

  const unexpected = players.flatMap((p) => p.errors).filter((c) => c !== 'NOT_YOUR_TURN');
  if (unexpected.length) {
    console.log(`  \x1b[31m✗ the server sent errors: ${unexpected.join(', ')}\x1b[0m`);
    failed = true;
  }
}

async function quickMatch() {
  console.log('\nQuick match');
  const seats = await step('two people ask for a quick-match seat', () => Promise.all([post('/api/quick'), post('/api/quick')]));
  const [a, b] = seats.map((s) => s.code);
  if (a !== b) {
    // On the live server real people may be filling tables at the same time.
    if (ORIGIN.includes('localhost')) {
      await step('both get the same table', () => {
        throw new Error(`seated at different tables (${a}, ${b})`);
      });
    }
    console.log(`    \x1b[2mseated at different tables (${a}, ${b}); someone else may be playing\x1b[0m`);
    return;
  }
  const players = [new Player('Cleo', a), new Player('Dan', a)];
  await step(`both join table ${a}`, async () => {
    for (const p of players) await p.connect();
    await Promise.all(players.map((p) => p.until(() => p.room?.members.filter((m) => !m.isBot).length === 2, 'two people at the table')));
  });
  await step('the table fills with bots and starts by itself', async () => {
    await Promise.all(players.map((p) => p.until(() => p.room?.status === 'playing' && p.view, 'the game to start', 30_000)));
  });
  players.forEach((p) => {
    p.send({ t: 'leave' });
    setTimeout(() => p.drop(), 300);
  });
}

console.log(`Online test against ${SERVER}`);
try {
  await step('the server answers', async () => {
    const res = await fetch(SERVER, { signal: AbortSignal.timeout(10_000) }).catch((e) => {
      throw new Error(`no answer from ${SERVER} (${e.cause?.code ?? e.message}). Is it running? Locally: npm run dev:server`);
    });
    if (!res.ok) throw new Error(`it answered ${res.status}`);
  });
  await privateRoom();
  if (QUICK) await quickMatch();
} catch {
  /* already reported */
}

console.log(failed ? '\n\x1b[31mOnline test failed.\x1b[0m' : `\n\x1b[32mOnline test passed\x1b[0m in ${secs()}.`);
await new Promise((r) => setTimeout(r, 400));
process.exit(failed ? 1 : 0);
