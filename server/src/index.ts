import { pathToFileURL } from 'node:url';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { loadConfig, type Config } from './config';

// AD-7: JSON under /api/*, camelCase keys, error envelope
// { "error": { "code", "message" } } with proper HTTP status.
export function createApp(): Hono {
  const app = new Hono();

  app.get('/api/health', (c) => c.json({ status: 'ok' }));

  app.notFound((c) =>
    c.json(
      {
        error: {
          code: 'notFound',
          message: `No route for ${c.req.method} ${c.req.path}`,
        },
      },
      404,
    ),
  );

  app.onError((err, c) => {
    console.error('[server] unhandled error:', err);
    return c.json(
      {
        error: {
          code: 'internalError',
          message: 'Internal server error',
        },
      },
      500,
    );
  });

  return app;
}

function main(): void {
  let config: Config;
  try {
    config = loadConfig();
  } catch (err) {
    console.error(`[server] ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  const app = createApp();
  serve({ fetch: app.fetch, port: config.port }, (info) => {
    console.log(`[server] listening on http://localhost:${info.port}`);
  });
}

// Boot only when run directly (tsx/node), not when imported by tests.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
