/**
 * Where the game server lives. Set VITE_SERVER_URL for production builds
 * (apps/web/.env.production); local development uses `npm run dev:server`.
 */
export const SERVER_URL: string = import.meta.env.VITE_SERVER_URL || 'http://localhost:8787';

/** Path of the game page: Vercel serves clean URLs, the dev server serves the file. */
export const PLAY_PATH = import.meta.env.DEV ? '/play.html' : '/play';

export const roomLink = (code: string) => `${location.origin}${PLAY_PATH}?room=${code}`;

/** The name you last played under, shared by practice and online games. */
export function savedName(): string {
  try {
    const direct = localStorage.getItem('sp.name');
    if (direct) return direct;
    const practice = JSON.parse(localStorage.getItem('sp.practice') ?? '{}');
    return typeof practice.name === 'string' ? practice.name : '';
  } catch {
    return '';
  }
}

export function saveName(name: string) {
  try {
    localStorage.setItem('sp.name', name);
  } catch {
    /* private mode */
  }
}
