import { ApiErrorSchema, type ApiErrorCode } from '@meal/shared';

/** A failed API call, with the machine-readable code the UI maps to Vietnamese copy. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly lockedUntil?: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const BASE = '/api';

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'INTERNAL', 'Network error');
  }

  if (res.status === 204) return undefined as T;

  const payload: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const parsed = ApiErrorSchema.safeParse(payload);
    if (parsed.success) {
      const e = parsed.data;
      throw new ApiError(res.status, e.code, e.message, e.lockedUntil, e.details);
    }
    throw new ApiError(res.status, 'INTERNAL', res.statusText || 'Request failed');
  }
  return payload as T;
}

/** Same-origin fetch wrapper (plan 6.1: no Axios). The browser only ever calls /api. */
export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
};
