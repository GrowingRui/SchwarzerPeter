/**
 * Limits on how often one address may open rooms or ask for quick-match seats.
 * A token bucket: a few requests at once are fine, then one more each time a
 * token comes back. Free of any Cloudflare API so it can be tested in Node.
 */

export type LimitKind = 'room' | 'quick';

export interface Limit {
  /** How many requests may come in a row. */
  readonly burst: number;
  /** One token comes back every this many milliseconds. */
  readonly refillMs: number;
}

export const LIMITS: Record<LimitKind, Limit> = {
  // A group of friends behind one router can still open several rooms.
  room: { burst: 8, refillMs: 60_000 },
  // "Find another table" asks again, so quick match gets a bit more room.
  quick: { burst: 12, refillMs: 15_000 },
};

export interface Bucket {
  readonly tokens: number;
  readonly at: number;
}

export interface Taken {
  readonly bucket: Bucket;
  readonly ok: boolean;
  /** When refused: how long until the next request would be allowed. */
  readonly retryAfterMs: number;
}

/** Spend one token if there is one. A missing bucket is a full one. */
export function take(bucket: Bucket | undefined, limit: Limit, now: number): Taken {
  const before = bucket ? Math.min(limit.burst, bucket.tokens + Math.max(0, now - bucket.at) / limit.refillMs) : limit.burst;
  if (before >= 1) return { bucket: { tokens: before - 1, at: now }, ok: true, retryAfterMs: 0 };
  return { bucket: { tokens: before, at: now }, ok: false, retryAfterMs: Math.ceil((1 - before) * limit.refillMs) };
}

/** When a bucket is full again, so its stored state can be forgotten. */
export function fullAt(bucket: Bucket, limit: Limit): number {
  return bucket.at + Math.max(0, limit.burst - bucket.tokens) * limit.refillMs;
}
