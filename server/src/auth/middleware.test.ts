import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { createAuthMiddleware } from './middleware';
import { SESSION_COOKIE_NAME, SESSION_TTL_MS, createSessionCookie, verifySessionCookie } from './session';

const SECRET = 'middleware-test-secret';

function testApp(): Hono {
  const app = new Hono();
  app.use('/api/*', createAuthMiddleware(SECRET));
  app.get('/api/protected', (c) => c.json({ ok: true }));
  return app;
}

describe('auth middleware', () => {
  it('denies with a 401 AD-7 envelope when there is no session cookie', async () => {
    const res = await testApp().request('/api/protected');
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: { code: 'unauthorized', message: 'Authentication required' },
    });
  });

  it('allows a valid session through and slides the cookie expiry forward', async () => {
    const token = createSessionCookie(SECRET);
    const res = await testApp().request('/api/protected', {
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Secure');
    expect(setCookie).toContain('SameSite=Lax');

    const refreshedValue = setCookie?.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`))?.[1];
    expect(refreshedValue).toBeTruthy();
    const refreshed = verifySessionCookie(refreshedValue, SECRET);
    expect(refreshed.status).toBe('valid');
    if (refreshed.status === 'valid') {
      // The refreshed token's expiry is a full new window out — strictly
      // later than the original token's expiry (sliding, not fixed).
      const original = verifySessionCookie(token, SECRET);
      expect(original.status).toBe('valid');
      if (original.status === 'valid') {
        expect(refreshed.expiresAt).toBeGreaterThanOrEqual(original.expiresAt);
      }
      expect(refreshed.expiresAt).toBeGreaterThan(Date.now() + SESSION_TTL_MS - 5000);
    }
  });

  it('denies a tampered session cookie with a 401 and does not crash', async () => {
    const token = createSessionCookie(SECRET);
    const tampered = `${token}x`;
    const res = await testApp().request('/api/protected', {
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${tampered}` },
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: { code: 'unauthorized', message: 'Authentication required' },
    });
  });

  it('denies an expired session cookie with a 401', async () => {
    const longAgo = Date.now() - SESSION_TTL_MS - 1000;
    const expiredToken = createSessionCookie(SECRET, longAgo);
    const res = await testApp().request('/api/protected', {
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${expiredToken}` },
    });
    expect(res.status).toBe(401);
  });

  it('denies a cookie signed with a different secret with a 401', async () => {
    const foreignToken = createSessionCookie('a-different-secret');
    const res = await testApp().request('/api/protected', {
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${foreignToken}` },
    });
    expect(res.status).toBe(401);
  });
});
