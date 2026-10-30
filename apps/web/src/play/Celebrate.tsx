import { useState, type CSSProperties } from 'react';

/**
 * Little moments at the end of a game, drawn with plain elements that only
 * animate transform and opacity. All hidden when reduced motion is asked for.
 *
 * - Confetti: you got away safe and the game is over.
 * - Embers: you just laid down your last card.
 * - Soot: you kept the cat, and a puff of smoke rises around it.
 */

const CONFETTI_COLORS = ['messing', 'pergament', 'glut', 'glut-hot', 'messing-dim'].map((c) => `var(--color-${c})`);

const between = (min: number, max: number) => min + Math.random() * (max - min);

/** Random values made once per mount, so a re-render doesn't reshuffle the burst. */
function useOnce<T>(make: () => T): T {
  return useState(make)[0];
}

export function Confetti({ count = 42 }: { count?: number }) {
  const pieces = useOnce(() =>
    Array.from({ length: count }, (_, i) => {
      const side = i % 2 ? 1 : -1;
      return {
        style: {
          '--dx': `${side * between(40, 46) * (0.25 + Math.random())}vmin`,
          '--up': `${-between(14, 30)}vmin`,
          '--fall': `${between(30, 55)}vmin`,
          '--rot': `${side * between(240, 720)}deg`,
          '--delay': `${between(0, 260)}ms`,
          '--dur': `${between(1900, 2700)}ms`,
          '--flip': `${between(260, 520)}ms`,
        } as CSSProperties,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        shape: i % 3 === 0 ? 'is-round' : i % 3 === 1 ? 'is-long' : '',
      };
    }),
  );
  return (
    <div className="celebrate confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <span key={i} className="confetti-piece" style={p.style}>
          <i className={p.shape} style={{ background: p.color }} />
        </span>
      ))}
    </div>
  );
}

export function Embers({ count = 22 }: { count?: number }) {
  const sparks = useOnce(() =>
    Array.from({ length: count }, (_, i) => ({
      '--x': `${between(18, 82)}%`,
      '--dx': `${between(-40, 40)}px`,
      '--rise': `${-between(120, 260)}px`,
      '--size': `${between(3, 7)}px`,
      '--delay': `${between(0, 500)}ms`,
      '--dur': `${between(1100, 1800)}ms`,
      background: i % 3 ? 'var(--color-glut-hot)' : 'var(--color-messing)',
    }) as CSSProperties),
  );
  return (
    <div className="celebrate embers" aria-hidden="true">
      {sparks.map((style, i) => (
        <span key={i} className="ember" style={style} />
      ))}
    </div>
  );
}

export function SootPuff({ count = 16 }: { count?: number }) {
  const puffs = useOnce(() =>
    Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 + between(-0.25, 0.25);
      const reach = between(40, 90);
      return {
        '--dx': `${Math.cos(angle) * reach}%`,
        '--dy': `${Math.sin(angle) * reach * 0.8}%`,
        '--size': `${between(45, 75)}%`,
        '--delay': `${between(0, 400)}ms`,
        '--dur': `${between(1800, 2600)}ms`,
      } as CSSProperties;
    }),
  );
  return (
    <div className="celebrate soot" aria-hidden="true">
      {puffs.map((style, i) => (
        <span key={i} className="soot-puff" style={style} />
      ))}
    </div>
  );
}
