// Write operations against the real Todoist API, mirroring TodoBar's own
// TodoistClient.swift exactly -- both are clients of the same account, so
// a task created or completed here shows up in the menu-bar app too, with
// no separate sync step needed. Todoist itself is the single source of
// truth.
const BASE_URL = 'https://api.todoist.com/api/v1';

export class TodoistApiError extends Error {
  status: number;
  constructor(status: number) {
    super(`Todoist API request failed: HTTP ${status}`);
    this.status = status;
  }
}

async function request(
  path: string,
  method: string,
  token: string,
  body?: Record<string, unknown>,
): Promise<Response> {
  const response = await fetch(`${BASE_URL}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return response;
}

export async function createTask(token: string, content: string): Promise<string> {
  const res = await request('tasks', 'POST', token, { content });
  if (!res.ok) throw new TodoistApiError(res.status);
  const data = (await res.json()) as { id: string };
  return data.id;
}

export async function setTaskCompleted(
  token: string,
  taskId: string,
  completed: boolean,
): Promise<void> {
  const action = completed ? 'close' : 'reopen';
  const res = await request(`tasks/${taskId}/${action}`, 'POST', token);
  if (!res.ok && res.status !== 404) throw new TodoistApiError(res.status);
}

export async function deleteTask(token: string, taskId: string): Promise<void> {
  const res = await request(`tasks/${taskId}`, 'DELETE', token);
  if (!res.ok && res.status !== 404) throw new TodoistApiError(res.status);
}
