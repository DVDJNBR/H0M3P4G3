import { hashSync } from 'bcryptjs';
import { generate } from 'otplib';
import { describe, expect, it } from 'vitest';
import { authCookieHeader } from './auth/test-helpers.js';
import { createApp, type AppDeps } from './index.js';
import type { LayoutStore } from './storage/layout-store.js';

// In-memory stub — these tests exercise health/404/500 behavior only; the
// real store is covered in storage/ and layout/ tests.
function stubStore(): LayoutStore {
  return {
    readLayout: async () => ({ columns: [] }),
    writeLayout: async () => undefined,
  };
}

// Real credentials (not just placeholder strings) so this file can also
// drive POST /api/login end-to-end, not just mint sessions directly.
const LOGIN_PASSWORD = 'index-test-password';
// Base32, decodes to 20 bytes — clears otplib v13's 16-byte minimum.
const TOTP_SECRET = '2VUUIZYIXPJELMXFIZJZ4Y767RFCUB5H';

// Every /api/* route except POST /api/login and GET /api/health is walled
// behind a valid session (FR-9) — most tests below need one to reach
// anything past the wall.
const authConfig: AppDeps['authConfig'] = {
  passwordHash: hashSync(LOGIN_PASSWORD, 4),
  totpSecret: TOTP_SECRET,
  sessionSecret: 'index-test-session-secret',
};
const authHeaders = { Cookie: authCookieHeader(authConfig.sessionSecret) };

function testApp(): ReturnType<typeof createApp> {
  return createApp({ layoutStore: stubStore(), authConfig });
}

describe('GET /api/health', () => {
  it('returns 200 with camelCase {"status":"ok"} without a session — infra health checks stay unauthenticated', async () => {
    const res = await testApp().request('/api/health');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('also returns 200 when a session cookie happens to be present', async () => {
    const res = await testApp().request('/api/health', { headers: authHeaders });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });
});

describe('unhandled route error', () => {
  it('returns 500 with the AD-7 envelope and no leaked internals', async () => {
    const app = testApp();
    app.get('/api/boom', () => {
      throw new Error('secret internal detail');
    });
    const res = await app.request('/api/boom', { headers: authHeaders });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: {
        code: 'internalError',
        message: 'Internal server error',
      },
    });
  });
});

describe('unknown API route', () => {
  it('returns 404 with the AD-7 error envelope given a valid session', async () => {
    const res = await testApp().request('/api/nope', { headers: authHeaders });
    expect(res.status).toBe(404);
    const body = (await res.json()) as {
      error: { code: string; message: string };
    };
    expect(body.error.code).toBe('notFound');
    expect(typeof body.error.message).toBe('string');
    expect(body.error.message.length).toBeGreaterThan(0);
  });

  it('returns 401 (not 404) without a session — the wall runs first', async () => {
    const res = await testApp().request('/api/nope');
    expect(res.status).toBe(401);
  });
});

// This is the one test that exercises the *actual* wiring main() produces
// end-to-end: login mounted, then the /api/* wall, then the protected
// routes — as a single real createApp() assembly, not the login route or
// the middleware tested in isolation against a synthetic app. A
// registration-order regression (e.g. the wall accidentally mounted before
// login) would pass every other test file while making login completely
// unreachable; only an assembly-level test like this one catches that.
describe('full app wiring: POST /api/login unlocks the /api/* wall', () => {
  it('login succeeds with no prior session, and its cookie is accepted by a protected route', async () => {
    const app = testApp();

    // No cookie sent — login itself must be reachable pre-auth.
    const totpCode = await generate({ secret: TOTP_SECRET });
    const loginRes = await app.request('/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: LOGIN_PASSWORD, totpCode }),
    });
    expect(loginRes.status).toBe(200);
    const setCookie = loginRes.headers.get('set-cookie');
    expect(setCookie).toBeTruthy();

    // Use exactly the cookie the server handed back, not one minted by a
    // test helper, so this proves the real login-issued cookie works.
    const cookieValue = setCookie?.split(';')[0];
    const protectedRes = await app.request('/api/layout', {
      headers: { Cookie: cookieValue ?? '' },
    });
    expect(protectedRes.status).toBe(200);
  });

  it('the same fully-wired app still rejects the protected route with no session', async () => {
    const res = await testApp().request('/api/layout');
    expect(res.status).toBe(401);
  });
});
