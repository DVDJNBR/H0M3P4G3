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

export async function fetchRaindropCache(): Promise<RaindropCacheMap> {
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
