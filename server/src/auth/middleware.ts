// FR-9, AD-4: session wall. Mounted on /api/* in index.ts *after* the login
// route, so Hono's registration-order routing resolves POST /api/login
// before this middleware ever runs -- login stays reachable pre-auth
// without a path-based carve-out here. Every other /api/* request needs a
// valid signed session cookie; on success the cookie's expiry slides
// forward by a full window on every authenticated request.
import type { MiddlewareHandler } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import {
  SESSION_COOKIE_NAME,
  createSessionCookie,
  sessionCookieOptions,
  verifySessionCookie,
} from './session';

export function createAuthMiddleware(sessionSecret: string): MiddlewareHandler {
  return async (c, next) => {
    const raw = getCookie(c, SESSION_COOKIE_NAME);
    const verification = verifySessionCookie(raw, sessionSecret);

    if (verification.status !== 'valid') {
      console.error(
        `[auth] denied ${c.req.method} ${c.req.path}: session ${verification.status}`,
      );
      return c.json(
        { error: { code: 'unauthorized', message: 'Authentication required' } },
        401,
      );
    }

    // Sliding expiry: every authenticated request mints a fresh cookie
    // good for another full 30-day window.
    setCookie(c, SESSION_COOKIE_NAME, createSessionCookie(sessionSecret), sessionCookieOptions());
    await next();
  };
}
