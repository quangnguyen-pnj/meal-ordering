'use client';

import { addDays, type RegistrationGridView, type RegistrationUnitOption } from '@meal/shared';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { t } from '@/messages';

export interface UnitsResponse {
  items: RegistrationUnitOption[];
  /** The coming week by server time. */
  upcomingWeekStart: string;
}

/** Org nodes in the caller's scope (registration.onBehalf), shared by the grid and the forms. */
export function useRegistrationUnits() {
  return useQuery({
    queryKey: ['/admin/registrations/units'],
    queryFn: () => api.get<UnitsResponse>('/admin/registrations/units'),
  });
}

export function useRegistrationGrid(unitId: string, weekStart: string | null, canteenId: string) {
  return useQuery({
    queryKey: ['/admin/registrations/grid', unitId, weekStart, canteenId],
    queryFn: () =>
      api.get<RegistrationGridView>(
        `/admin/registrations/units/${encodeURIComponent(unitId)}/grid?weekStart=${weekStart}` +
          (canteenId ? `&canteenId=${encodeURIComponent(canteenId)}` : ''),
      ),
    enabled: !!unitId && !!weekStart,
  });
}

export function WeekPicker({
  weekStart,
  onChange,
}: {
  weekStart: string;
  onChange: (weekStart: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium leading-none">{t('registrations.week')}</span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label={t('menu.previousWeek')}
          onClick={() => onChange(addDays(weekStart, -7))}
        >
          ‹
        </Button>
        <span className="min-w-28 text-center text-sm font-medium">{formatDate(weekStart)}</span>
        <Button
          variant="outline"
          size="icon"
          aria-label={t('menu.nextWeek')}
          onClick={() => onChange(addDays(weekStart, 7))}
        >
          ›
        </Button>
      </div>
    </div>
  );
}

export function UnitPicker({
  id,
  units,
  value,
  onChange,
}: {
  id: string;
  units: readonly RegistrationUnitOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex min-w-72 flex-1 flex-col gap-2 sm:max-w-md">
      <Label htmlFor={id}>{t('registrations.unit')}</Label>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{t('registrations.chooseUnit')}</option>
        {units.map((u) => (
          <option key={u.id} value={u.id}>
            {t('registrations.unitOption', { path: u.pathName, count: u.employeeCount })}
          </option>
        ))}
      </Select>
    </div>
  );
}

export function CanteenPicker({
  id,
  grid,
  onChange,
}: {
  id: string;
  grid: RegistrationGridView | undefined;
  onChange: (id: string) => void;
}) {
  if (!grid || grid.canteens.length < 2) return null;
  return (
    <div className="flex w-56 flex-col gap-2">
      <Label htmlFor={id}>{t('registrations.canteen')}</Label>
      <Select id={id} value={grid.canteenId ?? ''} onChange={(e) => onChange(e.target.value)}>
        {grid.canteens.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
    </div>
  );
}
