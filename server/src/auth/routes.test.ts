import { hashSync } from 'bcryptjs';
import { Hono } from 'hono';
import { generate } from 'otplib';
import { describe, expect, it, vi } from 'vitest';
import { createRateLimiter, type RateLimiter } from './rate-limiter';
import { createAuthRoutes, type LoginConfig } from './routes';
import { SESSION_COOKIE_NAME } from './session';

const PASSWORD = 'correct-horse-battery-staple';
// Same generation rule as .env.example's dev secret: Base32, >=16 bytes
// decoded (otplib v13's minimum secret length guardrail).
const TOTP_SECRET = '2VUUIZYIXPJELMXFIZJZ4Y767RFCUB5H';

const config: LoginConfig = {
  // Low round count keeps the test suite fast; correctness of bcrypt
  // itself is not what's under test here.
  passwordHash: hashSync(PASSWORD, 4),
  totpSecret: TOTP_SECRET,
  sessionSecret: 'routes-test-session-secret',
};

function buildApp(rateLimiter: RateLimiter = createRateLimiter()): { app: Hono; rateLimiter: RateLimiter } {
  const app = new Hono();
  app.route('/', createAuthRoutes(config, rateLimiter));
  return { app, rateLimiter };
}

function currentTotp(): Promise<string> {
  return generate({ secret: TOTP_SECRET });
}

async function postLogin(app: Hono, body: unknown): Promise<Response> {
  return app.request('/api/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/login', () => {
  it('given correct password + valid current TOTP, returns 200 with a signed session cookie', async () => {
    const { app } = buildApp();
    const totpCode = await currentTotp();

    const res = await postLogin(app, { password: PASSWORD, totpCode });

    expect(res.status).toBe(200);
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Secure');
    expect(setCookie).toContain('SameSite=Lax');
  });

  it('given a wrong password (correct TOTP), returns 401 AD-7 with no cookie', async () => {
    const { app } = buildApp();
    const totpCode = await currentTotp();

    const res = await postLogin(app, { password: 'wrong-password', totpCode });

    expect(res.status).toBe(401);
    expect(res.headers.get('set-cookie')).toBeNull();
    expect(await res.json()).toEqual({
      error: { code: 'invalidCredentials', message: 'Incorrect password or TOTP code.' },
    });
  });

  it('given an invalid/expired TOTP (correct password), returns 401 AD-7 with no cookie', async () => {
    const { app } = buildApp();

    const res = await postLogin(app, { password: PASSWORD, totpCode: '000000' });

    expect(res.status).toBe(401);
    expect(res.headers.get('set-cookie')).toBeNull();
    expect(await res.json()).toEqual({
      error: { code: 'invalidCredentials', message: 'Incorrect password or TOTP code.' },
    });
  });

  it('logs failed attempts with the [auth] prefix', async () => {
    const { app } = buildApp();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await postLogin(app, { password: 'wrong', totpCode: '000000' });

    expect(errorSpy).toHaveBeenCalled();
    expect(String(errorSpy.mock.calls[0]?.[0])).toContain('[auth]');
  });

  it('given 5 failed logins, a 6th attempt within 60s returns 429 AD-7 — even with correct credentials', async () => {
    const { app } = buildApp();

    for (let i = 0; i < 5; i++) {
      const res = await postLogin(app, { password: 'wrong', totpCode: '000000' });
      expect(res.status).toBe(401);
    }

    const totpCode = await currentTotp();
    const sixth = await postLogin(app, { password: PASSWORD, totpCode });

    expect(sixth.status).toBe(429);
    expect(sixth.headers.get('set-cookie')).toBeNull();
    expect(await sixth.json()).toEqual({
      error: { code: 'rateLimited', message: 'Too many failed attempts. Try again later.' },
    });
  });

  it('a successful login clears the failure counter', async () => {
    const { app } = buildApp();

    for (let i = 0; i < 4; i++) {
      await postLogin(app, { password: 'wrong', totpCode: '000000' });
    }

    const totpCode = await currentTotp();
    const success = await postLogin(app, { password: PASSWORD, totpCode });
    expect(success.status).toBe(200);

    // Counter was reset by the success — a single subsequent failure
    // should not trigger the lockout that a 5th consecutive one would.
    const totpForNextLogin = await currentTotp();
    const afterOneMoreFailure = await postLogin(app, { password: 'wrong', totpCode: '000000' });
    expect(afterOneMoreFailure.status).toBe(401);
    const stillWorks = await postLogin(app, { password: PASSWORD, totpCode: totpForNextLogin });
    expect(stillWorks.status).toBe(200);
  });

  it('treats a malformed JSON body as a failed attempt (401), not a crash', async () => {
    const { app } = buildApp();
    const res = await app.request('/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not json',
    });
    expect(res.status).toBe(401);
  });

  it('enforces the 5-attempt cap under truly concurrent requests (no TOCTOU race)', async () => {
    const { app } = buildApp();

    // Fired together via Promise.all, not awaited one at a time — this is
    // what the naive "check isLockedOut(), await verification, then
    // recordFailure()" pattern got wrong: concurrent requests could all
    // observe "not locked out" before any of them counted against the
    // cap. tryReserve() reserves synchronously before any await, so the
    // cap holds regardless of how many requests land at once.
    const responses = await Promise.all(
      Array.from({ length: 9 }, () => postLogin(app, { password: 'wrong', totpCode: '000000' })),
    );

    const invalidCredentials = responses.filter((res) => res.status === 401);
    const rateLimited = responses.filter((res) => res.status === 429);

    expect(invalidCredentials).toHaveLength(5);
    expect(rateLimited).toHaveLength(4);
  });
});
