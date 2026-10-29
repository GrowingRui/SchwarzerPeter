import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from 'react';
import type { ErrorCode, RoomInfo } from '@sp/engine/protocol';
import type { PlayerId } from '@sp/engine';
import { RoomClient, createRoom, findQuickTable } from './room-client';
import { PLAY_PATH, roomLink, saveName, savedName } from './config';
import { Table } from './Table';
import { TopBar, useDocumentTitle } from './Setup';
import { t, tn } from '../i18n';

/* ------------------------------------------------------------------ */
/* Quick match                                                         */
/* ------------------------------------------------------------------ */

/** Get a seat at the table that is filling up and go there. */
async function goToQuickTable(name: string) {
  const code = await findQuickTable();
  saveName(name);
  sessionStorage.setItem('sp.autojoin', code);
  location.replace(`${PLAY_PATH}?room=${code}&quick=1`);
}

/** Pick a name and find a table. With `auto`, go straight away (e.g. "Find another table"). */
export function QuickMatch({ auto }: { auto: boolean }) {
  const [name, setName] = useState(savedName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useDocumentTitle(t('quick.docTitle'));

  const find = async () => {
    setBusy(true);
    setError(null);
    try {
      await goToQuickTable(name.trim() || t('player'));
    } catch {
      setBusy(false);
      setError(t('create.error'));
    }
  };
  const started = useRef(false);
  useEffect(() => {
    if (auto && !started.current) {
      started.current = true;
      void find();
    }
  });

  if (auto && busy) return <Waiting text={t('quick.finding')} />;
  return (
    <Screen>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void find();
        }}
        className="panel frame elev-2"
      >
        <Glow />
        <h1 className="h-display relative text-[clamp(2.2rem,6vw,3.2rem)]">{t('quick.heading')}</h1>
        <p className="relative mt-3 max-w-md text-pergament-dim">{t('quick.lead')}</p>
        <NameField value={name} onChange={setName} />
        {error && (
          <p className="relative mt-6 text-glut" role="alert">
            {error}
          </p>
        )}
        <div className="relative mt-10 flex flex-wrap items-center gap-5">
          <button type="submit" className="btn btn-glut text-base" disabled={busy}>
            {busy ? t('quick.finding') : t('quick.find')}
          </button>
          <a href={`${PLAY_PATH}?create=1`} className="link text-[15px]">
            {t('quick.friends')}
          </a>
        </div>
      </form>
    </Screen>
  );
}

/** The table we were sent to started just before we got there: quietly find another. */
function FindAnotherTable() {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    goToQuickTable(savedName() || t('player')).catch(() => setFailed(true));
  }, []);
  if (failed) return <QuickMatch auto={false} />;
  return <Waiting text={t('quick.requeue')} />;
}

function QuickLobby({ room, you, roomAt, onLeave }: { room: RoomInfo; you: PlayerId; roomAt: number; onLeave: () => void }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  const left = room.startsInMs === null ? null : Math.max(0, Math.ceil((roomAt + room.startsInMs - now) / 1000));
  const people = room.members.filter((m) => !m.isBot);
  const open = Math.max(0, room.maxPlayers - people.length);

  return (
    <Screen>
      <div className="panel frame elev-2">
        <Glow />
        <h1 className="h-display relative text-[clamp(2rem,5.5vw,2.8rem)]">{t('quick.waitTitle')}</h1>
        <p className="relative mt-3 max-w-md text-pergament-dim">{t('quick.waitLead', { seats: room.maxPlayers })}</p>
        <p className="relative mt-7 flex items-baseline gap-3" role="timer" aria-live="off">
          {left === null || left > 0 ? (
            <>
              <span className="room-code tabular-nums">{left ?? '…'}</span>
              <span className="text-pergament-dim">{tn('quick.seconds', left ?? 2)}</span>
            </>
          ) : (
            <span className="font-display text-3xl">{t('quick.starting')}</span>
          )}
        </p>

        <ul className="relative mt-8 grid gap-2.5 sm:grid-cols-2" aria-label={t('lobby.table')}>
          {people.map((m, i) => (
            <li key={m.id} className="member">
              <span className={`avatar avatar-${i % 5}`} aria-hidden="true">
                {m.name.slice(0, 1)}
              </span>
              <span className="min-w-0 flex-1 truncate font-semibold">{m.name}</span>
              <span className="text-xs text-pergament-mute">{m.id === you ? t('lobby.tagYou') : ''}</span>
            </li>
          ))}
          {Array.from({ length: open }, (_, i) => (
            <li key={`open-${i}`} className="member is-bot">
              <span className="avatar avatar-bot" aria-hidden="true" />
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block font-semibold text-pergament-dim">{t('quick.openSeat')}</span>
                <span className="block text-xs text-pergament-mute">{t('quick.openSeatNote')}</span>
              </span>
            </li>
          ))}
        </ul>

        <p className="relative mt-8 text-sm">
          <button type="button" className="link" onClick={onLeave}>
            {t('quick.leave')}
          </button>
        </p>
      </div>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* Create a room                                                       */
/* ------------------------------------------------------------------ */

export function CreateRoom() {
  const [name, setName] = useState(savedName);
  useDocumentTitle(`${t('create.title')}: Schwarzer Peter`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const code = await createRoom();
      saveName(name.trim());
      sessionStorage.setItem('sp.autojoin', code);
      location.replace(`${PLAY_PATH}?room=${code}`);
    } catch {
      setBusy(false);
      setError(t('create.error'));
    }
  };

  return (
    <Screen>
      <form onSubmit={submit} className="panel frame elev-2">
        <Glow />
        <h1 className="h-display relative text-[clamp(2.2rem,6vw,3.2rem)]">{t('create.title')}</h1>
        <p className="relative mt-3 max-w-md text-pergament-dim">{t('create.lead')}</p>
        <NameField value={name} onChange={setName} />
        {error && (
          <p className="relative mt-6 text-glut" role="alert">
            {error}
          </p>
        )}
        <div className="relative mt-10 flex flex-wrap items-center gap-5">
          <button type="submit" className="btn btn-glut text-base" disabled={busy}>
            {busy ? t('create.busy') : t('create.button')}
          </button>
          <a href={PLAY_PATH} className="link text-[15px]">
            {t('create.practise')}
          </a>
        </div>
      </form>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* A room: join, wait in the lobby, play                               */
/* ------------------------------------------------------------------ */

export function OnlineGame({ code }: { code: string }) {
  const client = useMemo(() => new RoomClient(code), [code]);
  useDocumentTitle(t('room.docTitle', { code }));
  const snap = useSyncExternalStore(client.subscribe, client.getSnapshot);

  useEffect(() => {
    const invited = sessionStorage.getItem('sp.autojoin') === code;
    sessionStorage.removeItem('sp.autojoin');
    // Rejoin straight away if this browser already has a seat, or just created the room.
    if (client.hasSeat || invited) client.join(savedName() || t('player'));
    return () => client.close();
  }, [client, code]);

  const round = snap.room?.round ?? 0;
  const host = useMemo(() => (snap.you ? client.host() : null), [client, snap.you, round]);
  const offline = useMemo(
    () => new Set((snap.room?.members ?? []).filter((m) => !m.isBot && !m.connected).map((m) => m.id)),
    [snap.room],
  );

  const cameForQuickMatch = new URLSearchParams(location.search).has('quick');
  if (snap.fatal) {
    // Lost the race for a quick-match seat: find another table instead of showing an error.
    if (cameForQuickMatch && ['GAME_IN_PROGRESS', 'ROOM_FULL', 'ROOM_NOT_FOUND'].includes(snap.fatal.code)) return <FindAnotherTable />;
    return <RoomProblem code={snap.fatal.code} />;
  }
  if (!snap.joined) {
    if (snap.status === 'idle') return <JoinRoom code={code} onJoin={(name) => client.join(name)} />;
    return <Waiting text={t('room.joining', { code })} />;
  }
  if (!snap.room || !host) return <Waiting text={t('room.joining', { code })} />;

  const leave = () => {
    client.leave();
    location.href = '/';
  };
  const hostMember = snap.room.members.find((m) => m.isHost);
  const iAmHost = hostMember?.id === snap.you;
  const quick = snap.room.mode === 'quick';
  const findAnother = () => {
    client.leave();
    location.replace(`${PLAY_PATH}?quick=1&go=1`);
  };

  return (
    <>
      {snap.room.status === 'lobby' ? (
        quick ? (
          <QuickLobby room={snap.room} you={snap.you!} roomAt={snap.roomAt} onLeave={leave} />
        ) : (
          <Lobby room={snap.room} you={snap.you!} onStart={(bots) => client.send({ t: 'start', bots })} onLeave={leave} />
        )
      ) : (
        <Table
          key={round}
          host={host}
          offline={offline}
          sooty={snap.room.sooty}
          onLeave={leave}
          leaveNote={t('leave.onlineNote')}
          result={
            quick
              ? { primary: { label: t('quick.another'), onClick: findAnother } }
              : iAmHost
                ? { primary: { label: t('result.again'), onClick: () => client.send({ t: 'again' }) } }
                : { note: t('room.waitAgain', { name: hostMember?.name ?? t('room.theHost') }) }
          }
        />
      )}
      <ConnectionPill reconnecting={snap.status === 'reconnecting'} notice={snap.notice} />
    </>
  );
}

function JoinRoom({ code, onJoin }: { code: string; onJoin: (name: string) => void }) {
  const [name, setName] = useState(savedName);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onJoin(name.trim() || t('player'));
  };
  return (
    <Screen>
      <form onSubmit={submit} className="panel frame elev-2">
        <Glow />
        <p className="relative text-sm text-pergament-dim">{t('join.invited')}</p>
        <p className="room-code relative mt-1">{code}</p>
        <p className="relative mt-4 max-w-md text-pergament-dim">{t('join.lead')}</p>
        <NameField value={name} onChange={setName} autoFocus />
        <div className="relative mt-10 flex flex-wrap items-center gap-5">
          <button type="submit" className="btn btn-glut text-base">
            {t('join.button')}
          </button>
          <a href="/#rules" className="link text-[15px]">
            {t('join.rules')}
          </a>
        </div>
      </form>
    </Screen>
  );
}

function Lobby({ room, you, onStart, onLeave }: { room: RoomInfo; you: PlayerId; onStart: (bots: number) => void; onLeave: () => void }) {
  const people = room.members.filter((m) => !m.isBot);
  const host = room.members.find((m) => m.isHost);
  const isHost = host?.id === you;
  const maxBots = room.maxPlayers - people.length;
  const [wantedBots, setBots] = useState(people.length === 1 ? 1 : 0);
  const bots = Math.min(wantedBots, maxBots);
  const total = people.length + bots;
  const [copied, setCopied] = useState(false);
  const link = roomLink(room.code);
  const canShare = typeof navigator.share === 'function';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      /* clipboard blocked: the link stays selectable in the field */
    }
  };

  return (
    <Screen>
      <div className="panel frame elev-2 max-w-2xl">
        <Glow />
        <p className="relative text-sm text-pergament-dim">{t('lobby.code')}</p>
        <p className="room-code relative mt-1">{room.code}</p>
        <p className="relative mt-4 max-w-md text-pergament-dim">{t('lobby.lead', { n: room.maxPlayers })}</p>

        <div className="relative mt-6 flex flex-col gap-3 sm:flex-row">
          <label htmlFor="room-link" className="sr-only">
            {t('lobby.link')}
          </label>
          <input
            id="room-link"
            readOnly
            value={link}
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 rounded-full bg-russ/70 px-5 py-3 text-[15px] text-pergament-dim shadow-[inset_0_0_0_1px_rgba(198,161,91,.35),inset_0_2px_6px_rgba(0,0,0,.4)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-messing"
          />
          <div className="flex gap-3">
            <button type="button" className="btn btn-glut flex-1 sm:flex-none" onClick={copy}>
              {copied ? t('lobby.copied') : t('lobby.copy')}
            </button>
            {canShare && (
              <button type="button" className="btn btn-line flex-1 sm:flex-none" onClick={() => navigator.share({ title: 'Schwarzer Peter', text: t('lobby.shareText', { code: room.code }), url: link }).catch(() => undefined)}>
                {t('lobby.share')}
              </button>
            )}
          </div>
        </div>

        <section className="relative mt-10" aria-labelledby="table-title">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="table-title" className="h-display text-2xl">
              {t('lobby.table')}
            </h2>
            <p className="text-sm text-pergament-mute">
              {t('lobby.seats', { n: total, max: room.maxPlayers })}
            </p>
          </div>
          <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {people.map((m, i) => (
              <li key={m.id} className={`member ${m.connected ? '' : 'is-away'}`}>
                <span className={`avatar avatar-${i % 5}`} aria-hidden="true">
                  {m.name.slice(0, 1)}
                </span>
                <span className="min-w-0 flex-1 truncate font-semibold">{m.name}</span>
                <span className="text-xs text-pergament-mute">
                  {[m.id === you ? t('lobby.tagYou') : '', m.isHost ? t('lobby.tagHost') : '', m.connected ? '' : t('lobby.tagAway')].filter(Boolean).join(', ')}
                </span>
              </li>
            ))}
            {Array.from({ length: bots }, (_, i) => (
              <li key={`bot-${i}`} className="member is-bot">
                <span className="avatar avatar-bot" aria-hidden="true">
                  B
                </span>
                <span className="flex-1 font-semibold text-pergament-dim">{t('lobby.bot')}</span>
                <span className="text-xs text-pergament-mute">{t('lobby.botJoins')}</span>
              </li>
            ))}
          </ul>
        </section>

        {isHost ? (
          <div className="relative mt-8">
            <div className="flex flex-wrap items-center gap-4">
              <span id="bots-label" className="text-sm text-pergament-dim">
                {t('lobby.fillBots')}
              </span>
              <div className="stepper" role="group" aria-labelledby="bots-label">
                <button type="button" onClick={() => setBots(Math.max(0, bots - 1))} disabled={bots === 0} aria-label={t('lobby.fewer')}>
                  −
                </button>
                <span aria-live="polite">{bots}</span>
                <button type="button" onClick={() => setBots(Math.min(maxBots, bots + 1))} disabled={bots >= maxBots} aria-label={t('lobby.more')}>
                  +
                </button>
              </div>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-5">
              <button type="button" className="btn btn-glut text-base" disabled={total < 2} onClick={() => onStart(bots)}>
                {t('lobby.start')}
              </button>
              {total < 2 && <p className="text-sm text-pergament-mute">{t('lobby.needTwo')}</p>}
            </div>
          </div>
        ) : (
          <p className="relative mt-8 text-pergament-dim">{t('lobby.waiting', { name: host?.name ?? t('room.theHost') })}</p>
        )}

        <p className="relative mt-8 text-sm">
          <button type="button" className="link" onClick={onLeave}>
            {t('lobby.leave')}
          </button>
        </p>
      </div>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* Problems and small pieces                                           */
/* ------------------------------------------------------------------ */

const PROBLEMS: readonly ErrorCode[] = ['ROOM_NOT_FOUND', 'ROOM_FULL', 'GAME_IN_PROGRESS'];

export function RoomProblem({ code }: { code: ErrorCode }) {
  const key = PROBLEMS.includes(code) ? code : 'ROOM_NOT_FOUND';
  const problem = { title: t(`problem.${key}.title`), text: t(`problem.${key}.text`) };
  useDocumentTitle(`${problem.title}: Schwarzer Peter`);
  return (
    <Screen>
      <div className="panel frame elev-2">
        <Glow />
        <h1 className="h-display relative text-[clamp(2rem,5vw,2.8rem)]">{problem.title}</h1>
        <p className="relative mt-3 max-w-md text-pergament-dim">{problem.text}</p>
        <div className="relative mt-10 flex flex-wrap items-center gap-4">
          <a href={`${PLAY_PATH}?create=1`} className="btn btn-glut text-base">
            {t('problem.create')}
          </a>
          <a href={PLAY_PATH} className="btn btn-line text-base">
            {t('problem.practise')}
          </a>
        </div>
      </div>
    </Screen>
  );
}

function Waiting({ text }: { text: string }) {
  return (
    <Screen>
      <p className="font-display text-2xl text-pergament-dim" role="status">
        {text}
      </p>
    </Screen>
  );
}

function ConnectionPill({ reconnecting, notice }: { reconnecting: boolean; notice: string | null }) {
  const text = reconnecting ? t('conn.reconnecting') : notice;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[95] flex justify-center px-4" role="status" aria-live="polite">
      {text && <p className="pill">{text}</p>}
    </div>
  );
}

function NameField({ value, onChange, autoFocus }: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return (
    <div className="relative mt-8">
      <label htmlFor="player-name" className="block text-sm text-pergament-dim">
        {t('setup.name')}
      </label>
      <input
        id="player-name"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={16}
        autoComplete="nickname"
        autoFocus={autoFocus}
        placeholder={t('player')}
        className="mt-2.5 w-full max-w-xs rounded-full bg-russ/70 px-5 py-3 font-semibold text-pergament shadow-[inset_0_0_0_1px_rgba(198,161,91,.35),inset_0_2px_6px_rgba(0,0,0,.4)] placeholder:text-pergament-mute/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-messing"
      />
    </div>
  );
}

function Screen({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col">
      <TopBar showLanguage />
      <main className="flex-1 grid place-items-center px-5 pb-16 pt-4">{children}</main>
    </div>
  );
}

const Glow = () => (
  <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,rgba(232,98,44,.2),transparent)]" aria-hidden="true" />
);
