// A link's status dot needs the *real* HTTP status of an arbitrary
// third-party origin. A browser-side fetch can't see that for most sites
// (opaque cross-origin responses under CORS never expose .status), so the
// server does the probe on the client's behalf. This route sits behind the
// /api/* session wall (AD-4) -- it's not a public open proxy.
import { Hono } from 'hono';

const REQUEST_TIMEOUT_MS = 5000;

export type LinkStatusBucket = 'up' | 'degraded' | 'down';

function bucketForStatus(httpStatus: number): LinkStatusBucket {
  if (httpStatus >= 200 && httpStatus < 300) return 'up';
  if (httpStatus >= 500) return 'down';
  return 'degraded';
}

export async function checkLinkStatus(targetUrl: string): Promise<LinkStatusBucket> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(targetUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; H0M3P4G3-LinkStatus/1.0)' },
    });
    return bucketForStatus(res.status);
  } catch {
    return 'down';
  } finally {
    clearTimeout(timeout);
  }
}

export function createLinkStatusRoutes(): Hono {
  const app = new Hono();

  app.get('/api/link-status', async (c) => {
    const rawUrl = c.req.query('url');
    if (!rawUrl) {
      return c.json(
        { error: { code: 'invalidUrl', message: 'Missing url query parameter' } },
        400,
      );
    }

    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return c.json({ error: { code: 'invalidUrl', message: 'Malformed URL' } }, 400);
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return c.json({ error: { code: 'invalidUrl', message: 'Only http(s) URLs are checked' } }, 400);
    }

    const status = await checkLinkStatus(parsed.toString());
    return c.json({ status });
  });

  return app;
}
