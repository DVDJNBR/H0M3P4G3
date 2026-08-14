import { describe, expect, it } from 'vitest';
import { createRateLimiter } from './rate-limiter.js';

describe('createRateLimiter', () => {
  it('reserves freely before any failures', () => {
    const limiter = createRateLimiter();
    expect(limiter.tryReserve()).toBe(true);
  });

  it('reserves through the 4th failure', () => {
    const limiter = createRateLimiter();
    for (let i = 0; i < 4; i++) expect(limiter.tryReserve()).toBe(true);
  });

  it('the 5th reservation succeeds but arms the lockout for the next one', () => {
    const limiter = createRateLimiter();
    for (let i = 0; i < 5; i++) expect(limiter.tryReserve()).toBe(true);
    expect(limiter.tryReserve()).toBe(false);
  });

  it('stays locked out for further attempts within the window', () => {
    const limiter = createRateLimiter();
    for (let i = 0; i < 5; i++) limiter.tryReserve();
    for (let i = 0; i < 3; i++) expect(limiter.tryReserve()).toBe(false);
  });

  it('lockout lasts 60s and then clears, resetting the counter', () => {
    const limiter = createRateLimiter();
    const t0 = 1_000_000;
    for (let i = 0; i < 5; i++) limiter.tryReserve(t0);
    expect(limiter.tryReserve(t0 + 59_999)).toBe(false);
    // The lockout-clearing reservation itself counts as failure #1 of a
    // fresh window — 4 more (failures 2-5) should still succeed before
    // the *next* one (the 6th) is locked out again.
    expect(limiter.tryReserve(t0 + 60_000)).toBe(true);
    for (let i = 0; i < 3; i++) expect(limiter.tryReserve(t0 + 60_000)).toBe(true);
    expect(limiter.tryReserve(t0 + 60_000)).toBe(true);
    expect(limiter.tryReserve(t0 + 60_000)).toBe(false);
  });

  it('reset() clears an active lockout immediately', () => {
    const limiter = createRateLimiter();
    for (let i = 0; i < 5; i++) limiter.tryReserve();
    expect(limiter.tryReserve()).toBe(false);
    limiter.reset();
    expect(limiter.tryReserve()).toBe(true);
  });

  it('closes the TOCTOU window: concurrent reservations never over-admit past the cap', async () => {
    const limiter = createRateLimiter();

    // No `await` between these calls -- they're all issued in the same
    // synchronous pass, the way concurrent `POST /api/login` handlers
    // would each call tryReserve() before their first `await`. If the
    // check-and-increment weren't atomic, more than 5 of these could
    // observe "not locked out yet".
    const results = Array.from({ length: 9 }, () => limiter.tryReserve());

    expect(results.filter(Boolean)).toHaveLength(5);
    expect(results.filter((r) => !r)).toHaveLength(4);
  });
});
