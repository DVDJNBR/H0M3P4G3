import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { layoutSchema } from '@h0m3p4g3/shared/schema';
import { authCookieHeader } from '../auth/test-helpers.js';
import { createApp, type AppDeps } from '../index.js';
import { initLayoutStore } from '../storage/layout-store.js';

let dataDir: string;

// /api/layout sits behind the session wall (FR-9) — every request in this
// file needs a valid session cookie to reach the handler under test.
const authConfig: AppDeps['authConfig'] = {
  passwordHash: 'unused-in-these-tests',
  totpSecret: 'unused-in-these-tests',
  sessionSecret: 'layout-routes-test-session-secret',
};
const authHeaders = { Cookie: authCookieHeader(authConfig.sessionSecret) };

beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'h0m3p4g3-routes-'));
});

afterEach(async () => {
  await rm(dataDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe('GET /api/layout', () => {
  it('returns the seeded document as schema-valid JSON on fresh boot', async () => {
    const layoutStore = await initLayoutStore(dataDir);
    const app = createApp({ layoutStore, authConfig });

    const res = await app.request('/api/layout', { headers: authHeaders });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');

    const body = layoutSchema.parse(await res.json());
    expect(body.columns).toHaveLength(3);
    expect(body.columns.every((column) => column.blocks.length === 0)).toBe(true);
  });

  it('returns exactly the persisted document after a "restart"', async () => {
    const first = await initLayoutStore(dataDir);
    const doc = {
      columns: [
        {
          id: 'c1',
          title: 'Left',
          blocks: [
            {
              kind: 'links' as const,
              id: 'b1',
              title: 'Daily',
              links: [{ id: 'l1', title: 'Example', url: 'https://example.com' }],
            },
          ],
        },
      ],
    };
    await first.writeLayout(doc);

    // Simulate a restart: fresh store + fresh app over the same data dir.
    const layoutStore = await initLayoutStore(dataDir);
    const res = await createApp({ layoutStore, authConfig }).request('/api/layout', {
      headers: authHeaders,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(doc);
  });

  it('maps invalid JSON to a 500 storageError envelope, logs [storage], stays alive', async () => {
    const layoutStore = await initLayoutStore(dataDir);
    const app = createApp({ layoutStore, authConfig });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await writeFile(join(dataDir, 'layout.json'), '{"columns": broken', 'utf8');

    const res = await app.request('/api/layout', { headers: authHeaders });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: {
        code: 'storageError',
        message: 'Failed to load the layout document',
      },
    });
    expect(errorSpy).toHaveBeenCalled();
    expect(String(errorSpy.mock.calls[0]?.[0])).toContain('[storage]');

    // Process stays alive: subsequent requests still get responses.
    const again = await app.request('/api/layout', { headers: authHeaders });
    expect(again.status).toBe(500);
    const health = await app.request('/api/health', { headers: authHeaders });
    expect(health.status).toBe(200);
  });

  it('maps valid-JSON-but-schema-invalid content to a 500 storageError envelope, logs [storage], stays alive', async () => {
    const layoutStore = await initLayoutStore(dataDir);
    const app = createApp({ layoutStore, authConfig });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Valid JSON, but a Block with an unrecognized `kind` — fails the
    // discriminated-union schema, not JSON.parse.
    await writeFile(
      join(dataDir, 'layout.json'),
      JSON.stringify({
        columns: [
          {
            id: 'c1',
            title: 'Left',
            blocks: [{ kind: 'bogus', id: 'b1', title: 'Broken' }],
          },
        ],
      }),
      'utf8',
    );

    const res = await app.request('/api/layout', { headers: authHeaders });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: {
        code: 'storageError',
        message: 'Failed to load the layout document',
      },
    });
    expect(errorSpy).toHaveBeenCalled();
    expect(String(errorSpy.mock.calls[0]?.[0])).toContain('[storage]');

    // Process stays alive: subsequent requests still get responses.
    const again = await app.request('/api/layout', { headers: authHeaders });
    expect(again.status).toBe(500);
    const health = await app.request('/api/health', { headers: authHeaders });
    expect(health.status).toBe(200);
  });

  it('returns 401 AD-7 envelope without a session — no cookie set, no data leaked', async () => {
    const layoutStore = await initLayoutStore(dataDir);
    const app = createApp({ layoutStore, authConfig });

    const res = await app.request('/api/layout');
    expect(res.status).toBe(401);
    expect(res.headers.get('set-cookie')).toBeNull();
    expect(await res.json()).toEqual({
      error: {
        code: 'unauthorized',
        message: 'Authentication required',
      },
    });
  });
});

describe('PUT /api/layout', () => {
  it('updates the layout document and returns 200 with the canonical layout when valid', async () => {
    const layoutStore = await initLayoutStore(dataDir);
    const app = createApp({ layoutStore, authConfig });

    const newLayout = {
      columns: [
        {
          id: 'col-1',
          title: 'Main Column',
          blocks: [
            {
              kind: 'links' as const,
              id: 'b-1',
              title: 'Dev Links',
              links: [{ id: 'l-1', title: 'GitHub', url: 'https://github.com' }],
            },
          ],
        },
      ],
    };

    const res = await app.request('/api/layout', {
      method: 'PUT',
      headers: { ...authHeaders, 'content-type': 'application/json' },
      body: JSON.stringify(newLayout),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(newLayout);

    // Verify it persisted
    const readBack = await layoutStore.readLayout();
    expect(readBack).toEqual(newLayout);
  });

  it('returns 400 with invalidLayout code when layout schema validation fails', async () => {
    const layoutStore = await initLayoutStore(dataDir);
    const app = createApp({ layoutStore, authConfig });

    const invalidLayout = {
      columns: [
        {
          id: 'col-1',
          title: 'Main',
          blocks: [{ kind: 'invalid-kind', id: 'b-1' }],
        },
      ],
    };

    const res = await app.request('/api/layout', {
      method: 'PUT',
      headers: { ...authHeaders, 'content-type': 'application/json' },
      body: JSON.stringify(invalidLayout),
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: {
        code: 'invalidLayout',
        message: 'Layout document failed schema validation',
      },
    });
  });

  it('returns 401 AD-7 envelope without a session', async () => {
    const layoutStore = await initLayoutStore(dataDir);
    const app = createApp({ layoutStore, authConfig });

    const res = await app.request('/api/layout', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ columns: [] }),
    });

    expect(res.status).toBe(401);
  });
});

