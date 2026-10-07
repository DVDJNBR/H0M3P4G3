import { Hono } from 'hono';
import { readRaindropCache } from './store.js';

export function createRaindropRoutes(
  dataDir: string,
  refresh?: () => Promise<unknown>,
): Hono {
  const app = new Hono();

  // Manual poll trigger: the automatic poller only scans collections present
  // in the layout at its own fixed interval, so a block added between polls
  // (or right at boot, before the poller's first scheduled run) sits idle
  // showing stale/empty data until that interval elapses. This lets the
  // editor force an immediate re-poll instead of waiting.
  app.post('/api/raindrop-cache/refresh', async (c) => {
    if (!refresh) {
      return c.json({ error: { code: 'unavailable', message: 'Refresh not configured' } }, 503);
    }
    await refresh();
    const cache = await readRaindropCache(dataDir);
    return c.json(cache);
  });

  app.get('/api/raindrop-cache', async (c) => {
    try {
      const cache = await readRaindropCache(dataDir);
      return c.json(cache);
    } catch (err) {
      console.error('[raindrop] routes error:', err);
      return c.json(
        {
          error: {
            code: 'raindropCacheError',
            message: 'Failed to read Raindrop cache',
          },
        },
        500,
      );
    }
  });

  return app;
}
