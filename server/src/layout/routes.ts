// FR-1 data source: GET /api/layout returns the full canonical layout
// document. Storage failures map to the AD-7 error envelope with code
// `storageError` and a `[storage]` log line — the process stays alive.
import { Hono } from 'hono';
import { StorageError, type LayoutStore } from '../storage/layout-store';

export function createLayoutRoutes(store: LayoutStore): Hono {
  const app = new Hono();

  app.get('/api/layout', async (c) => {
    try {
      return c.json(await store.readLayout());
    } catch (err) {
      if (err instanceof StorageError) {
        console.error(`[storage] ${err.message}`, err.cause ?? '');
        return c.json(
          {
            error: {
              code: 'storageError',
              message: 'Failed to load the layout document',
            },
          },
          500,
        );
      }
      throw err;
    }
  });

  return app;
}
