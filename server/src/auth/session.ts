// FR-9: HMAC-signed session cookie with a 30-day sliding expiry. The
// expiry is embedded in the signed payload (not just the cookie's Max-Age
// attribute) so a copied or replayed cookie can never outlive its window
// even if a client strips or forges Max-Age -- the server is the sole
// authority on validity. SESSION_SECRET is the only key; rotating it is
// the documented (and only) way to revoke every session at once (per
// intent-contract "Never": no revocation UI).
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { CookieOptions } from 'hono/utils/cookie';

export const SESSION_COOKIE_NAME = 'h0m3p4g3_session';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export type SessionVerification =
  | { status: 'valid'; expiresAt: number }
  | { status: 'expired' }
  | { status: 'invalid' };

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

/** Mint a fresh session token, valid for SESSION_TTL_MS from `now`. */
export function createSessionCookie(secret: string, now: number = Date.now()): string {
  const expiresAt = now + SESSION_TTL_MS;
  const payload = String(expiresAt);
  return `${payload}.${sign(payload, secret)}`;
}

/**
 * Verify a raw session cookie value against `secret`. Constant-time
 * signature comparison -- tampered payloads and forged signatures are
 * indistinguishable in timing from a merely-expired token.
 */
export function verifySessionCookie(
  raw: string | undefined,
  secret: string,
  now: number = Date.now(),
): SessionVerification {
  if (!raw) return { status: 'invalid' };

  const dot = raw.lastIndexOf('.');
  if (dot < 1) return { status: 'invalid' };
  const payload = raw.slice(0, dot);
  const signature = raw.slice(dot + 1);

  const expected = sign(payload, secret);
  const signatureBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (signatureBuf.length !== expectedBuf.length || !timingSafeEqual(signatureBuf, expectedBuf)) {
    return { status: 'invalid' };
  }

  const expiresAt = Number(payload);
  if (!Number.isInteger(expiresAt)) return { status: 'invalid' };
  if (expiresAt <= now) return { status: 'expired' };
  return { status: 'valid', expiresAt };
}

/** Cookie attributes shared by every Set-Cookie for the session cookie. */
export function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  };
}
