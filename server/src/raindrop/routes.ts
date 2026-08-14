import { Hono } from 'hono';
import { readRaindropCache } from './store.js';

export function createRaindropRoutes(dataDir: string): Hono {
  const app = new Hono();

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
