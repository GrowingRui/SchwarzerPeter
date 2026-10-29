import { useState } from 'react';
import type { PlayerId } from '@sp/engine';
import { createPracticeGame, type GameHost, type PracticeSettings } from './host';
import { Setup } from './Setup';
import { Table } from './Table';
import { t } from '../i18n';

const STORAGE_KEY = 'sp.practice';

function loadSettings(): PracticeSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    const bots = Number(saved.bots);
    return {
      name: typeof saved.name === 'string' ? saved.name.slice(0, 16) : '',
      bots: Number.isInteger(bots) && bots >= 1 && bots <= 5 ? bots : 3,
    };
  } catch {
    return { name: '', bots: 3 };
  }
}

export function App() {
  const [settings, setSettings] = useState(loadSettings);
  const [host, setHost] = useState<(GameHost & { readonly botNames: readonly string[] }) | null>(null);
  const [round, setRound] = useState(0);
  // Whoever kept the cat carries the soot into the next game with the same bots.
  const [sooty, setSooty] = useState<PlayerId | null>(null);

  const start = (next: PracticeSettings, sameTable = false) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* private mode: settings just aren't remembered */
    }
    setSettings(next);
    if (!sameTable) setSooty(null);
    setHost(createPracticeGame(next, sameTable ? host?.botNames : undefined));
    setRound((r) => r + 1);
  };

  if (!host) return <Setup initial={settings} onStart={(next) => start(next)} />;
  return (
    <Table
      key={round}
      host={host}
      sooty={sooty}
      onGameOver={(view) => setSooty(view.loser)}
      result={{
        primary: { label: t('result.again'), onClick: () => start(settings, true) },
        secondary: { label: t('result.changePlayers'), onClick: () => setHost(null) },
      }}
      leaveNote={t('leave.practiceNote')}
    />
  );
}
