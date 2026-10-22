'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * Turns what people type ("830", "0830", "8:30") into HH:mm. Anything else is returned as typed,
 * so the setting schema can reject it.
 */
export function normalizeTime(raw: string): string {
  const s = raw.trim();
  const withColon = /^(\d{1,2}):(\d{2})$/.exec(s);
  const digits = /^(\d{1,2})(\d{2})$/.exec(s);
  const m = withColon ?? digits;
  if (!m) return s;
  return `${m[1]!.padStart(2, '0')}:${m[2]}`;
}

/**
 * 24-hour HH:mm text field. A native time input follows the browser locale and shows
 * "11:59 PM" on English systems, while the rest of the app writes "23:59".
 */
export const TimeInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
    value: string;
    onChange: (value: string) => void;
  }
>(({ value, onChange, className, onBlur, ...props }, ref) => (
  <Input
    ref={ref}
    type="text"
    inputMode="numeric"
    placeholder="HH:mm"
    maxLength={5}
    autoComplete="off"
    className={cn('w-24 font-mono tabular-nums', className)}
    value={value}
    onChange={(e) => onChange(e.target.value.replace(/[^\d:]/g, ''))}
    onBlur={(e) => {
      onChange(normalizeTime(e.target.value));
      onBlur?.(e);
    }}
    {...props}
  />
));
TimeInput.displayName = 'TimeInput';
