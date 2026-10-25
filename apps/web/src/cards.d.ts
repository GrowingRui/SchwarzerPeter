export interface DeckCard {
  readonly key: string;
  readonly name: string;
  readonly num: number;
}

export const DECK: readonly DeckCard[];
/** SVG markup for a card face; 'peter' gives the Schwarzer Peter. */
export function render(key: string): string;
export function mountAll(root?: ParentNode): void;
