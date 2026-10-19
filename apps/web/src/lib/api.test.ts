import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api } from './api';
import { formatVnTime, safeNextPath } from './utils';

afterEach(() => vi.unstubAllGlobals());

const respond = (status: number, body?: unknown) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(body === undefined ? null : JSON.stringify(body), { status })),
  );

describe('api fetch wrapper', () => {
  it('calls the same-origin /api path with a JSON body', async () => {
    respond(200, { ok: true });
    await api.post('/auth/pin/login', { employeeCode: 'A', pin: '123456' });
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/auth/pin/login');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('same-origin');
    expect(init.body).toBe(JSON.stringify({ employeeCode: 'A', pin: '123456' }));
  });

  it('returns undefined for 204', async () => {
    respond(204);
    await expect(api.post('/auth/logout')).resolves.toBeUndefined();
  });

  it('turns an API error body into an ApiError with its code and lock time', async () => {
    respond(423, {
      statusCode: 423,
      code: 'PIN_LOCKED',
      message: 'x',
      lockedUntil: '2026-10-19T08:15:00.000Z',
    });
    const error = await api.post('/auth/pin/login', {}).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 423,
      code: 'PIN_LOCKED',
      lockedUntil: '2026-10-19T08:15:00.000Z',
    });
  });

  it('maps unreadable error bodies and network failures to INTERNAL', async () => {
    respond(502);
    await expect(api.get('/x')).rejects.toMatchObject({ code: 'INTERNAL', status: 502 });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('down'))),
    );
    await expect(api.get('/x')).rejects.toMatchObject({ code: 'INTERNAL', status: 0 });
  });
});

describe('utils', () => {
  it('only accepts same-site post-login paths', () => {
    expect(safeNextPath('/admin/menu')).toBe('/admin/menu');
    expect(safeNextPath('//evil.example')).toBe('/today');
    expect(safeNextPath('https://evil.example')).toBe('/today');
    expect(safeNextPath('/\\evil.example')).toBe('/today');
    expect(safeNextPath(null)).toBe('/today');
  });

  it('formats an instant as Vietnam time', () => {
    expect(formatVnTime('2026-10-19T01:15:00.000Z')).toBe('08:15');
  });
});
