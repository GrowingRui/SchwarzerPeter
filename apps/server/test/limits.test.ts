import { describe, expect, it } from 'vitest';
import { LIMITS, fullAt, take, type Bucket, type Limit } from '../src/limits';

const limit: Limit = { burst: 3, refillMs: 1000 };

/** Take `n` times at the same moment; returns the last result. */
function takeMany(n: number, bucket: Bucket | undefined, now: number) {
  let result = take(bucket, limit, now);
  for (let i = 1; i < n; i++) result = take(result.bucket, limit, now);
  return result;
}

describe('room creation limits', () => {
  it('allows a burst, then refuses with the time to wait', () => {
    const three = takeMany(3, undefined, 0);
    expect(three.ok).toBe(true);
    const fourth = take(three.bucket, limit, 0);
    expect(fourth.ok).toBe(false);
    expect(fourth.retryAfterMs).toBe(1000);
    expect(take(fourth.bucket, limit, 400).retryAfterMs).toBe(600);
  });

  it('gives tokens back over time, but never more than the burst', () => {
    const empty = takeMany(3, undefined, 0).bucket;
    expect(take(empty, limit, 1000).ok).toBe(true);
    const later = takeMany(3, empty, 60_000);
    expect(later.ok).toBe(true);
    expect(take(later.bucket, limit, 60_000).ok).toBe(false);
  });

  it('knows when a bucket is full again', () => {
    const empty = takeMany(3, undefined, 500).bucket;
    expect(fullAt(empty, limit)).toBe(3500);
    expect(fullAt({ tokens: 3, at: 10 }, limit)).toBe(10);
  });

  it('lets a group of friends open several rooms in a row', () => {
    expect(LIMITS.room.burst).toBeGreaterThanOrEqual(5);
    expect(LIMITS.quick.burst).toBeGreaterThanOrEqual(LIMITS.room.burst);
  });
});
