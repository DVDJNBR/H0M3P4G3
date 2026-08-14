import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRaindropRoutes } from './routes.js';
import { readRaindropCache, writeRaindropCache } from './store.js';
import { pollRaindropCollections } from './poller.js';

describe('Raindrop Module', () => {
  let dataDir: string;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'h0m3p4g3-raindrop-'));
  });

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  describe('Store', () => {
    it('returns empty object when cache file is missing', async () => {
      const cache = await readRaindropCache(dataDir);
      expect(cache).toEqual({});
    });

    it('persists and reads back cache data atomically', async () => {
      const mockCache = {
        'col-123': {
          collectionId: 'col-123',
          fetchedAt: '2026-08-07T12:00:00Z',
          items: [
            {
              id: 1,
              title: 'Test Article',
              link: 'https://example.com/article',
              domain: 'example.com',
              created: '2026-08-07T10:00:00Z',
            },
          ],
        },
      };

      await writeRaindropCache(dataDir, mockCache);
      const readBack = await readRaindropCache(dataDir);
      expect(readBack).toEqual(mockCache);
    });
  });

  describe('Routes', () => {
    it('GET /api/raindrop-cache returns cached items', async () => {
      const mockCache = {
        'col-1': {
          collectionId: 'col-1',
          fetchedAt: '2026-08-07T12:00:00Z',
          items: [],
        },
      };
      await writeRaindropCache(dataDir, mockCache);

      const app = createRaindropRoutes(dataDir);
      const res = await app.request('/api/raindrop-cache');
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(mockCache);
    });
  });

  describe('Poller', () => {
    it('handles network failure gracefully without throwing (NFR4)', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await pollRaindropCollections(dataDir, ['col-1'], 'test-token');
      expect(result).toEqual({});
    });
  });
});
