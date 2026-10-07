import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTodoistRoutes } from './routes.js';
import { readTodoistCache, writeTodoistCache } from './store.js';
import { fetchActiveTasks, pollTodoist } from './poller.js';

describe('Todoist Module', () => {
  let dataDir: string;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'h0m3p4g3-todoist-'));
  });

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  describe('Store', () => {
    it('returns null when cache file is missing', async () => {
      const cache = await readTodoistCache(dataDir);
      expect(cache).toBeNull();
    });

    it('persists and reads back cache data atomically', async () => {
      const mockCache = {
        tasks: [{ id: '1', content: 'Faire les poussières' }],
        fetchedAt: '2026-08-07T12:00:00Z',
      };

      await writeTodoistCache(dataDir, mockCache);
      const readBack = await readTodoistCache(dataDir);
      expect(readBack).toEqual(mockCache);
    });
  });

  describe('Routes', () => {
    it('GET /api/todoist-cache returns cached tasks', async () => {
      const mockCache = {
        tasks: [{ id: '1', content: 'Tusmo' }],
        fetchedAt: '2026-08-07T12:00:00Z',
      };
      await writeTodoistCache(dataDir, mockCache);

      const app = createTodoistRoutes(dataDir, 'test-token');
      const res = await app.request('/api/todoist-cache');
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(mockCache);
    });

    it('GET /api/todoist-cache returns an empty shape when nothing cached yet', async () => {
      const app = createTodoistRoutes(dataDir, 'test-token');
      const res = await app.request('/api/todoist-cache');
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ tasks: [], fetchedAt: null });
    });

    it('POST /api/todoist-cache/refresh 503s when no refresh function is wired', async () => {
      const app = createTodoistRoutes(dataDir, 'test-token');
      const res = await app.request('/api/todoist-cache/refresh', { method: 'POST' });
      expect(res.status).toBe(503);
    });

    it('POST /api/todoist-cache/refresh calls the refresh function and returns the resulting cache', async () => {
      let called = false;
      const refresh = async () => {
        called = true;
        await writeTodoistCache(dataDir, { tasks: [{ id: '2', content: 'new task' }], fetchedAt: 'now' });
      };

      const app = createTodoistRoutes(dataDir, 'test-token', refresh);
      const res = await app.request('/api/todoist-cache/refresh', { method: 'POST' });
      expect(called).toBe(true);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { tasks: unknown };
      expect(body.tasks).toEqual([{ id: '2', content: 'new task' }]);
    });
  });

  describe('fetchActiveTasks', () => {
    it('never throws on network failures or timeouts (NFR4)', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
      const result = await fetchActiveTasks('a-real-token');
      expect(result).toEqual({ error: 'Network error' });
    });

    it('reports a configured-but-placeholder token distinctly', async () => {
      const result = await fetchActiveTasks('dev-todoist-token');
      expect(result).toEqual({ error: 'no token configured' });
    });

    it('parses a bare-array API response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ id: '1', content: 'Nettoyer le bureau' }],
      });
      const result = await fetchActiveTasks('a-real-token');
      expect(result).toEqual({ tasks: [{ id: '1', content: 'Nettoyer le bureau' }] });
    });

    it('parses a {results: [...]} API response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ results: [{ id: '1', content: 'Tusmo' }] }),
      });
      const result = await fetchActiveTasks('a-real-token');
      expect(result).toEqual({ tasks: [{ id: '1', content: 'Tusmo' }] });
    });
  });

  describe('Mutation routes', () => {
    it('POST /tasks creates a task via the real API, then returns the refreshed cache', async () => {
      const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (init?.method === 'POST' && url.endsWith('/tasks')) {
          return { ok: true, status: 200, json: async () => ({ id: 'new-id' }) };
        }
        return { ok: true, status: 200, json: async () => [{ id: 'new-id', content: 'Faire les courses' }] };
      });
      globalThis.fetch = fetchMock;

      const app = createTodoistRoutes(dataDir, 'test-token', () => pollTodoist(dataDir, 'test-token'));
      const res = await app.request('/api/todoist-cache/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Faire les courses' }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { tasks: { content: string }[] };
      expect(body.tasks).toEqual([{ id: 'new-id', content: 'Faire les courses' }]);
    });

    it('POST /tasks rejects empty content without calling the API', async () => {
      const fetchMock = vi.fn();
      globalThis.fetch = fetchMock;

      const app = createTodoistRoutes(dataDir, 'test-token');
      const res = await app.request('/api/todoist-cache/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '  ' }),
      });

      expect(res.status).toBe(400);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('POST /tasks/:id/complete closes the task then refreshes', async () => {
      const fetchMock = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/close')) return { ok: true, status: 200 };
        return { ok: true, status: 200, json: async () => [] };
      });
      globalThis.fetch = fetchMock;

      const app = createTodoistRoutes(dataDir, 'test-token');
      const res = await app.request('/api/todoist-cache/tasks/abc/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: true }),
      });

      expect(res.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/tasks/abc/close'), expect.anything());
    });

    it('DELETE /tasks/:id removes the task then refreshes', async () => {
      const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (init?.method === 'DELETE') return { ok: true, status: 200 };
        return { ok: true, status: 200, json: async () => [] };
      });
      globalThis.fetch = fetchMock;

      const app = createTodoistRoutes(dataDir, 'test-token');
      const res = await app.request('/api/todoist-cache/tasks/abc', { method: 'DELETE' });

      expect(res.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/tasks/abc'), expect.objectContaining({ method: 'DELETE' }));
    });

    it('surfaces a Todoist API failure as the same status code', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 });

      const app = createTodoistRoutes(dataDir, 'test-token');
      const res = await app.request('/api/todoist-cache/tasks/abc', { method: 'DELETE' });

      expect(res.status).toBe(401);
    });
  });

  describe('pollTodoist', () => {
    it('keeps the previous tasks when a poll fails, but records the error', async () => {
      await writeTodoistCache(dataDir, { tasks: [{ id: '1', content: 'old task' }], fetchedAt: 'before' });
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('timeout'));

      const result = await pollTodoist(dataDir, 'a-real-token');
      expect(result.tasks).toEqual([{ id: '1', content: 'old task' }]);
      expect(result.lastError).toBe('timeout');
    });
  });
});
