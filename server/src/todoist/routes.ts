import { Hono, type Context } from 'hono';
import { readTodoistCache } from './store.js';
import { createTask, setTaskCompleted, deleteTask, TodoistApiError } from './client.js';

export function createTodoistRoutes(
  dataDir: string,
  token: string,
  refresh?: () => Promise<unknown>,
): Hono {
  const app = new Hono();

  const refreshAndRespond = async (c: Context) => {
    if (refresh) await refresh();
    const cache = await readTodoistCache(dataDir);
    return c.json(cache ?? { tasks: [], fetchedAt: null });
  };

  const errorStatus = (err: unknown): 400 | 401 | 404 | 500 => {
    if (err instanceof TodoistApiError && [400, 401, 404].includes(err.status)) {
      return err.status as 400 | 401 | 404;
    }
    return 500;
  };

  app.post('/api/todoist-cache/refresh', async (c) => {
    if (!refresh) {
      return c.json({ error: { code: 'unavailable', message: 'Refresh not configured' } }, 503);
    }
    return refreshAndRespond(c);
  });

  app.get('/api/todoist-cache', async (c) => {
    try {
      const cache = await readTodoistCache(dataDir);
      return c.json(cache ?? { tasks: [], fetchedAt: null });
    } catch (err) {
      console.error('[todoist] routes error:', err);
      return c.json(
        {
          error: {
            code: 'todoistCacheError',
            message: 'Failed to read Todoist cache',
          },
        },
        500,
      );
    }
  });

  // Every mutation below talks straight to Todoist, then re-polls so the
  // cache (and every other client of it, e.g. TodoBar) reflects the change
  // immediately rather than waiting out the poll interval.
  app.post('/api/todoist-cache/tasks', async (c) => {
    const body = await c.req.json<{ content?: string }>().catch(() => ({ content: undefined }));
    const content = body.content?.trim();
    if (!content) {
      return c.json({ error: { code: 'invalidContent', message: 'content is required' } }, 400);
    }
    try {
      await createTask(token, content);
      return refreshAndRespond(c);
    } catch (err) {
      console.error('[todoist] create task failed:', err);
      return c.json({ error: { code: 'createFailed', message: 'Failed to create task' } }, errorStatus(err));
    }
  });

  app.post('/api/todoist-cache/tasks/:id/complete', async (c) => {
    const taskId = c.req.param('id');
    const body = await c.req.json<{ completed?: boolean }>().catch(() => ({ completed: undefined }));
    try {
      await setTaskCompleted(token, taskId, body.completed ?? true);
      return refreshAndRespond(c);
    } catch (err) {
      console.error('[todoist] complete task failed:', err);
      return c.json({ error: { code: 'completeFailed', message: 'Failed to update task' } }, errorStatus(err));
    }
  });

  app.delete('/api/todoist-cache/tasks/:id', async (c) => {
    const taskId = c.req.param('id');
    try {
      await deleteTask(token, taskId);
      return refreshAndRespond(c);
    } catch (err) {
      console.error('[todoist] delete task failed:', err);
      return c.json({ error: { code: 'deleteFailed', message: 'Failed to delete task' } }, errorStatus(err));
    }
  });

  return app;
}
