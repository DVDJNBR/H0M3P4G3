import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, type AppDeps } from '../index.js';
import { initLayoutStore } from '../storage/layout-store.js';
import { authCookieHeader } from '../auth/test-helpers.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const authConfig: AppDeps['authConfig'] = {
  passwordHash: 'unused-in-these-tests',
  totpSecret: 'unused-in-these-tests',
  sessionSecret: 'link-status-test-session-secret',
};
const authHeaders = { Cookie: authCookieHeader(authConfig.sessionSecret) };

async function buildApp() {
  const dataDir = await mkdtemp(join(tmpdir(), 'h0m3p4g3-link-status-'));
  const layoutStore = await initLayoutStore(dataDir);
  return { app: createApp({ layoutStore, authConfig }), dataDir };
}

describe('GET /api/link-status', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns up for a 2xx response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ status: 200 } as Response),
    );
    const { app, dataDir } = await buildApp();
    const res = await app.request('/api/link-status?url=https://example.com', {
      headers: authHeaders,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'up' });
    await rm(dataDir, { recursive: true, force: true });
  });

  it('returns degraded for a 4xx response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ status: 404 } as Response),
    );
    const { app, dataDir } = await buildApp();
    const res = await app.request('/api/link-status?url=https://example.com', {
      headers: authHeaders,
    });
    expect(await res.json()).toEqual({ status: 'degraded' });
    await rm(dataDir, { recursive: true, force: true });
  });

  it('returns down for a 5xx response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ status: 503 } as Response),
    );
    const { app, dataDir } = await buildApp();
    const res = await app.request('/api/link-status?url=https://example.com', {
      headers: authHeaders,
    });
    expect(await res.json()).toEqual({ status: 'down' });
    await rm(dataDir, { recursive: true, force: true });
  });

  it('returns down without throwing when the fetch itself fails (NFR4)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network unreachable')),
    );
    const { app, dataDir } = await buildApp();
    const res = await app.request('/api/link-status?url=https://example.com', {
      headers: authHeaders,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'down' });
    await rm(dataDir, { recursive: true, force: true });
  });

  it('rejects a non-http(s) URL', async () => {
    const { app, dataDir } = await buildApp();
    const res = await app.request('/api/link-status?url=javascript:alert(1)', {
      headers: authHeaders,
    });
    expect(res.status).toBe(400);
    expect((await res.json()) as { error: { code: string } }).toMatchObject({
      error: { code: 'invalidUrl' },
    });
    await rm(dataDir, { recursive: true, force: true });
  });

  it('rejects a missing url query parameter', async () => {
    const { app, dataDir } = await buildApp();
    const res = await app.request('/api/link-status', { headers: authHeaders });
    expect(res.status).toBe(400);
    await rm(dataDir, { recursive: true, force: true });
  });

  it('returns 401 without a session', async () => {
    const { app, dataDir } = await buildApp();
    const res = await app.request('/api/link-status?url=https://example.com');
    expect(res.status).toBe(401);
    await rm(dataDir, { recursive: true, force: true });
  });
});
