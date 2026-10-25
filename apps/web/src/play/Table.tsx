import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { flushSync } from 'react-dom';
import { ALPINE_DECK, PETER, type Card, type GameEvent, type PlayerId, type PlayerView } from '@sp/engine';
import type { Step } from '@sp/engine/protocol';
import type { GameHost } from './host';
import { CardBack, CardFace, cardName } from './cards';
import { fly, rectOf, setTempo, wait } from './fly';
import { TopBar } from './Setup';
import { ordinal, t, tn } from '../i18n';

type Phase = 'dealing' | 'playing' | 'over';
interface Message {
  readonly text: string;
  readonly tone?: 'peter' | 'good';
}
type CardDrawn = Extract<GameEvent, { type: 'cardDrawn' }>;
type PairLaidDown = Extract<GameEvent, { type: 'pairLaidDown' }>;

const isPair = (e: GameEvent): e is PairLaidDown => e.type === 'pairLaidDown';
const handCard = (id: string) => `[data-hand-card="${id}"]`;
const seatHand = (id: PlayerId) => `[data-seat-hand="${id}"]`;
const PILE = '[data-pile-target]';

export interface ResultAction {
  readonly label: string;
  readonly onClick: () => void;
}

export interface TableProps {
  host: GameHost;
  /** Buttons on the result screen, plus an optional line shown under them. */
  result: { primary?: ResultAction; secondary?: ResultAction; note?: string };
  /** What leaving does. Defaults to going back to the homepage. */
  onLeave?: () => void;
  /** Explains what happens to the round if you leave now. */
  leaveNote?: string;
  /** Players whose connection dropped (online games). */
  offline?: ReadonlySet<PlayerId>;
}

const goHome = () => {
  location.href = '/';
};

export function Table({ host, result, onLeave = goHome, leaveNote = t('leave.practiceNote'), offline }: TableProps) {
  const you = host.you;
  const [view, setView] = useState<PlayerView | null>(null);
  const [extra, setExtra] = useState<readonly Card[]>([]); // pairs you were dealt, shown before they go down
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const [hiddenPairs, setHiddenPairs] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [message, setMessage] = useState<Message>(() => ({ text: t('table.shuffling') }));
  const [phase, setPhase] = useState<Phase>('dealing');
  const [busy, setBusy] = useState(true);
  const [showResult, setShowResult] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const viewRef = useRef<PlayerView | null>(null);

  useEffect(() => {
    let alive = true;
    const queue: Step[] = [];
    let running = false;
    setTempo(1);

    const commit = (fn: () => void) => flushSync(fn);
    const show = (v: PlayerView) => {
      viewRef.current = v;
      setView(v);
    };
    const nameOf = (id: PlayerId) => viewRef.current?.seats.find((s) => s.id === id)?.name ?? id;

    async function afterEvents(events: readonly GameEvent[]) {
      for (const e of events) {
        if (e.type === 'playerOut') {
          setMessage(e.playerId === you ? { text: t('table.youOut'), tone: 'good' } : { text: t('table.playerOut', { name: nameOf(e.playerId) }) });
          await wait(1000);
          if (e.playerId === you) setTempo(0.55);
        } else if (e.type === 'gameOver') {
          setPhase('over');
          setMessage(
            e.loser === you
              ? { text: t('table.youLost'), tone: 'peter' }
              : { text: t('table.playerLost', { name: nameOf(e.loser) }), tone: 'good' },
          );
          await wait(1300);
          if (alive) setShowResult(true);
        } else if (e.type === 'nextTurn') {
          setPhase('playing');
          setMessage(
            turnMessage(e.drawer, e.offerer),
          );
        }
      }
    }

    async function playDeal(step: Extract<Step, { kind: 'deal' }>) {
      const pairs = step.events.filter(isPair);
      const mine = pairs.filter((e) => e.playerId === you);
      commit(() => {
        show(step.view);
        setExtra(mine.flatMap((e) => [...e.cards]));
        setHiddenPairs(step.view.pairs.length);
        setMessage({ text: t('table.dealing') });
      });
      await wait(1500);

      if (mine.length) {
        setMessage({ text: tn('table.dealtPairs', mine.length), tone: 'good' });
        await wait(900);
        for (const e of mine) {
          const from = e.cards.map((c) => rectOf(handCard(c.id)));
          commit(() => setExtra((x) => x.filter((c) => !e.cards.some((p) => p.id === c.id))));
          const pile = rectOf(PILE);
          await Promise.all(e.cards.map((c, i) => (from[i] && pile ? fly(from[i]!, pile, { face: c.face, duration: 480 }) : undefined)));
          commit(() => setHiddenPairs((h) => h - 1));
        }
      }
      const others = pairs.filter((e) => e.playerId !== you);
      if (others.length) {
        setMessage({ text: t('table.othersLayDown') });
        await Promise.all(
          others.map(async (e, i) => {
            await wait(i * 160);
            const from = rectOf(seatHand(e.playerId));
            const pile = rectOf(PILE);
            if (from && pile) await Promise.all(e.cards.map((c) => fly(from, pile, { face: c.face, duration: 560 })));
            commit(() => setHiddenPairs((h) => h - 1));
          }),
        );
        await wait(500);
      }
      commit(() => setHiddenPairs(0));
      await afterEvents(step.events);
    }

    async function playAction(step: Extract<Step, { kind: 'action' }>) {
      const drawn = step.events.find((e): e is CardDrawn => e.type === 'cardDrawn');
      if (!drawn) {
        commit(() => show(step.view));
        await afterEvents(step.events);
        return;
      }
      const pair = step.events.find((e): e is PairLaidDown => isPair(e) && !e.atDeal);
      const card = drawn.card;
      const youDraw = drawn.drawer === you;
      const youOffer = drawn.offerer === you;

      const from = youOffer && card ? rectOf(handCard(card.id)) : youDraw ? rectOf(`[data-offer-slot="${drawn.slot}"]`) : rectOf(seatHand(drawn.offerer));
      const match = pair && youDraw && card ? pair.cards.find((c) => c.id !== card.id) ?? null : null;
      const matchRect = match ? rectOf(handCard(match.id)) : null;

      commit(() => {
        show(step.view);
        setHover(null);
        if (youDraw && card && !pair) setHidden(new Set([card.id]));
        if (pair) setHiddenPairs(1);
      });

      const to = youDraw ? (match ? matchRect : card ? rectOf(handCard(card.id)) : null) : rectOf(seatHand(drawn.drawer));
      setMessage(drawMessage(drawn, pair ?? null));
      if (from && to) {
        await Promise.all([
          fly(from, to, { face: card?.face ?? null, reveal: youDraw, duration: 640 }),
          // Keep the matching card in place while the new one flies in.
          match && matchRect ? fly(matchRect, matchRect, { face: match.face, duration: 640 }) : undefined,
        ]);
      }
      commit(() => setHidden(new Set()));

      if (pair) {
        const origin = youDraw ? matchRect : rectOf(seatHand(drawn.drawer));
        const pile = rectOf(PILE);
        if (origin && pile) {
          await Promise.all(pair.cards.map((c, i) => wait(i * 90).then(() => fly(origin, pile, { face: c.face, duration: 520 }))));
        }
        commit(() => setHiddenPairs(0));
        await wait(youDraw ? 700 : 350);
      } else if (youDraw && card?.face === PETER) {
        await wait(1100);
      } else {
        await wait(youDraw || youOffer ? 450 : 150);
      }
      await afterEvents(step.events);
    }

    function turnMessage(drawer: PlayerId, offerer: PlayerId): Message {
      if (drawer === you) return { text: t('table.yourTurn', { name: nameOf(offerer) }) };
      return { text: offerer === you ? t('table.drawsFromYou', { drawer: nameOf(drawer) }) : t('table.drawsFrom', { drawer: nameOf(drawer), offerer: nameOf(offerer) }) };
    }

    function drawMessage(drawn: CardDrawn, pair: PairLaidDown | null): Message {
      const face = drawn.card?.face;
      const what = face ? cardName(face) : '';
      const name = nameOf(drawn.drawer);
      if (drawn.drawer === you) {
        if (face === PETER) return { text: t('draw.youPeter'), tone: 'peter' };
        return pair ? { text: t('draw.youPair', { card: what }), tone: 'good' } : { text: t('draw.you', { card: what }) };
      }
      if (drawn.offerer === you) {
        if (face === PETER) return { text: t('draw.tookPeter', { name }), tone: 'good' };
        return { text: t(pair ? 'draw.tookYourPair' : 'draw.tookYour', { name, card: what }) };
      }
      const other = nameOf(drawn.offerer);
      return pair ? { text: t('draw.otherPair', { name, other, card: cardName(pair.cards[0].face) }) } : { text: t('draw.other', { name, other }) };
    }

    /** Jump straight to a view, e.g. after reconnecting to an online game. */
    async function playSync(view: PlayerView) {
      commit(() => {
        show(view);
        setExtra([]);
        setHidden(new Set());
        setHiddenPairs(0);
        setHover(null);
        setPhase(view.phase === 'over' ? 'over' : 'playing');
      });
      if (view.phase === 'over' && view.loser) {
        setMessage(view.loser === you ? { text: t('table.youLost'), tone: 'peter' } : { text: t('table.playerLost', { name: nameOf(view.loser) }), tone: 'good' });
        setShowResult(true);
      } else if (view.drawer && view.offerer) {
        setMessage(turnMessage(view.drawer, view.offerer));
      }
    }

    async function play(step: Step) {
      if (step.kind === 'deal') return playDeal(step);
      if (step.kind === 'action') return playAction(step);
      if (step.kind === 'sync') return playSync(step.view);
      setHover(step.slot);
      setMessage({ text: t('table.choosing', { name: nameOf(step.playerId) }) });
      await wait(430);
    }

    async function run() {
      if (running) return;
      running = true;
      setBusy(true);
      while (alive && queue.length) {
        const step = queue.shift()!;
        try {
          await play(step);
        } catch (err) {
          console.error(err);
          if (step.kind !== 'hover') commit(() => show(step.view));
        }
      }
      running = false;
      if (!alive) return;
      setBusy(false);
      host.ready();
    }

    const unsubscribe = host.subscribe((step) => {
      queue.push(step);
      // Start outside React's commit phase, so flushSync is allowed.
      setTimeout(() => void run(), 0);
    });
    return () => {
      alive = false;
      unsubscribe();
      host.dispose();
    };
  }, [host, you]);

  if (!view) return null;

  const seatIndex = view.seats.findIndex((s) => s.id === you);
  const opponents = [...view.seats.slice(seatIndex + 1), ...view.seats.slice(0, seatIndex)]; // clockwise from your left
  const me = view.seats[seatIndex]!;
  const offerer = view.seats.find((s) => s.id === view.offerer);
  const yourTurn = phase === 'playing' && view.drawer === you && !busy;
  const visiblePairs = view.pairs.slice(0, Math.max(0, view.pairs.length - hiddenPairs));
  const placeOf = (id: PlayerId) => view.finishOrder.indexOf(id) + 1;

  return (
    <div className="flex h-dvh min-h-[640px] flex-col overflow-hidden">
      <TopBar>
        <p className="hidden text-sm text-pergament-dim sm:block">
          <span className="font-semibold text-pergament">{visiblePairs.length}</span> {t('table.pairsDown', { total: ALPINE_DECK.length })}
        </p>
        <button type="button" className="btn btn-line px-5 py-2.5 text-[15px]" onClick={() => (phase === 'over' ? onLeave() : setConfirmLeave(true))}>
          {t('table.leave')}
        </button>
      </TopBar>

      <main className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col px-3 sm:px-8">
        <section className="table-surface frame elev-2 relative flex-1 rounded-[40px] [--r:40px]" aria-label={t('table.aria')}>
          <ol className="seats" aria-label={t('table.others')}>
            {opponents.map((s, i) => {
              const angle = Math.PI - ((i + 1) * Math.PI) / (opponents.length + 1);
              const style = { '--x': `${50 + Math.cos(angle) * 40}%`, '--y': `${46 - Math.sin(angle) * 32}%` } as CSSProperties;
              return (
                <Seat
                  key={s.id}
                  style={style}
                  name={s.name}
                  index={i}
                  count={s.cardCount}
                  id={s.id}
                  role={phase !== 'playing' ? null : view.drawer === s.id ? 'drawer' : view.offerer === s.id ? 'offerer' : null}
                  place={s.isOut ? placeOf(s.id) : 0}
                  loser={view.loser === s.id}
                  offline={!!offline?.has(s.id)}
                />
              );
            })}
          </ol>

          <div className="table-center" style={{ '--center-top': `calc(${46 - Math.sin(Math.PI / (opponents.length + 1)) * 32}% + 64px)` } as CSSProperties}>
            <p
              key={message.text}
              className={`status-line font-display text-[clamp(1.15rem,2.2vw,1.6rem)] tracking-[-0.02em] ${message.tone === 'peter' ? 'text-glut' : message.tone === 'good' ? 'text-pergament' : 'text-pergament-dim'}`}
              aria-live="polite"
            >
              {message.text}
            </p>

            <div className="table-middle">
              <Pile pairs={visiblePairs} />
              {view.drawer === you && phase === 'playing' && offerer ? (
                <OfferFan count={offerer.cardCount} from={offerer.name} enabled={yourTurn} onPick={(slot) => host.draw(slot)} />
              ) : (
                <div className="offer-placeholder" aria-hidden="true" />
              )}
            </div>
          </div>
        </section>

        <section className="your-side" aria-label={t('table.yourHand')}>
          <Hand cards={[...view.hand, ...extra]} dealtPairs={extra} hidden={hidden} hover={hover} dealing={phase === 'dealing'} you={you} />
          <p className="mt-1 text-center text-sm text-pergament-mute">
            {me.isOut
              ? t('status.out', { ord: ordinal(placeOf(me.id)), n: placeOf(me.id) })
              : view.loser === me.id
                ? t('status.keptCat')
                : phase === 'dealing'
                  ? t('status.dealing')
                  : view.drawer === me.id
                    ? t('status.drawing')
                    : view.offerer === me.id
                      ? t('status.offering')
                      : tn('status.hold', me.cardCount)}
          </p>
        </section>
      </main>

      {showResult && <Result view={view} you={you} actions={result} />}
      {confirmLeave && <ConfirmLeave note={leaveNote} onStay={() => setConfirmLeave(false)} onLeave={onLeave} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Seat(props: {
  id: PlayerId;
  name: string;
  index: number;
  count: number;
  role: 'drawer' | 'offerer' | null;
  place: number;
  loser: boolean;
  offline: boolean;
  style: CSSProperties;
}) {
  const { id, name, index, count, role, place, loser, offline, style } = props;
  const status = loser
    ? t('seat.keptCat')
    : place
      ? t('seat.safe', { ord: ordinal(place), n: place })
      : offline
        ? t('seat.offline')
        : role === 'drawer'
          ? t('seat.drawing')
          : role === 'offerer'
            ? t('seat.offering')
            : tn('seat.cards', count);
  return (
    <li className={`seat ${role ? `is-${role}` : ''} ${place ? 'is-out' : ''} ${loser ? 'is-loser' : ''} ${offline && !place ? 'is-offline' : ''}`} style={style}>
      <div className="flex items-center gap-2.5">
        <span className={`avatar avatar-${index % 5}`} aria-hidden="true">
          {name.slice(0, 1)}
        </span>
        <p className="leading-tight">
          <span className="block font-semibold">{name}</span>
          <span className="block text-xs text-pergament-mute">{status}</span>
        </p>
      </div>
      <div className="mini-fan" data-seat-hand={id} style={{ '--n': count } as CSSProperties}>
        {Array.from({ length: count }, (_, i) => (
          <CardBack key={i} className="mini" />
        ))}
      </div>
    </li>
  );
}

function Pile({ pairs }: { pairs: readonly { cards: readonly [Card, Card] }[] }) {
  const shown = pairs.slice(-6);
  return (
    <div className="pile" aria-label={t('pile.aria', { n: pairs.length })}>
      <div className="pile-stack">
        {shown.map((p, i) => {
          const n = pairs.length - shown.length + i;
          const tilt = ((n * 37) % 17) - 8;
          return (
            <div key={p.cards[0].id} className="pile-pair" style={{ transform: `translate(${(n % 3) * 3 - 3}px, ${-i * 2}px) rotate(${tilt}deg)`, zIndex: i }}>
              <CardFace card={p.cards[0]} />
              <CardFace card={p.cards[1]} />
            </div>
          );
        })}
        <span className="pile-target" data-pile-target aria-hidden="true" />
      </div>
      <p className="mt-2 text-center text-xs text-pergament-mute">{pairs.length ? tn('pile.down', pairs.length) : t('pile.none')}</p>
    </div>
  );
}

function OfferFan({ count, from, enabled, onPick }: { count: number; from: string; enabled: boolean; onPick: (slot: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const width = useWidth(ref);
  const w = useCardWidth(0.075, 104, 56, 0.105);
  const step = count > 1 ? Math.min(w * 0.62, (width - w) / (count - 1)) : 0;
  const total = w + step * (count - 1);
  return (
    <div className="offer" role="group" aria-label={t('offer.aria', { name: from })}>
      <div ref={ref} className="offer-fan" style={{ height: w * 1.4 + 36 }}>
        {Array.from({ length: count }, (_, i) => {
          const mid = (count - 1) / 2;
          const rot = (i - mid) * Math.min(3, 30 / count);
          return (
            <button
              key={`${count}-${i}`}
              type="button"
              className="offer-card"
              data-offer-slot={i}
              disabled={!enabled}
              onClick={() => onPick(i)}
              aria-label={t('offer.card', { i: i + 1, n: count, name: from })}
              style={{ width: w, transform: `translate(${(width - total) / 2 + i * step}px, ${Math.abs(i - mid) * 2.2}px) rotate(${rot}deg)`, zIndex: i }}
            >
              <CardBack />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Hand(props: {
  cards: readonly Card[];
  dealtPairs: readonly Card[];
  hidden: ReadonlySet<string>;
  hover: number | null;
  dealing: boolean;
  you: PlayerId;
}) {
  const { cards, dealtPairs, hidden, hover, dealing, you } = props;
  const ref = useRef<HTMLDivElement>(null);
  const width = useWidth(ref);
  const w = useCardWidth(0.085, 118, 60, 0.12);
  const n = cards.length;
  const step = n > 1 ? Math.min(w * 0.68, (width - w) / (n - 1)) : 0;
  const total = w + step * (n - 1);
  const pairIds = new Set(dealtPairs.map((c) => c.id));
  return (
    <div ref={ref} className={`hand-row ${dealing ? 'is-dealing' : ''}`} style={{ height: w * 1.4 + 40 }} data-seat-hand={you}>
      {cards.map((c, i) => {
        const mid = (n - 1) / 2;
        const rot = (i - mid) * Math.min(2.6, 26 / Math.max(n, 1));
        return (
          <div
            key={c.id}
            className={`hand-card ${pairIds.has(c.id) ? 'is-dealt-pair' : ''} ${hover === i ? 'is-hovered' : ''}`}
            data-hand-card={c.id}
            style={{
              width: w,
              transform: `translate(${(width - total) / 2 + i * step}px, ${Math.abs(i - mid) ** 1.6 * 1.4}px) rotate(${rot}deg)`,
              visibility: hidden.has(c.id) ? 'hidden' : undefined,
              zIndex: i,
              '--i': i,
            } as CSSProperties}
          >
            <div className="hand-card-inner">
              <CardFace card={c} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Result({ view, you, actions }: { view: PlayerView; you: PlayerId; actions: TableProps['result'] }) {
  const lost = view.loser === you;
  const loser = view.seats.find((s) => s.id === view.loser);
  const place = view.finishOrder.indexOf(you) + 1;
  const ref = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => (ref.current ?? dialogRef.current)?.focus(), []);
  const peter: Card = { id: 'result-peter', face: PETER };
  return (
    <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="result-title">
      <div ref={dialogRef} tabIndex={-1} className="dialog frame elev-2 rounded-[28px] [--r:28px] outline-none">
        <div className="mx-auto w-[clamp(110px,22vw,150px)] rotate-[4deg]">
          <CardFace card={peter} className="result-card" />
        </div>
        <h2 id="result-title" className="h-display mt-7 text-center text-[clamp(2rem,5vw,2.8rem)]">
          {lost ? t('result.lostTitle') : t('result.wonTitle')}
        </h2>
        <p className="mx-auto mt-3 max-w-sm text-center text-pergament-dim">
          {lost
            ? t('result.lostText')
            : t('result.wonText', { loser: loser?.name ?? t('result.someone'), ord: ordinal(place), n: place })}
        </p>
        <ol className="mx-auto mt-7 max-w-xs space-y-1.5 text-[15px]">
          {view.finishOrder.map((id, i) => (
            <li key={id} className="flex justify-between gap-4">
              <span>
                <span className="mr-2 font-display text-messing">{i + 1}</span>
                {id === you ? t('you') : view.seats.find((s) => s.id === id)?.name}
              </span>
              <span className="text-pergament-mute">{t('result.safe')}</span>
            </li>
          ))}
          {loser && (
            <li className="flex justify-between gap-4 text-glut">
              <span>
                <span className="mr-2 font-display">{view.seats.length}</span>
                {loser.id === you ? t('you') : loser.name}
              </span>
              <span>{t('result.keptCat')}</span>
            </li>
          )}
        </ol>
        {(actions.primary || actions.secondary) && (
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            {actions.primary && (
              <button ref={ref} type="button" className="btn btn-glut" onClick={actions.primary.onClick}>
                {actions.primary.label}
              </button>
            )}
            {actions.secondary && (
              <button type="button" className="btn btn-line" onClick={actions.secondary.onClick}>
                {actions.secondary.label}
              </button>
            )}
          </div>
        )}
        {actions.note && <p className="mt-8 text-center text-pergament-dim">{actions.note}</p>}
        <p className="mt-6 text-center text-sm">
          <a href="/" className="link">
            {t('result.home')}
          </a>
        </p>
      </div>
    </div>
  );
}

function ConfirmLeave({ note, onStay, onLeave }: { note: string; onStay: () => void; onLeave: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onStay();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onStay]);
  return (
    <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="leave-title">
      <div className="dialog frame elev-2 max-w-md rounded-[28px] [--r:28px]">
        <h2 id="leave-title" className="h-display text-center text-3xl">
          {t('leave.title')}
        </h2>
        <p className="mt-3 text-center text-pergament-dim">{note}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button ref={ref} type="button" className="btn btn-glut" onClick={onStay}>
            {t('leave.stay')}
          </button>
          <button type="button" className="btn btn-line" onClick={onLeave}>
            {t('table.leave')}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function useWidth(ref: RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(([entry]) => entry && setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

/** Card width from the viewport: a share of the width, capped by height on short screens. */
function useCardWidth(share: number, max: number, min: number, heightShare: number) {
  const calc = () => Math.round(Math.max(min, Math.min(max, window.innerWidth * share, window.innerHeight * heightShare)));
  const [w, setW] = useState(calc);
  useEffect(() => {
    const onResize = () => setW(calc());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  });
  return w;
}

