import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { layoutSchema } from '@h0m3p4g3/shared/schema';
import { createApp } from '../index';
import { initLayoutStore } from '../storage/layout-store';

let dataDir: string;

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
    const app = createApp({ layoutStore });

    const res = await app.request('/api/layout');
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
    const res = await createApp({ layoutStore }).request('/api/layout');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(doc);
  });

  it('maps invalid JSON to a 500 storageError envelope, logs [storage], stays alive', async () => {
    const layoutStore = await initLayoutStore(dataDir);
    const app = createApp({ layoutStore });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await writeFile(join(dataDir, 'layout.json'), '{"columns": broken', 'utf8');

    const res = await app.request('/api/layout');
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
    const again = await app.request('/api/layout');
    expect(again.status).toBe(500);
    const health = await app.request('/api/health');
    expect(health.status).toBe(200);
  });

  it('maps valid-JSON-but-schema-invalid content to a 500 storageError envelope, logs [storage], stays alive', async () => {
    const layoutStore = await initLayoutStore(dataDir);
    const app = createApp({ layoutStore });
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

    const res = await app.request('/api/layout');
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
    const again = await app.request('/api/layout');
    expect(again.status).toBe(500);
    const health = await app.request('/api/health');
    expect(health.status).toBe(200);
  });
});
