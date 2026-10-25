import {
  ALPINE_DECK,
  PETER,
  Rng,
  createGame,
  currentTurn,
  drawCard,
  eventFor,
  rearrangeHand,
  shuffleHand,
  viewFor,
  type GameEvent,
  type GameState,
  type PlayerId,
} from '@sp/engine';
import type { Emote, Step } from '@sp/engine/protocol';
import { t } from '../i18n';

/**
 * Where the table gets its steps from: a practice game in the browser, or a
 * room on the game server. The table plays steps one at a time and calls
 * ready() when it has caught up, so local bots never act mid-animation.
 */
export interface GameHost {
  readonly you: PlayerId;
  subscribe(listener: (step: Step) => void): () => void;
  /** You draw the card at `slot` from the player offering to you. */
  draw(slot: number): void;
  /** Your hand in a new order (every card id once). */
  arrange(order: readonly string[]): void;
  /** While drawing: the face-down card you're pointing at, or null. */
  peek(slot: number | null): void;
  react(emote: Emote): void;
  /** The table has finished showing every step so far. */
  ready(): void;
  dispose(): void;
}

export const YOU = 'you';
const BOT_NAMES = ['Heidi', 'Ueli', 'Vreni', 'Sepp', 'Luca', 'Mia', 'Gian', 'Anna'];

export interface PracticeSettings {
  readonly name: string;
  readonly bots: number;
}

/** A practice game against bots, run entirely in the browser. */
export function createPracticeGame(settings: PracticeSettings): GameHost {
  const seed = Math.floor(Math.random() * 2 ** 31);
  const rng = new Rng(seed ^ 0x5bd1e995);
  const names = rng.shuffle([...BOT_NAMES]).slice(0, settings.bots);
  const players = [
    { id: YOU, name: settings.name.trim() || t('you') },
    ...names.map((name, i) => ({ id: `bot${i + 1}`, name })),
  ];

  const start = createGame({ players, pairs: ALPINE_DECK, seed });
  let state: GameState = start.state;
  let listeners: ((step: Step) => void)[] = [];
  let pending: Step[] = [{ kind: 'deal', events: start.events.map((e) => eventFor(e, YOU)), view: viewFor(state, YOU) }];
  let timer: ReturnType<typeof setTimeout> | undefined;
  const reactionTimers: ReturnType<typeof setTimeout>[] = [];
  let busy = true; // until the table has shown the deal

  const emit = (step: Step) => {
    if (!listeners.length) pending.push(step);
    for (const l of listeners) l(step);
  };

  const apply = (playerId: PlayerId, slot: number) => {
    const result = drawCard(state, playerId, slot);
    state = result.state;
    busy = true;
    emit({ kind: 'action', events: result.events.map((e) => eventFor(e, YOU)), view: viewFor(state, YOU) });
    botsReactTo(result.events);
  };

  const isBot = (id: PlayerId) => id !== YOU;

  /** Bots show a little emotion at the big moments, like players at a real table. */
  const botsReactTo = (events: readonly GameEvent[]) => {
    const say = (playerId: PlayerId, emote: Emote, chance: number, delay = 1300) => {
      if (rng.next() >= chance) return;
      reactionTimers.push(setTimeout(() => emit({ kind: 'reaction', playerId, emote }), delay + rng.int(500)));
    };
    for (const e of events) {
      if (e.type === 'cardDrawn' && e.card?.face === PETER) {
        if (isBot(e.drawer)) say(e.drawer, rng.next() < 0.5 ? 'gasp' : 'sweat', 0.7);
        if (isBot(e.offerer)) say(e.offerer, 'grin', 0.6, 1700);
      }
      if (e.type === 'pairLaidDown' && !e.atDeal && isBot(e.playerId)) say(e.playerId, 'clap', 0.12);
      if (e.type === 'gameOver') {
        if (isBot(e.loser)) say(e.loser, rng.next() < 0.5 ? 'sweat' : 'shrug', 0.85, 600);
        for (const p of state.players) if (isBot(p.id) && p.id !== e.loser) say(p.id, 'laugh', 0.25, 900);
      }
    }
  };

  const botTurn = () => {
    const turn = currentTurn(state);
    if (!turn || turn.drawer === YOU) return;
    const slot = rng.int(turn.slots);
    if (turn.offerer === YOU && turn.slots > 1) {
      // Let the bot hesitate over your cards before it takes one.
      const looks = 2 + rng.int(3);
      for (let i = 0; i < looks; i++) emit({ kind: 'hover', playerId: turn.drawer, slot: rng.int(turn.slots) });
      emit({ kind: 'hover', playerId: turn.drawer, slot });
    }
    apply(turn.drawer, slot);
  };

  return {
    you: YOU,
    subscribe(listener) {
      listeners.push(listener);
      const queued = pending;
      pending = [];
      queued.forEach(listener);
      return () => {
        listeners = listeners.filter((l) => l !== listener);
      };
    },
    draw(slot) {
      const turn = currentTurn(state);
      if (busy || !turn || turn.drawer !== YOU) return;
      apply(YOU, slot);
    },
    arrange(order) {
      if (state.phase !== 'playing') return;
      try {
        state = rearrangeHand(state, YOU, order).state;
      } catch {
        /* an order from a hand that has since changed: ignore it */
      }
    },
    peek() {
      /* bots don't watch where you point */
    },
    react() {
      /* the table shows your own reaction itself */
    },
    ready() {
      busy = false;
      const turn = currentTurn(state);
      if (!turn) return;
      clearTimeout(timer);
      if (turn.drawer === YOU) {
        // Sometimes the bot holding out its cards shuffles them first, to keep you guessing.
        const offerer = turn.offerer;
        if (turn.slots > 1 && rng.next() < 0.35) {
          timer = setTimeout(() => {
            const now = currentTurn(state);
            if (busy || now?.offerer !== offerer || now.drawer !== YOU) return;
            state = shuffleHand(state, offerer).state;
            emit({ kind: 'rearranged', playerId: offerer });
          }, 350 + rng.int(500));
        }
        return;
      }
      // Bots take their time when you're involved; turns between bots move faster.
      const youInvolved = turn.offerer === YOU;
      const youOut = state.players.find((p) => p.id === YOU)?.hand.length === 0;
      timer = setTimeout(botTurn, youOut ? 280 + rng.int(240) : youInvolved ? 800 + rng.int(600) : 480 + rng.int(400));
    },
    dispose() {
      clearTimeout(timer);
      reactionTimers.forEach(clearTimeout);
      listeners = [];
    },
  };
}
