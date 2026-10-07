import { mkdtemp, rm, writeFile, mkdir, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createFaviconRoutes } from './routes.js';
import { sanitizeDomain, fetchAndStoreFavicon, getCachedFavicon } from './fetcher.js';

describe('Favicon Module', () => {
  let dataDir: string;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'h0m3p4g3-favicons-'));
  });

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  describe('sanitizeDomain', () => {
    it('extracts and cleans domain names', () => {
      expect(sanitizeDomain('https://github.com/foo/bar')).toBe('github.com');
      expect(sanitizeDomain('EXAMPLE.COM')).toBe('example.com');
      expect(sanitizeDomain('http://sub.domain.org/path')).toBe('sub.domain.org');
    });
  });

  describe('routes & cached favicons', () => {
    it('returns SVG fallback for uncached domains', async () => {
      const app = createFaviconRoutes(dataDir);
      const res = await app.request('/api/favicons/uncached-domain.com');

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('image/svg+xml');
      const text = await res.text();
      expect(text).toContain('<svg');
    });

    it('serves cached favicon when available on disk', async () => {
      const favDir = join(dataDir, 'favicons');
      await mkdir(favDir, { recursive: true });

      const fakeIcoData = Buffer.from([0, 0, 1, 0]);
      await writeFile(join(favDir, 'github.com.ico'), fakeIcoData);

      const app = createFaviconRoutes(dataDir);
      const res = await app.request('/api/favicons/github.com');

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('image/x-icon');
      const buffer = Buffer.from(await res.arrayBuffer());
      expect(buffer).toEqual(fakeIcoData);
    });
  });

  describe('fetchAndStoreFavicon', () => {
    it('never throws on network failures or timeouts (NFR4)', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await fetchAndStoreFavicon(dataDir, 'https://broken-domain.invalid');
      expect(result).toBeNull();
    });

    it('skips a fresh cached favicon without fetching', async () => {
      const favDir = join(dataDir, 'favicons');
      await mkdir(favDir, { recursive: true });
      await writeFile(join(favDir, 'fresh-domain.com.ico'), Buffer.from([0, 0]));

      const fetchMock = vi.fn();
      globalThis.fetch = fetchMock;

      await fetchAndStoreFavicon(dataDir, 'https://fresh-domain.com');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('re-fetches a stale cached favicon (the refresh bug)', async () => {
      const favDir = join(dataDir, 'favicons');
      await mkdir(favDir, { recursive: true });
      const staleFile = join(favDir, 'stale-domain.com.ico');
      await writeFile(staleFile, Buffer.from([0, 0]));
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      await utimes(staleFile, eightDaysAgo, eightDaysAgo);

      const newIcon = Buffer.from([1, 2, 3, 4]);
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'image/x-icon' }),
        arrayBuffer: async () => newIcon.buffer.slice(newIcon.byteOffset, newIcon.byteOffset + newIcon.byteLength),
      });

      await fetchAndStoreFavicon(dataDir, 'https://stale-domain.com');

      const cached = await getCachedFavicon(dataDir, 'stale-domain.com');
      expect(Buffer.from(cached!.data as Buffer)).toEqual(newIcon);
    });

    it('falls back to the page\'s <link rel="icon"> when /favicon.ico 404s (Supabase/Ornikar case)', async () => {
      const iconBytes = Buffer.from([7, 7, 7]);
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.endsWith('/favicon.ico')) {
          return { ok: false, headers: new Headers(), arrayBuffer: async () => new ArrayBuffer(0) };
        }
        if (url === 'https://no-root-favicon.com/') {
          return {
            ok: true,
            text: async () =>
              '<html><head><link rel="shortcut icon" href="/old.ico"/><link rel="icon" href="/assets/icon.png" type="image/png"/></head></html>',
          };
        }
        if (url === 'https://no-root-favicon.com/assets/icon.png') {
          return {
            ok: true,
            headers: new Headers({ 'content-type': 'image/png' }),
            arrayBuffer: async () => iconBytes.buffer.slice(iconBytes.byteOffset, iconBytes.byteOffset + iconBytes.byteLength),
          };
        }
        throw new Error(`unexpected fetch: ${url}`);
      });

      const result = await fetchAndStoreFavicon(dataDir, 'https://no-root-favicon.com');
      expect(result).toBe('no-root-favicon.com');

      const cached = await getCachedFavicon(dataDir, 'no-root-favicon.com');
      expect(cached!.contentType).toBe('image/png');
      expect(Buffer.from(cached!.data as Buffer)).toEqual(iconBytes);
    });

    it('removes the old file when a refresh changes extension', async () => {
      const favDir = join(dataDir, 'favicons');
      await mkdir(favDir, { recursive: true });
      const oldFile = join(favDir, 'switching-ext.com.ico');
      await writeFile(oldFile, Buffer.from([0, 0]));
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      await utimes(oldFile, eightDaysAgo, eightDaysAgo);

      const newIcon = Buffer.from([9, 9, 9]);
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'image/png' }),
        arrayBuffer: async () => newIcon.buffer.slice(newIcon.byteOffset, newIcon.byteOffset + newIcon.byteLength),
      });

      await fetchAndStoreFavicon(dataDir, 'https://switching-ext.com');

      const cached = await getCachedFavicon(dataDir, 'switching-ext.com');
      expect(cached!.contentType).toBe('image/png');
      expect(Buffer.from(cached!.data as Buffer)).toEqual(newIcon);
    });
  });
});
