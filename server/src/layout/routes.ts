// FR-1 data source: GET /api/layout returns the full canonical layout
// document. PUT /api/layout validates against layoutSchema and persists
// atomically (AD-2, AD-3, AD-10).
import { Hono } from 'hono';
import { layoutSchema } from '@h0m3p4g3/shared/schema';
import { StorageError, type LayoutStore } from '../storage/layout-store.js';

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

  app.put('/api/layout', async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(
        {
          error: {
            code: 'invalidLayout',
            message: 'Request body must be valid JSON',
          },
        },
        400,
      );
    }

    const parseResult = layoutSchema.safeParse(body);
    if (!parseResult.success) {
      return c.json(
        {
          error: {
            code: 'invalidLayout',
            message: 'Layout document failed schema validation',
          },
        },
        400,
      );
    }

    try {
      await store.writeLayout(parseResult.data);
      return c.json(parseResult.data);
    } catch (err) {
      if (err instanceof StorageError) {
        console.error(`[storage] ${err.message}`, err.cause ?? '');
        return c.json(
          {
            error: {
              code: 'storageError',
              message: 'Failed to persist the layout document',
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
