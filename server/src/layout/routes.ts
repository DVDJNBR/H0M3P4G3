// FR-1 data source: GET /api/layout returns the full canonical layout
// document. PUT /api/layout validates against layoutSchema and persists
// atomically (AD-2, AD-3, AD-10).
import { Hono } from 'hono';
import { layoutSchema, type Layout } from '@h0m3p4g3/shared/schema';
import { fetchAndStoreFavicon } from '../favicon/fetcher.js';
import { StorageError, type LayoutStore } from '../storage/layout-store.js';

// Best-effort background fetch for every link's favicon (NFR4: never blocks
// the response or fails the save -- fetchAndStoreFavicon already swallows
// its own errors and skips domains already cached).
function primeFavicons(dataDir: string, layout: Layout): void {
  for (const column of layout.columns) {
    for (const block of column.blocks) {
      if (block.kind !== 'links') continue;
      for (const link of block.links) {
        if (link.faviconOverride) continue;
        void fetchAndStoreFavicon(dataDir, link.url);
      }
    }
  }
}

export function createLayoutRoutes(store: LayoutStore, dataDir?: string): Hono {
  const app = new Hono();

  app.get('/api/layout', async (c) => {
    try {
      const layout = await store.readLayout();
      if (dataDir) primeFavicons(dataDir, layout);
      return c.json(layout);
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
      if (dataDir) primeFavicons(dataDir, parseResult.data);
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
