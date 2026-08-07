import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { createAuthMiddleware } from './auth/middleware';
import { createRateLimiter, type RateLimiter } from './auth/rate-limiter';
import { createAuthRoutes, type LoginConfig } from './auth/routes';
import { loadConfig, type Config } from './config';
import { createFaviconRoutes } from './favicon/routes';
import { createLayoutRoutes } from './layout/routes';
import { createRaindropRoutes } from './raindrop/routes';
import { startRaindropPoller } from './raindrop/poller';
import { initLayoutStore, type LayoutStore } from './storage/layout-store';

export interface AppDeps {
  layoutStore: LayoutStore;
  authConfig: LoginConfig;
  rateLimiter?: RateLimiter;
  staticDir?: string;
  dataDir?: string;
}

// AD-7: JSON under /api/*, camelCase keys, error envelope
// { "error": { "code", "message" } } with proper HTTP status.
export function createApp(deps: AppDeps): Hono {
  const app = new Hono();
  const rateLimiter = deps.rateLimiter ?? createRateLimiter();

  // FR-8: login must be reachable pre-auth. Mounting it before the /api/*
  // session wall below means Hono's registration-order routing resolves
  // POST /api/login here, never reaching the middleware.
  app.route('/', createAuthRoutes(deps.authConfig, rateLimiter));

  // Same carve-out as login, same reason: /api/health is the unauthenticated
  // container/reverse-proxy health check story 1.5 needs (Docker
  // HEALTHCHECK, Caddy upstream health) and leaks no sensitive data.
  // Registering it before the wall below is what exempts it -- every
  // route registered *after* the middleware stays walled.
  app.get('/api/health', (c) => c.json({ status: 'ok' }));

  // Favicons served same-origin (AD-8) without requiring session cookies for <img> tags
  if (deps.dataDir) {
    app.route('/', createFaviconRoutes(deps.dataDir));
  }

  // FR-9, AD-4: every remaining /api/* route is walled behind a valid
  // session.
  app.use('/api/*', createAuthMiddleware(deps.authConfig.sessionSecret));

  app.route('/', createLayoutRoutes(deps.layoutStore));

  if (deps.dataDir) {
    app.route('/', createRaindropRoutes(deps.dataDir));
  }

  // AD-1: Single process serving both static bundle and API routes.
  // Serve SPA static assets from staticDir (web/dist) if present.
  const targetStaticDir = deps.staticDir ?? path.resolve(process.cwd(), 'web/dist');
  if (fs.existsSync(targetStaticDir)) {
    const relStaticDir = path.relative(process.cwd(), targetStaticDir) || '.';
    app.use('*', async (c, next) => {
      if (c.req.path.startsWith('/api/')) {
        return next();
      }
      return serveStatic({ root: relStaticDir })(c, next);
    });
    app.get('*', async (c, next) => {
      if (c.req.path.startsWith('/api/')) {
        return next();
      }
      return serveStatic({ path: path.join(relStaticDir, 'index.html') })(c, next);
    });
  }

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

async function main(): Promise<void> {
  let config: Config;
  try {
    config = loadConfig();
  } catch (err) {
    console.error(`[server] ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  const layoutStore = await initLayoutStore(config.dataDir);

  startRaindropPoller(
    config.dataDir,
    async () => {
      try {
        const layout = await layoutStore.readLayout();
        const ids: string[] = [];
        layout.columns.forEach((col) => {
          col.blocks.forEach((b) => {
            if (b.kind === 'raindrop' && b.collectionId) {
              ids.push(b.collectionId);
            }
          });
        });
        return ids;
      } catch {
        return [];
      }
    },
    config.raindropToken,
  );

  const app = createApp({
    layoutStore,
    dataDir: config.dataDir,
    authConfig: {
      passwordHash: config.passwordHash,
      totpSecret: config.totpSecret,
      sessionSecret: config.sessionSecret,
    },
  });
  serve({ fetch: app.fetch, port: config.port }, (info) => {
    console.log(`[server] listening on http://localhost:${info.port}`);
  });
}

// Boot only when run directly (tsx/node), not when imported by tests.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(`[server] fatal boot error:`, err);
    process.exit(1);
  });
}
