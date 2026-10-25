import { memo, useMemo } from 'react';
import { DECK, render } from '../cards.js';
import { PETER, type Card } from '@sp/engine';

const NAMES = new Map(DECK.map((c) => [c.key, c.name]));

export const cardName = (face: string) => (face === PETER ? 'Schwarzer Peter' : NAMES.get(face) ?? face);

/** Card art as an SVG string, for elements created outside React (flying cards). */
export const faceMarkup = (face: string) => render(face);

export const CardFace = memo(function CardFace({ card, className = '' }: { card: Card; className?: string }) {
  // render() gives every SVG its own gradient ids, so render once per card.
  const html = useMemo(() => render(card.face), [card.face]);
  return (
    <span
      className={`play-card play-card-face ${card.face === PETER ? 'is-peter' : ''} ${className}`}
      data-card-id={card.id}
      role="img"
      aria-label={cardName(card.face)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});

export function CardBack({ className = '' }: { className?: string }) {
  return <span className={`play-card play-card-back ${className}`} aria-hidden="true" />;
}
