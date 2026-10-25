import {
  ALPINE_DECK,
  Rng,
  createGame,
  currentTurn,
  drawCard,
  eventFor,
  viewFor,
  type GameState,
  type PlayerId,
} from '@sp/engine';
import type { Step } from '@sp/engine/protocol';
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
    ready() {
      busy = false;
      const turn = currentTurn(state);
      if (!turn || turn.drawer === YOU) return;
      clearTimeout(timer);
      // Bots take their time when you're involved; turns between bots move faster.
      const youInvolved = turn.offerer === YOU;
      const youOut = state.players.find((p) => p.id === YOU)?.hand.length === 0;
      timer = setTimeout(botTurn, youOut ? 280 + rng.int(240) : youInvolved ? 800 + rng.int(600) : 480 + rng.int(400));
    },
    dispose() {
      clearTimeout(timer);
      listeners = [];
    },
  };
}
