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

async function send(method: string, path: string, body?: unknown): Promise<Response> {
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  try {
    return await fetch(`${BASE}${path}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined || isForm ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'INTERNAL', 'Network error');
  }
}

async function failure(res: Response): Promise<ApiError> {
  const payload: unknown = await res.json().catch(() => null);
  const parsed = ApiErrorSchema.safeParse(payload);
  if (parsed.success) {
    const e = parsed.data;
    return new ApiError(res.status, e.code, e.message, e.lockedUntil, e.details);
  }
  return new ApiError(res.status, 'INTERNAL', res.statusText || 'Request failed');
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await send(method, path, body);

  if (res.status === 204) return undefined as T;
  if (!res.ok) throw await failure(res);
  return (await res.json().catch(() => null)) as T;
}

/** Saves a file the API returns (e.g. an Excel export) through a temporary link. */
async function download(path: string, fileName: string): Promise<void> {
  const res = await send('GET', path);
  if (!res.ok) throw await failure(res);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/** Same-origin fetch wrapper (plan 6.1: no Axios). The browser only ever calls /api. */
export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  /** multipart/form-data upload with one file field named `file`. */
  upload: <T>(path: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<T>('POST', path, form);
  },
  download,
};
