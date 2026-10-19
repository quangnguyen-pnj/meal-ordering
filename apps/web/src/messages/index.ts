import type { ApiErrorCode } from '@meal/shared';
import { vi, type Messages } from './vi';

type Join<K extends string, P extends string> = `${K}.${P}`;

/** Dotted paths to every string leaf of the messages object. */
type Paths<T> = {
  [K in keyof T & string]: T[K] extends string ? K : Join<K, Paths<T[K]>>;
}[keyof T & string];

export type MessageKey = Paths<Messages>;

/** Looks up a Vietnamese message by dotted key and fills {placeholders}. */
export function t(key: MessageKey, params: Record<string, string | number> = {}): string {
  let node: unknown = vi;
  for (const part of key.split('.')) {
    node = (node as Record<string, unknown> | undefined)?.[part];
  }
  if (typeof node !== 'string') return key;
  return node.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

export function errorMessage(code: ApiErrorCode): string {
  return vi.errors[code];
}

export { vi };
