import { lastAcceptedMinute } from '@meal/shared';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Only same-site paths are valid post-login destinations (blocks open redirects). */
export function safeNextPath(next: string | null | undefined, fallback = '/today'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) {
    return fallback;
  }
  return next;
}

/** HH:mm in Asia/Ho_Chi_Minh for an ISO instant. */
export function formatVnTime(iso: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(iso));
}

/** dd/MM/yyyy for a YYYY-MM-DD calendar date (serving days are dates, not instants). */
export function formatDate(date: string): string {
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
}

/** dd/MM/yyyy HH:mm in Asia/Ho_Chi_Minh for an ISO instant. */
export function formatVnDateTime(iso: string): string {
  const parts = new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Ho_Chi_Minh',
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}`;
}

/** BR-03: a closeAt is shown as its last accepted minute, e.g. "22/10/2026 23:59". */
export function formatCloseAt(closeAtIso: string): string {
  return formatVnDateTime(lastAcceptedMinute(new Date(closeAtIso)).toISOString());
}
