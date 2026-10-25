/**
 * Seeded random numbers (mulberry32). The generator state is a single
 * 32-bit integer so it can be stored inside the serialisable game state.
 */
export class Rng {
  constructor(private s: number) {}

  /** Float in [0, 1). */
  next(): number {
    let a = (this.s = (this.s + 0x6d2b79f5) | 0);
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [0, max). */
  int(max: number): number {
    return Math.floor(this.next() * max);
  }

  /** Fisher-Yates shuffle, in place. */
  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      const tmp = items[i] as T;
      items[i] = items[j] as T;
      items[j] = tmp;
    }
    return items;
  }

  /** Opaque id that says nothing about the card it labels. */
  id(): string {
    return this.int(36 ** 6).toString(36).padStart(6, '0') + this.int(36 ** 4).toString(36).padStart(4, '0');
  }

  get state(): number {
    return this.s;
  }
}

/** Turn any integer (or a string) into a 32-bit seed. */
export function toSeed(value: number | string): number {
  if (typeof value === 'number') return value | 0;
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619);
  return h | 0;
}
