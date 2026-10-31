/**
 * Tips for someone's first games. Each one shows once, the first time its
 * moment comes up, and is remembered in this browser only.
 */

export type Hint = 'draw' | 'peter' | 'bluff';

const STORAGE_KEY = 'sp.hints';
const ALL: readonly Hint[] = ['draw', 'peter', 'bluff'];

function load(): Set<string> {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return new Set(Array.isArray(saved) ? saved.filter((h) => typeof h === 'string') : []);
  } catch {
    return new Set();
  }
}

const seen = load();

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...seen]));
  } catch {
    /* private mode: tips come back next visit */
  }
}

export const hintSeen = (hint: Hint) => seen.has(hint);

export function markHintSeen(hint: Hint) {
  if (seen.has(hint)) return;
  seen.add(hint);
  save();
}

/** "No more tips": skip the rest too. */
export function markAllHintsSeen() {
  ALL.forEach((h) => seen.add(h));
  save();
}
