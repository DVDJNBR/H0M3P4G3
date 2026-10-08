import { readTodoistCache, writeTodoistCache, type TodoistTask, type TodoistCache } from './store.js';

interface TodoistApiTask {
  id: string;
  content: string;
  due?: { date: string; is_recurring: boolean } | null;
}

type TodoistApiResponse = TodoistApiTask[] | { results: TodoistApiTask[] };

// Mirrors TodoBar's own filter (no date | overdue | today) -- the same
// "what should I actually be looking at" view the menu-bar app shows.
const ACTIVE_TASKS_QUERY = 'no date | overdue | today';

export async function fetchActiveTasks(
  token: string,
): Promise<{ tasks: TodoistTask[] } | { error: string }> {
  if (!token || token === 'placeholder' || token === 'dev-todoist-token') {
    return { error: 'no token configured' };
  }

  const url = `https://api.todoist.com/api/v1/tasks/filter?query=${encodeURIComponent(ACTIVE_TASKS_QUERY)}`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const reason = `HTTP ${response.status}`;
      console.error(`[todoist] API request failed: ${reason}`);
      return { error: reason };
    }

    const data = (await response.json()) as TodoistApiResponse;
    const raw: TodoistApiTask[] = Array.isArray(data) ? data : data.results;

    return {
      tasks: raw.map((t) => ({
        id: t.id,
        content: t.content,
        dueDate: t.due?.date,
        isRecurring: t.due?.is_recurring || undefined,
      })),
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error('[todoist] fetch failed:', reason);
    return { error: reason };
  }
}

export async function pollTodoist(dataDir: string, token: string): Promise<TodoistCache> {
  const current = await readTodoistCache(dataDir);
  const result = await fetchActiveTasks(token);
  const cache: TodoistCache = {
    tasks: 'tasks' in result ? result.tasks : (current?.tasks ?? []),
    fetchedAt: new Date().toISOString(),
    lastError: 'error' in result ? result.error : undefined,
  };

  await writeTodoistCache(dataDir, cache);
  return cache;
}

export function startTodoistPoller(
  dataDir: string,
  shouldPoll: () => Promise<boolean>,
  token: string,
  intervalMs = 5 * 60 * 1000,
): { stop: () => void; trigger: () => Promise<TodoistCache | null> } {
  const trigger = async () => {
    try {
      if (!(await shouldPoll())) return await readTodoistCache(dataDir);
      return await pollTodoist(dataDir, token);
    } catch (err) {
      console.error('[todoist] polling error:', err);
      return await readTodoistCache(dataDir);
    }
  };

  trigger().catch(() => {});

  const interval = setInterval(() => {
    trigger().catch(() => {});
  }, intervalMs);

  return {
    stop: () => clearInterval(interval),
    trigger,
  };
}
