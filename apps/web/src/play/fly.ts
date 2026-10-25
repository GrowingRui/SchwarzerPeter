import { faceMarkup } from './cards';

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const SPRING = 'cubic-bezier(.34, 1.4, .64, 1)';
export const EASE_OUT = 'cubic-bezier(.22, 1, .36, 1)';

/** Speeds the table up (below 1) once nothing depends on you any more. */
let tempo = 1;
export const setTempo = (t: number) => {
  tempo = t;
};

export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, reduced() ? Math.min(ms, 60) : ms * tempo));
export const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

export interface FlyOptions {
  /** Card face to show; null shows the back. */
  face: string | null;
  /** Start face down and turn over on the way. */
  reveal?: boolean;
  duration?: number;
  /** Size of the flying card at the start and end (defaults to each rect). */
  width?: number;
}

/**
 * Animate a card from one screen rectangle to another on a fixed overlay.
 * Only transform and opacity are animated.
 */
export async function fly(from: DOMRect, to: DOMRect, opts: FlyOptions): Promise<void> {
  const layer = document.getElementById('fly-layer');
  if (!layer) return;
  const width = opts.width ?? to.width;
  const height = width * 1.4;
  const el = document.createElement('div');
  el.className = 'fly-card';
  el.style.width = `${width}px`;
  el.style.height = `${height}px`;
  const front = opts.face ? `<div class="fly-face fly-front">${faceMarkup(opts.face)}</div>` : '';
  const back = `<div class="fly-face fly-back"></div>`;
  el.innerHTML = `<div class="fly-inner">${back}${front}</div>`;
  layer.appendChild(el);

  const inner = el.firstElementChild as HTMLElement;
  const showFront = !!opts.face;
  const startFlipped = showFront && !opts.reveal;
  const fromScale = from.width / width;
  const toScale = to.width / width;
  const fx = from.left + from.width / 2 - width / 2;
  const fy = from.top + from.height / 2 - height / 2;
  const tx = to.left + to.width / 2 - width / 2;
  const ty = to.top + to.height / 2 - height / 2;
  const duration = reduced() ? 1 : (opts.duration ?? 560) * Math.max(tempo, 0.6);

  const move = el.animate(
    [
      { transform: `translate(${fx}px, ${fy}px) scale(${fromScale})` },
      { transform: `translate(${(fx + tx) / 2}px, ${Math.min(fy, ty) - 40}px) scale(${Math.max(fromScale, toScale) * 1.08})`, offset: 0.5 },
      { transform: `translate(${tx}px, ${ty}px) scale(${toScale})` },
    ],
    { duration, easing: EASE_OUT, fill: 'forwards' },
  );
  // The front face sits at 180deg: 0 shows the back, 180 shows the face.
  const flip = inner.animate(
    [{ transform: `rotateY(${startFlipped ? 180 : 0}deg)` }, { transform: `rotateY(${showFront ? 180 : 0}deg)` }],
    { duration, easing: SPRING, fill: 'forwards' },
  );
  await Promise.all([move.finished, flip.finished]).catch(() => undefined);
  el.remove();
}

/** Bounding box of the first element matching a selector, if it is on screen. */
export function rectOf(selector: string): DOMRect | null {
  const el = document.querySelector(selector);
  return el ? el.getBoundingClientRect() : null;
}
