import { useState } from 'react';
import { createPracticeGame, type GameHost, type PracticeSettings } from './host';
import { Setup } from './Setup';
import { Table } from './Table';

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
  const [host, setHost] = useState<GameHost | null>(null);
  const [round, setRound] = useState(0);

  const start = (next: PracticeSettings) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* private mode: settings just aren't remembered */
    }
    setSettings(next);
    setHost(createPracticeGame(next));
    setRound((r) => r + 1);
  };

  if (!host) return <Setup initial={settings} onStart={start} />;
  return <Table key={round} host={host} onPlayAgain={() => start(settings)} onChangePlayers={() => setHost(null)} />;
}
