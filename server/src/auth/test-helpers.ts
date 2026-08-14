// Test-only helper. Existing and new tests that need to get past the /api/*
// session wall mint a valid session directly via createSessionCookie rather
// than going through POST /api/login (or via a bypass flag, which does not
// exist in production code -- per intent-contract, none is built).
import { SESSION_COOKIE_NAME, createSessionCookie } from './session.js';

/** A `Cookie` request header value carrying a freshly minted valid session. */
export function authCookieHeader(sessionSecret: string, now?: number): string {
  return `${SESSION_COOKIE_NAME}=${createSessionCookie(sessionSecret, now)}`;
}
