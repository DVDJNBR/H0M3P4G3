import type { Layout } from '../types';

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

export type RaindropCacheMap = Record<
  string,
  {
    collectionId: string;
    fetchedAt: string;
    items: Array<{
      id: number;
      title: string;
      link: string;
      domain: string;
      cover?: string;
      created: string;
    }>;
  }
>;

export async function fetchLayout(): Promise<Layout> {
  const res = await fetch('/api/layout', {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    let errorData: ApiErrorResponse | null = null;
    try {
      errorData = await res.json();
    } catch {
      // Ignore JSON parse errors
    }

    const code = errorData?.error?.code || 'unknownError';
    const message = errorData?.error?.message || `Request failed with status ${res.status}`;
    throw new ApiError(code, message, res.status);
  }

  return res.json();
}

export async function updateLayout(layout: Layout): Promise<Layout> {
  const res = await fetch('/api/layout', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(layout),
  });

  if (!res.ok) {
    let errorData: ApiErrorResponse | null = null;
    try {
      errorData = await res.json();
    } catch {
      // Ignore
    }

    const code = errorData?.error?.code || 'updateFailed';
    const message = errorData?.error?.message || `Failed to update layout (${res.status})`;
    throw new ApiError(code, message, res.status);
  }

  return res.json();
}

let inFlightRaindropCacheFetch: Promise<RaindropCacheMap> | null = null;

export async function fetchRaindropCache(): Promise<RaindropCacheMap> {
  if (inFlightRaindropCacheFetch) return inFlightRaindropCacheFetch;

  inFlightRaindropCacheFetch = fetchRaindropCacheFromServer().finally(() => {
    inFlightRaindropCacheFetch = null;
  });
  return inFlightRaindropCacheFetch;
  // Every raindrop BlockView mounts at once on page load and each would
  // otherwise fire its own request for the same payload -- sharing the
  // in-flight promise collapses those into one round trip.
}

async function fetchRaindropCacheFromServer(): Promise<RaindropCacheMap> {
  try {
    const res = await fetch('/api/raindrop-cache', {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

export interface TodoistCache {
  tasks: Array<{ id: string; content: string; dueDate?: string; isRecurring?: boolean }>;
  fetchedAt: string | null;
  lastError?: string;
}

let inFlightTodoistCacheFetch: Promise<TodoistCache> | null = null;

export async function fetchTodoistCache(): Promise<TodoistCache> {
  if (inFlightTodoistCacheFetch) return inFlightTodoistCacheFetch;

  inFlightTodoistCacheFetch = fetchTodoistCacheFromServer().finally(() => {
    inFlightTodoistCacheFetch = null;
  });
  return inFlightTodoistCacheFetch;
}

async function fetchTodoistCacheFromServer(): Promise<TodoistCache> {
  try {
    const res = await fetch('/api/todoist-cache', {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return { tasks: [], fetchedAt: null };
    return await res.json();
  } catch {
    return { tasks: [], fetchedAt: null };
  }
}

// Every mutation hits the real Todoist API server-side and returns the
// freshly re-polled cache, so TodoBar (and this homepage) always agree --
// there's no separate sync step, just two clients of the same account.
export async function createTodoistTask(content: string): Promise<TodoistCache> {
  const res = await fetch('/api/todoist-cache/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new ApiError('createFailed', 'Failed to create task', res.status);
  return res.json();
}

export async function completeTodoistTask(id: string, completed: boolean): Promise<TodoistCache> {
  const res = await fetch(`/api/todoist-cache/tasks/${id}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ completed }),
  });
  if (!res.ok) throw new ApiError('completeFailed', 'Failed to update task', res.status);
  return res.json();
}

export async function deleteTodoistTask(id: string): Promise<TodoistCache> {
  const res = await fetch(`/api/todoist-cache/tasks/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new ApiError('deleteFailed', 'Failed to delete task', res.status);
  return res.json();
}

export type LinkStatusBucket = 'up' | 'degraded' | 'down';

export async function fetchLinkStatus(url: string): Promise<LinkStatusBucket> {
  try {
    const res = await fetch(`/api/link-status?url=${encodeURIComponent(url)}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return 'down';
    const data = (await res.json()) as { status: LinkStatusBucket };
    return data.status;
  } catch {
    return 'down';
  }
}

export async function login(password: string, totp: string): Promise<void> {
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ password, totpCode: totp }),
  });

  if (!res.ok) {
    let errorData: ApiErrorResponse | null = null;
    try {
      errorData = await res.json();
    } catch {
      // Ignore JSON parse errors
    }

    const code = errorData?.error?.code || 'loginFailed';
    const message = errorData?.error?.message || 'Invalid credentials';
    throw new ApiError(code, message, res.status);
  }
}
