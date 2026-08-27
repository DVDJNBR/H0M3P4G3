import { Hono } from 'hono';
import { getCachedFavicon, getFallbackFavicon, sanitizeDomain } from './fetcher.js';

export function createFaviconRoutes(dataDir: string): Hono {
  const app = new Hono();

  app.get('/api/favicons/:domain', async (c) => {
    const domain = c.req.param('domain');
    const cleanDomain = sanitizeDomain(domain);

    const cached = await getCachedFavicon(dataDir, cleanDomain);
    if (cached) {
      c.header('Content-Type', cached.contentType);
      c.header('Cache-Control', 'public, max-age=86400');
      const bodyData = typeof cached.data === 'string' ? cached.data : new Uint8Array(cached.data);
      return c.body(bodyData);
    }

    // Not cached client-side (unlike the branch above): the real favicon
    // may finish its background fetch moments after this response, and a
    // long-lived cache on this same URL would pin the client to the
    // generic fallback for its whole max-age.
    const fallback = getFallbackFavicon();
    c.header('Content-Type', fallback.contentType);
    c.header('Cache-Control', 'no-store');
    return c.body(fallback.data);
  });

  return app;
}
