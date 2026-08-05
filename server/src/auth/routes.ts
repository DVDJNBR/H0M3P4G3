// FR-8: POST /api/login -- password + current TOTP code, both required.
// Password is checked with bcrypt (constant-time-safe hash compare, never
// plaintext or `===`); TOTP is checked with otplib against TOTP_SECRET,
// RFC 6238, standard 30s step, with a single-step (+/-30s) drift window.
// 5 failed attempts locks out further attempts for 60s (429); success
// clears the failure counter and sets a signed, sliding-expiry session
// cookie. [auth] log prefix on every outcome.
import { compare } from 'bcryptjs';
import { Hono } from 'hono';
import { setCookie } from 'hono/cookie';
import { verify as verifyTotp } from 'otplib';
import type { RateLimiter } from './rate-limiter';
import { SESSION_COOKIE_NAME, createSessionCookie, sessionCookieOptions } from './session';

export interface LoginConfig {
  passwordHash: string;
  totpSecret: string;
  sessionSecret: string;
}

// Standard 30s TOTP step; epochTolerance: 30 accepts the previous, current,
// and next step -- the conventional "single-step drift window".
const TOTP_EPOCH_TOLERANCE_SECONDS = 30;

function errorEnvelope(code: string, message: string): { error: { code: string; message: string } } {
  return { error: { code, message } };
}

function readString(body: unknown, key: string): string {
  if (typeof body !== 'object' || body === null) return '';
  const value = (body as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : '';
}

async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  try {
    return await compare(password, passwordHash);
  } catch {
    return false;
  }
}

async function verifyTotpCode(token: string, secret: string): Promise<boolean> {
  if (token.length === 0) return false;
  try {
    const result = await verifyTotp({ secret, token, epochTolerance: TOTP_EPOCH_TOLERANCE_SECONDS });
    return result.valid;
  } catch {
    return false;
  }
}

export function createAuthRoutes(config: LoginConfig, rateLimiter: RateLimiter): Hono {
  const app = new Hono();

  app.post('/api/login', async (c) => {
    // Reserve the attempt synchronously, before any `await`: this is what
    // makes the 5-fail/60s cap race-proof under concurrent requests (see
    // RateLimiter.tryReserve doc). No verification work happens until the
    // reservation is secured.
    if (!rateLimiter.tryReserve()) {
      console.error('[auth] login rejected: rate limited');
      return c.json(errorEnvelope('rateLimited', 'Too many failed attempts. Try again later.'), 429);
    }

    let body: unknown = null;
    try {
      body = await c.req.json();
    } catch {
      body = null;
    }

    const password = readString(body, 'password');
    const totpCode = readString(body, 'totpCode');

    const [passwordValid, totpValid] = await Promise.all([
      verifyPassword(password, config.passwordHash),
      verifyTotpCode(totpCode, config.totpSecret),
    ]);

    if (!passwordValid || !totpValid) {
      // Already counted against the cap by tryReserve() above -- nothing
      // further to record.
      console.error('[auth] login rejected: invalid credentials');
      return c.json(errorEnvelope('invalidCredentials', 'Incorrect password or TOTP code.'), 401);
    }

    rateLimiter.reset();
    setCookie(c, SESSION_COOKIE_NAME, createSessionCookie(config.sessionSecret), sessionCookieOptions());
    console.log('[auth] login succeeded');
    return c.json({ status: 'ok' });
  });

  return app;
}
