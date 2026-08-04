import { describe, expect, it } from 'vitest';
import { createApp } from './index';

describe('GET /api/health', () => {
  it('returns 200 with camelCase {"status":"ok"}', async () => {
    const res = await createApp().request('/api/health');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.json()).toEqual({ status: 'ok' });
  });
});

describe('unhandled route error', () => {
  it('returns 500 with the AD-7 envelope and no leaked internals', async () => {
    const app = createApp();
    app.get('/api/boom', () => {
      throw new Error('secret internal detail');
    });
    const res = await app.request('/api/boom');
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: {
        code: 'internalError',
        message: 'Internal server error',
      },
    });
  });
});

describe('unknown API route', () => {
  it('returns 404 with the AD-7 error envelope', async () => {
    const res = await createApp().request('/api/nope');
    expect(res.status).toBe(404);
    const body = (await res.json()) as {
      error: { code: string; message: string };
    };
    expect(body.error.code).toBe('notFound');
    expect(typeof body.error.message).toBe('string');
    expect(body.error.message.length).toBeGreaterThan(0);
  });
});
