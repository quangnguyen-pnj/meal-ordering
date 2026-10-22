'use client';

import { NativeSelect } from '@/components/ui/native-select';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useIsTouch } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

// Radix Select reserves "" for "no value", but our filters use "" for "Tất cả" / "Kế thừa".
const EMPTY = '__empty__';
const toRadix = (v: string) => (v === '' ? EMPTY : v);
const fromRadix = (v: string) => (v === EMPTY ? '' : v);

/**
 * One select for the whole app: the operating system's own picker on phones and tablets,
 * the shadcn/ui Select (Radix) with a mouse. Values are strings; "" is a valid option.
 */
export function ResponsiveSelect({
  id,
  value,
  onValueChange,
  options,
  disabled,
  className,
  placeholder,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
}: {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: readonly SelectOption[];
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
}) {
  const touch = useIsTouch();

  if (touch) {
    return (
      <div className={cn('w-full', className)}>
        <NativeSelect
          id={id}
          value={value}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedBy}
          onChange={(e) => onValueChange(e.target.value)}
        >
          {placeholder && !options.some((o) => o.value === value) ? (
            <option value={value} disabled>
              {placeholder}
            </option>
          ) : null}
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </NativeSelect>
      </div>
    );
  }

  return (
    <Select
      value={toRadix(value)}
      onValueChange={(v) => onValueChange(fromRadix(v))}
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        className={className}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={toRadix(o.value)} disabled={o.disabled}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
