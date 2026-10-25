import { useEffect, useMemo, useState, useSyncExternalStore, type FormEvent, type ReactNode } from 'react';
import type { ErrorCode, RoomInfo } from '@sp/engine/protocol';
import type { PlayerId } from '@sp/engine';
import { RoomClient, createRoom } from './room-client';
import { PLAY_PATH, roomLink, saveName, savedName } from './config';
import { Table } from './Table';
import { TopBar } from './Setup';

/* ------------------------------------------------------------------ */
/* Create a room                                                       */
/* ------------------------------------------------------------------ */

export function CreateRoom() {
  const [name, setName] = useState(savedName);
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
      setError('The game server didn’t answer. Check your connection and try again.');
    }
  };

  return (
    <Screen>
      <form onSubmit={submit} className="panel frame elev-2">
        <Glow />
        <h1 className="h-display relative text-[clamp(2.2rem,6vw,3.2rem)]">Play with friends</h1>
        <p className="relative mt-3 max-w-md text-pergament-dim">
          Create a room, then send the link. Everyone joins from their own phone or computer.
        </p>
        <NameField value={name} onChange={setName} />
        {error && (
          <p className="relative mt-6 text-glut" role="alert">
            {error}
          </p>
        )}
        <div className="relative mt-10 flex flex-wrap items-center gap-5">
          <button type="submit" className="btn btn-glut text-base" disabled={busy}>
            {busy ? 'Creating room…' : 'Create room'}
          </button>
          <a href={PLAY_PATH} className="link text-[15px]">
            Practise against bots instead
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
  const snap = useSyncExternalStore(client.subscribe, client.getSnapshot);

  useEffect(() => {
    document.title = `Room ${code}: Schwarzer Peter`;
    const invited = sessionStorage.getItem('sp.autojoin') === code;
    sessionStorage.removeItem('sp.autojoin');
    // Rejoin straight away if this browser already has a seat, or just created the room.
    if (client.hasSeat || invited) client.join(savedName() || 'Player');
    return () => client.close();
  }, [client, code]);

  const round = snap.room?.round ?? 0;
  const host = useMemo(() => (snap.you ? client.host() : null), [client, snap.you, round]);
  const offline = useMemo(
    () => new Set((snap.room?.members ?? []).filter((m) => !m.isBot && !m.connected).map((m) => m.id)),
    [snap.room],
  );

  if (snap.fatal) return <RoomProblem code={snap.fatal.code} />;
  if (!snap.joined) {
    if (snap.status === 'idle') return <JoinRoom code={code} onJoin={(name) => client.join(name)} />;
    return <Waiting text={`Joining room ${code}…`} />;
  }
  if (!snap.room || !host) return <Waiting text={`Joining room ${code}…`} />;

  const leave = () => {
    client.leave();
    location.href = '/';
  };
  const hostMember = snap.room.members.find((m) => m.isHost);
  const iAmHost = hostMember?.id === snap.you;

  return (
    <>
      {snap.room.status === 'lobby' ? (
        <Lobby room={snap.room} you={snap.you!} onStart={(bots) => client.send({ t: 'start', bots })} onLeave={leave} />
      ) : (
        <Table
          key={round}
          host={host}
          offline={offline}
          onLeave={leave}
          leaveNote="A bot takes your seat for the rest of this round."
          result={
            iAmHost
              ? { primary: { label: 'Play again', onClick: () => client.send({ t: 'again' }) } }
              : { note: `Waiting for ${hostMember?.name ?? 'the host'} to start another round.` }
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
    onJoin(name.trim() || 'Player');
  };
  return (
    <Screen>
      <form onSubmit={submit} className="panel frame elev-2">
        <Glow />
        <p className="relative text-sm text-pergament-dim">You’re invited to room</p>
        <p className="room-code relative mt-1">{code}</p>
        <p className="relative mt-4 max-w-md text-pergament-dim">Pick a name so the others know who you are.</p>
        <NameField value={name} onChange={setName} autoFocus />
        <div className="relative mt-10 flex flex-wrap items-center gap-5">
          <button type="submit" className="btn btn-glut text-base">
            Join room
          </button>
          <a href="/#rules" className="link text-[15px]">
            How to play
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
        <p className="relative text-sm text-pergament-dim">Room code</p>
        <p className="room-code relative mt-1">{room.code}</p>
        <p className="relative mt-4 max-w-md text-pergament-dim">
          Send this link to your friends. Up to {room.maxPlayers} players can sit at the table.
        </p>

        <div className="relative mt-6 flex flex-col gap-3 sm:flex-row">
          <label htmlFor="room-link" className="sr-only">
            Room link
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
              {copied ? 'Link copied' : 'Copy link'}
            </button>
            {canShare && (
              <button type="button" className="btn btn-line flex-1 sm:flex-none" onClick={() => navigator.share({ title: 'Schwarzer Peter', text: `Join my game of Schwarzer Peter: room ${room.code}`, url: link }).catch(() => undefined)}>
                Share
              </button>
            )}
          </div>
        </div>

        <section className="relative mt-10" aria-labelledby="table-title">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="table-title" className="h-display text-2xl">
              At the table
            </h2>
            <p className="text-sm text-pergament-mute">
              {total} of {room.maxPlayers} seats
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
                  {[m.id === you ? 'you' : '', m.isHost ? 'host' : '', m.connected ? '' : 'away'].filter(Boolean).join(', ')}
                </span>
              </li>
            ))}
            {Array.from({ length: bots }, (_, i) => (
              <li key={`bot-${i}`} className="member is-bot">
                <span className="avatar avatar-bot" aria-hidden="true">
                  B
                </span>
                <span className="flex-1 font-semibold text-pergament-dim">Bot</span>
                <span className="text-xs text-pergament-mute">joins at the start</span>
              </li>
            ))}
          </ul>
        </section>

        {isHost ? (
          <div className="relative mt-8">
            <div className="flex flex-wrap items-center gap-4">
              <span id="bots-label" className="text-sm text-pergament-dim">
                Fill empty seats with bots
              </span>
              <div className="stepper" role="group" aria-labelledby="bots-label">
                <button type="button" onClick={() => setBots(Math.max(0, bots - 1))} disabled={bots === 0} aria-label="One bot fewer">
                  −
                </button>
                <span aria-live="polite">{bots}</span>
                <button type="button" onClick={() => setBots(Math.min(maxBots, bots + 1))} disabled={bots >= maxBots} aria-label="One bot more">
                  +
                </button>
              </div>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-5">
              <button type="button" className="btn btn-glut text-base" disabled={total < 2} onClick={() => onStart(bots)}>
                Start the game
              </button>
              {total < 2 && <p className="text-sm text-pergament-mute">Invite a friend or add a bot to start.</p>}
            </div>
          </div>
        ) : (
          <p className="relative mt-8 text-pergament-dim">Waiting for {host?.name ?? 'the host'} to start the game.</p>
        )}

        <p className="relative mt-8 text-sm">
          <button type="button" className="link" onClick={onLeave}>
            Leave room
          </button>
        </p>
      </div>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* Problems and small pieces                                           */
/* ------------------------------------------------------------------ */

const PROBLEMS: Partial<Record<ErrorCode, { title: string; text: string }>> = {
  ROOM_NOT_FOUND: { title: 'This room doesn’t exist', text: 'Check the code you were sent, or create a new room.' },
  ROOM_FULL: { title: 'This room is full', text: 'A game has at most 6 players. Ask the host for a new room, or create your own.' },
  GAME_IN_PROGRESS: { title: 'This game has already started', text: 'You can join the next round once the host takes everyone back to the room, or create your own room.' },
};

export function RoomProblem({ code }: { code: ErrorCode }) {
  const problem = PROBLEMS[code] ?? PROBLEMS.ROOM_NOT_FOUND!;
  return (
    <Screen>
      <div className="panel frame elev-2">
        <Glow />
        <h1 className="h-display relative text-[clamp(2rem,5vw,2.8rem)]">{problem.title}</h1>
        <p className="relative mt-3 max-w-md text-pergament-dim">{problem.text}</p>
        <div className="relative mt-10 flex flex-wrap items-center gap-4">
          <a href={`${PLAY_PATH}?create=1`} className="btn btn-glut text-base">
            Create a new room
          </a>
          <a href={PLAY_PATH} className="btn btn-line text-base">
            Practise against bots
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
  const text = reconnecting ? 'Connection lost. Reconnecting…' : notice;
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
        Your name
      </label>
      <input
        id="player-name"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={16}
        autoComplete="nickname"
        autoFocus={autoFocus}
        placeholder="Player"
        className="mt-2.5 w-full max-w-xs rounded-full bg-russ/70 px-5 py-3 font-semibold text-pergament shadow-[inset_0_0_0_1px_rgba(198,161,91,.35),inset_0_2px_6px_rgba(0,0,0,.4)] placeholder:text-pergament-mute/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-messing"
      />
    </div>
  );
}

function Screen({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col">
      <TopBar />
      <main className="flex-1 grid place-items-center px-5 pb-16 pt-4">{children}</main>
    </div>
  );
}

const Glow = () => (
  <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,rgba(232,98,44,.2),transparent)]" aria-hidden="true" />
);
