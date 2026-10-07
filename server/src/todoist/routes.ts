import { Hono } from 'hono';
import { readTodoistCache } from './store.js';

export function createTodoistRoutes(
  dataDir: string,
  refresh?: () => Promise<unknown>,
): Hono {
  const app = new Hono();

  app.post('/api/todoist-cache/refresh', async (c) => {
    if (!refresh) {
      return c.json({ error: { code: 'unavailable', message: 'Refresh not configured' } }, 503);
    }
    await refresh();
    const cache = await readTodoistCache(dataDir);
    return c.json(cache ?? { tasks: [], fetchedAt: null });
  });

  app.get('/api/todoist-cache', async (c) => {
    try {
      const cache = await readTodoistCache(dataDir);
      return c.json(cache ?? { tasks: [], fetchedAt: null });
    } catch (err) {
      console.error('[todoist] routes error:', err);
      return c.json(
        {
          error: {
            code: 'todoistCacheError',
            message: 'Failed to read Todoist cache',
          },
        },
        500,
      );
    }
  });

  return app;
}
