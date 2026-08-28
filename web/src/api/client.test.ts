import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchLayout, updateLayout, login, ApiError } from './client';

describe('API Client', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('fetchLayout', () => {
    it('returns layout data on 200 OK', async () => {
      const mockLayout = {
        columns: [
          {
            id: 'col-1',
            blocks: [
              {
                kind: 'links' as const,
                id: 'b-1',
                links: [{ id: 'l-1', title: 'GitHub', url: 'https://github.com' }],
              },
            ],
          },
        ],
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockLayout,
      } as unknown as Response);

      const result = await fetchLayout();
      expect(result).toEqual(mockLayout);
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/layout', {
        headers: { Accept: 'application/json' },
      });
    });

    it('throws ApiError with status and envelope code on failure', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: { code: 'unauthorized', message: 'Session invalid' } }),
      } as unknown as Response);

      await expect(fetchLayout()).rejects.toThrow(ApiError);
      try {
        await fetchLayout();
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        const apiErr = err as ApiError;
        expect(apiErr.status).toBe(401);
        expect(apiErr.code).toBe('unauthorized');
        expect(apiErr.message).toBe('Session invalid');
      }
    });
  });

  describe('updateLayout', () => {
    it('sends PUT /api/layout and returns canonical layout on 200 OK', async () => {
      const mockLayout = {
        columns: [{ id: 'col-1', blocks: [] }],
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockLayout,
      } as unknown as Response);

      const result = await updateLayout(mockLayout);
      expect(result).toEqual(mockLayout);
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/layout', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(mockLayout),
      });
    });

    it('throws ApiError on 400 invalid layout', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: { code: 'invalidLayout', message: 'Schema failed' } }),
      } as unknown as Response);

      await expect(updateLayout({ columns: [] })).rejects.toThrow(ApiError);
    });
  });

  describe('login', () => {
    it('succeeds on 200 OK', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      } as unknown as Response);

      await expect(login('password123', '123456')).resolves.toBeUndefined();
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ password: 'password123', totpCode: '123456' }),
      });
    });

    it('throws ApiError on 401 unauth', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: { code: 'invalidCredentials', message: 'Wrong password' } }),
      } as unknown as Response);

      await expect(login('wrong', '123456')).rejects.toThrow(ApiError);
    });

    it('throws ApiError on 429 rate limit', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ error: { code: 'rateLimited', message: 'Too many attempts' } }),
      } as unknown as Response);

      await expect(login('pass', '123456')).rejects.toThrow(ApiError);
    });
  });
});

