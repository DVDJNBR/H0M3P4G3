import { mkdir, readFile, writeFile, unlink, stat } from 'node:fs/promises';
import { join } from 'node:path';

const FAVICON_EXTENSIONS = [
  { ext: '.ico', type: 'image/x-icon' },
  { ext: '.png', type: 'image/png' },
  { ext: '.jpg', type: 'image/jpeg' },
  { ext: '.svg', type: 'image/svg+xml' },
];

const NEUTRAL_FALLBACK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`;

// A site's favicon rarely changes, but "rarely" isn't "never" -- without a
// TTL, fetchAndStoreFavicon's cache check below would skip every domain
// forever after its first successful fetch, so a real icon change would
// never reach the app. A week balances staying current against refetching
// every domain on every page load.
const FAVICON_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function sanitizeDomain(input: string): string {
  try {
    const parsed = new URL(input.startsWith('http') ? input : `https://${input}`);
    return parsed.hostname.toLowerCase().replace(/[^a-z0-9.-]/g, '');
  } catch {
    return input.toLowerCase().replace(/[^a-z0-9.-]/g, '');
  }
}

export function getFaviconsDir(dataDir: string): string {
  return join(dataDir, 'favicons');
}

export async function ensureFaviconsDir(dataDir: string): Promise<string> {
  const dir = getFaviconsDir(dataDir);
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function getCachedFavicon(
  dataDir: string,
  domain: string,
): Promise<{ data: Buffer | string; contentType: string; cachedAt: Date } | null> {
  const cleanDomain = sanitizeDomain(domain);
  if (!cleanDomain) return null;

  const dir = getFaviconsDir(dataDir);

  for (const { ext, type } of FAVICON_EXTENSIONS) {
    const file = join(dir, `${cleanDomain}${ext}`);
    try {
      const s = await stat(file);
      if (s.isFile()) {
        const data = await readFile(file);
        return { data, contentType: type, cachedAt: s.mtime };
      }
    } catch {
      // Ignore missing files
    }
  }

  return null;
}

export async function fetchAndStoreFavicon(
  dataDir: string,
  targetUrl: string,
): Promise<string | null> {
  const cleanDomain = sanitizeDomain(targetUrl);
  if (!cleanDomain) return null;

  const dir = await ensureFaviconsDir(dataDir);
  const cached = await getCachedFavicon(dataDir, cleanDomain);
  const cacheAge = cached ? Date.now() - cached.cachedAt.getTime() : null;
  if (cacheAge !== null && cacheAge < FAVICON_CACHE_TTL_MS) {
    return cleanDomain;
  }

  const iconUrl = `https://${cleanDomain}/favicon.ico`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(iconUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; H0M3P4G3-FaviconFetcher/1.0)',
      },
    });

    clearTimeout(timeout);

    if (response.ok) {
      const contentType = response.headers.get('content-type') || '';
      const buffer = Buffer.from(await response.arrayBuffer());

      if (buffer.length > 0) {
        const ext = contentType.includes('png') ? '.png' : '.ico';
        const targetPath = join(dir, `${cleanDomain}${ext}`);
        await writeFile(targetPath, buffer);

        // A refresh can land under a different extension than last time
        // (e.g. .ico -> .png) -- without this, the old file would keep
        // shadowing the new one, since getCachedFavicon returns the first
        // extension it finds on disk.
        for (const { ext: otherExt } of FAVICON_EXTENSIONS) {
          if (otherExt === ext) continue;
          await unlink(join(dir, `${cleanDomain}${otherExt}`)).catch(() => {});
        }

        console.log(`[favicon] cached ${cleanDomain} (${buffer.length} bytes)`);
        return cleanDomain;
      }
    }
  } catch (err) {
    // NFR4: Favicon fetch failure never blocks link creation or crashes
    console.log(`[favicon] fetch failed for ${cleanDomain}: ${err instanceof Error ? err.message : String(err)}`);
  }

  return null;
}

export function getFallbackFavicon(): { data: string; contentType: string } {
  return {
    data: NEUTRAL_FALLBACK_SVG,
    contentType: 'image/svg+xml',
  };
}
