'use client';

import type { RegistrationGridView, RegistrationUnitOption } from '@meal/shared';
import { useQuery } from '@tanstack/react-query';
import { ResponsiveSelect } from '@/components/responsive-select';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
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

/**
 * How many rows the grid shows for a unit: the employees of one canteen, the one on screen for
 * the picked unit, else the most common one (the grid's default), not the unit's total.
 */
export function unitRowCount(unit: RegistrationUnitOption, canteenId: string | null): number {
  if (canteenId) return unit.canteenCounts[canteenId] ?? 0;
  return Math.max(0, ...Object.values(unit.canteenCounts));
}

export function UnitPicker({
  id,
  units,
  value,
  canteenId,
  onChange,
}: {
  id: string;
  units: readonly RegistrationUnitOption[];
  value: string;
  /** The canteen of the grid on screen for `value`. */
  canteenId: string | null;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-2 sm:max-w-md">
      <Label htmlFor={id}>{t('registrations.unit')}</Label>
      <ResponsiveSelect
        id={id}
        value={value}
        onValueChange={onChange}
        placeholder={t('registrations.chooseUnit')}
        options={units.map((u) => ({
          value: u.id,
          label: t('registrations.unitOption', {
            path: u.pathName,
            count: unitRowCount(u, u.id === value ? canteenId : null),
          }),
        }))}
      />
    </div>
  );
}

/** Only shown when the employees below the node eat in more than one canteen. */
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
    <div className="flex w-full flex-col gap-2 sm:w-56">
      <Label htmlFor={id}>{t('registrations.canteen')}</Label>
      <ResponsiveSelect
        id={id}
        value={grid.canteenId ?? ''}
        onValueChange={onChange}
        options={grid.canteens.map((c) => ({ value: c.id, label: c.name }))}
      />
    </div>
  );
}
