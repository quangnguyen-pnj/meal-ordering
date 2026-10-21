'use client';

import type { EmployeeMappingView } from '@meal/shared';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useId, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/skeleton';
import { useDebounced } from '@/hooks/use-debounced';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { t } from '@/messages';

export type PickedEmployee = Pick<EmployeeMappingView, 'employeeCode' | 'name' | 'orgPath'>;

/**
 * Search-as-you-type employee chooser, so an admin sees the name before granting a role instead of
 * trusting a typed code. Searches the caller's own scope through /employees.
 */
export function EmployeePicker({
  id,
  value,
  onChange,
  placeholder = t('employeePicker.placeholder'),
}: {
  id?: string;
  value: PickedEmployee | null;
  onChange: (employee: PickedEmployee | null) => void;
  placeholder?: string;
}) {
  const listId = useId();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const term = useDebounced(q.trim(), 250);

  const search = useQuery({
    queryKey: ['/employees', 'picker', term],
    queryFn: () =>
      api.get<{ items: EmployeeMappingView[] }>(
        `/employees?${new URLSearchParams({ q: term, status: 'ACTIVE', limit: '8', offset: '0' })}`,
      ),
    enabled: term.length >= 2,
  });
  const items = term.length >= 2 ? (search.data?.items ?? []) : [];

  if (value) {
    return (
      <div className="flex min-h-11 items-center justify-between gap-2 rounded-md border border-input bg-muted/40 px-3 py-1.5">
        <div className="min-w-0 text-sm">
          <p className="truncate font-medium">{value.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            <span className="font-mono">{value.employeeCode}</span> · {value.orgPath}
          </p>
        </div>
        <button
          type="button"
          className="rounded p-1 text-muted-foreground hover:text-foreground"
          aria-label={t('employeePicker.clear')}
          onClick={() => onChange(null)}
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    );
  }

  const choose = (e: EmployeeMappingView) => {
    onChange({ employeeCode: e.employeeCode, name: e.name, orgPath: e.orgPath });
    setQ('');
    setOpen(false);
  };

  return (
    <div className="relative">
      <Input
        id={id}
        role="combobox"
        aria-expanded={open && term.length >= 2}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder={placeholder}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, items.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === 'Enter' && open && items[active]) {
            e.preventDefault();
            choose(items[active]);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
      />
      {search.isFetching ? (
        <Spinner className="absolute right-3 top-3.5 text-muted-foreground" />
      ) : null}
      {open && term.length >= 2 ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border bg-card p-1 shadow-lg"
        >
          {items.map((e, i) => (
            <li
              key={e.employeeCode}
              role="option"
              aria-selected={i === active}
              className={cn(
                'cursor-pointer rounded px-2 py-1.5 text-sm',
                i === active && 'bg-accent',
              )}
              onMouseDown={(ev) => ev.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(e)}
            >
              <p className="font-medium">
                {e.name}{' '}
                <span className="font-mono text-xs text-muted-foreground">{e.employeeCode}</span>
              </p>
              <p className="truncate text-xs text-muted-foreground">{e.orgPath}</p>
            </li>
          ))}
          {!search.isFetching && items.length === 0 ? (
            <li className="px-2 py-1.5 text-sm text-muted-foreground">
              {search.error ? t('employeePicker.error') : t('employeePicker.noResult')}
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
