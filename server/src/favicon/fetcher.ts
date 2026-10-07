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

const FETCH_TIMEOUT_MS = 3000;
const FAVICON_USER_AGENT = 'Mozilla/5.0 (compatible; H0M3P4G3-FaviconFetcher/1.0)';

function extForContentType(contentType: string): string {
  if (contentType.includes('png')) return '.png';
  if (contentType.includes('svg')) return '.svg';
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return '.jpg';
  return '.ico';
}

// Downloads one candidate icon URL and, on success, caches it and removes
// any stale sibling file under a different extension (e.g. a refresh that
// lands as .png after the old cache was .ico) -- otherwise getCachedFavicon
// would keep returning whichever extension it checks first on disk.
async function downloadAndCache(dir: string, cleanDomain: string, iconUrl: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(iconUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': FAVICON_USER_AGENT },
    });

    clearTimeout(timeout);
    if (!response.ok) return false;

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0) return false;

    const ext = extForContentType(response.headers.get('content-type') || '');
    await writeFile(join(dir, `${cleanDomain}${ext}`), buffer);

    for (const { ext: otherExt } of FAVICON_EXTENSIONS) {
      if (otherExt === ext) continue;
      await unlink(join(dir, `${cleanDomain}${otherExt}`)).catch(() => {});
    }

    console.log(`[favicon] cached ${cleanDomain} (${buffer.length} bytes) from ${iconUrl}`);
    return true;
  } catch {
    return false;
  }
}

// Not every site serves an icon at the conventional root path (Supabase's
// real favicon lives at /favicon/favicon.ico, for example) -- this reads
// the page's own <link rel="icon"> declaration as a fallback. rel values
// are matched loosely ("shortcut icon", "icon", "apple-touch-icon", ...)
// since sites vary, and a plain regex is enough here (no DOM parser dep).
function extractIconHref(html: string): string | null {
  const candidates: { rel: string; href: string }[] = [];
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = tag.match(/\brel=["']([^"']+)["']/i)?.[1]?.toLowerCase();
    const href = tag.match(/\bhref=["']([^"']+)["']/i)?.[1];
    if (rel && href && rel.includes('icon')) candidates.push({ rel, href });
  }

  const priority = ['icon', 'shortcut icon', 'apple-touch-icon'];
  for (const rel of priority) {
    const found = candidates.find((c) => c.rel === rel);
    if (found) return found.href;
  }
  return candidates[0]?.href ?? null;
}

async function discoverIconUrl(domain: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(`https://${domain}/`, {
      signal: controller.signal,
      headers: { 'User-Agent': FAVICON_USER_AGENT },
    });

    clearTimeout(timeout);
    if (!response.ok) return null;

    const href = extractIconHref(await response.text());
    return href ? new URL(href, `https://${domain}/`).toString() : null;
  } catch {
    return null;
  }
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

  if (await downloadAndCache(dir, cleanDomain, `https://${cleanDomain}/favicon.ico`)) {
    return cleanDomain;
  }

  const discoveredUrl = await discoverIconUrl(cleanDomain);
  if (discoveredUrl && (await downloadAndCache(dir, cleanDomain, discoveredUrl))) {
    return cleanDomain;
  }

  console.log(`[favicon] no icon found for ${cleanDomain}`);
  return null;
}

export function getFallbackFavicon(): { data: string; contentType: string } {
  return {
    data: NEUTRAL_FALLBACK_SVG,
    contentType: 'image/svg+xml',
  };
}
