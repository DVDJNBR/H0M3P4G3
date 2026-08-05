// FR-8 assumption: single global in-memory counter. This is a single-user,
// single-credential-set app -- there is no per-account identity to key on,
// and the client's IP is not cheaply/reliably available behind a reverse
// proxy without extra trust plumbing that nothing else in this story needs.
// A global counter is the simplest thing that satisfies "5 failed logins ->
// 60s lockout" (per intent-contract "Never": no persistence across
// restarts -- in-memory is correct here).
const MAX_FAILURES = 5;
const LOCKOUT_MS = 60_000;

export interface RateLimiter {
  /**
   * Atomically checks lockout state and reserves an attempt slot in a
   * single synchronous step -- the failure counter is bumped (and, if
   * this crosses the threshold, the lockout is armed) *before* the caller
   * does any async credential verification. This closes the TOCTOU window
   * a check-then-await-then-record pattern would otherwise leave open:
   * concurrent `POST /api/login` calls can no longer all observe
   * "not locked out yet" before any of them counts against the cap,
   * because nothing can run between the check and the increment.
   *
   * Returns false (caller must respond 429, no reservation made) if
   * already locked out. Returns true if the attempt may proceed; the
   * reservation optimistically counts as a failure until/unless the
   * caller reports a real success via reset().
   */
  tryReserve(now?: number): boolean;
  /** Clear all failure state -- call after a successful login. */
  reset(): void;
}

export function createRateLimiter(): RateLimiter {
  let failureCount = 0;
  let lockedUntil: number | null = null;

  function isLockedOut(now: number): boolean {
    if (lockedUntil === null) return false;
    if (now >= lockedUntil) {
      // Lockout window elapsed -- clear it so attempts can resume.
      lockedUntil = null;
      failureCount = 0;
      return false;
    }
    return true;
  }

  return {
    tryReserve(now: number = Date.now()): boolean {
      if (isLockedOut(now)) return false;
      failureCount += 1;
      if (failureCount >= MAX_FAILURES) {
        lockedUntil = now + LOCKOUT_MS;
      }
      return true;
    },
    reset(): void {
      failureCount = 0;
      lockedUntil = null;
    },
  };
}
