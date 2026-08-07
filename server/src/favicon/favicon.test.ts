import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createFaviconRoutes } from './routes';
import { sanitizeDomain, fetchAndStoreFavicon, getCachedFavicon } from './fetcher';

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
      const { mkdir } = await import('node:fs/promises');
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
  });
});
