import { readFile, writeFile, rename, unlink, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export interface TodoistTask {
  id: string;
  content: string;
  // YYYY-MM-DD, present whenever the task has a due date -- compared
  // client-side against "today" to color it the way Todoist itself does
  // (red = overdue, amber = due today).
  dueDate?: string;
  isRecurring?: boolean;
  // Todoist API convention: 4 = P1 (urgent/red), 3 = P2 (orange),
  // 2 = P3 (blue), 1 = P4 (no priority/default). Absent means 1.
  priority?: number;
}

export interface TodoistCache {
  tasks: TodoistTask[];
  fetchedAt: string;
  lastError?: string;
}

export function getTodoistCachePath(dataDir: string): string {
  return join(dataDir, 'todoist-cache.json');
}

export async function readTodoistCache(dataDir: string): Promise<TodoistCache | null> {
  const filePath = getTodoistCachePath(dataDir);
  try {
    const raw = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (err) {
    if ((err as { code?: string }).code === 'ENOENT') {
      return null;
    }
    console.error(`[todoist] failed to read cache from ${filePath}:`, err);
    return null;
  }
}

export async function writeTodoistCache(dataDir: string, cache: TodoistCache): Promise<void> {
  const filePath = getTodoistCachePath(dataDir);
  const tmpPath = `${filePath}.tmp.${Date.now()}`;

  await mkdir(dirname(filePath), { recursive: true });

  try {
    await writeFile(tmpPath, JSON.stringify(cache, null, 2), 'utf8');
    await rename(tmpPath, filePath);
    console.log(`[todoist] updated cache at ${filePath}`);
  } catch (err) {
    try {
      await unlink(tmpPath);
    } catch {
      // Ignore cleanup error
    }
    console.error(`[todoist] failed to write cache to ${filePath}:`, err);
    throw err;
  }
}
