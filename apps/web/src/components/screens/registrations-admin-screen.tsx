'use client';

import {
  addDays,
  type GridSaveResult,
  type NotRegisteredView,
  type RegistrationGridView,
  type RegistrationProgressView,
} from '@meal/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Table, Td, Th } from '@/components/ui/table';
import { Tabs } from '@/components/ui/tabs';
import { ApiError, api } from '@/lib/api';
import { apiErrorText } from '@/lib/errors';
import { columnTotals, gridChanges, gridValues, type GridValues } from '@/lib/grid-draft';
import { cn, formatDate, formatVnTime } from '@/lib/utils';
import { t, vi } from '@/messages';
import { weekdayName } from './day-meals';
import {
  CanteenPicker,
  UnitPicker,
  WeekPicker,
  useRegistrationGrid,
  useRegistrationUnits,
} from './registration-admin-shared';

type Tab = 'progress' | 'notRegistered' | 'grid';
type SelectionErrorKey = keyof typeof vi.registrations.selectionErrors;

/**
 * /admin/registrations (plan 4.1, J2): progress by unit, the not-registered list (BR-21) and the
 * bulk-entry grid, usable on a 768 px tablet. Dept admins see their units, HC admins the factory.
 */
export function RegistrationsAdminScreen() {
  const units = useRegistrationUnits();
  const [tab, setTab] = useState<Tab>('progress');
  const [weekStart, setWeekStart] = useState<string | null>(null);
  useEffect(() => {
    if (units.data && !weekStart) setWeekStart(units.data.upcomingWeekStart);
  }, [units.data, weekStart]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('registrations.title')}</CardTitle>
        <CardDescription>{t('registrations.intro')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {units.error ? <Alert variant="error">{apiErrorText(units.error)}</Alert> : null}
        {weekStart ? <WeekPicker weekStart={weekStart} onChange={setWeekStart} /> : null}
        <Tabs
          label={t('registrations.title')}
          value={tab}
          onChange={setTab}
          tabs={[
            { key: 'progress', label: t('registrations.tabs.progress') },
            { key: 'notRegistered', label: t('registrations.tabs.notRegistered') },
            { key: 'grid', label: t('registrations.tabs.grid') },
          ]}
        />
        {weekStart && tab === 'progress' ? <ProgressTab weekStart={weekStart} /> : null}
        {weekStart && tab === 'notRegistered' ? <NotRegisteredTab weekStart={weekStart} /> : null}
        {weekStart && tab === 'grid' ? <GridTab weekStart={weekStart} /> : null}
      </CardContent>
    </Card>
  );
}

function ProgressTab({ weekStart }: { weekStart: string }) {
  const query = useQuery({
    queryKey: ['/admin/registrations/progress', weekStart],
    queryFn: () =>
      api.get<RegistrationProgressView>(`/admin/registrations/progress?weekStart=${weekStart}`),
  });
  if (query.error) return <Alert variant="error">{apiErrorText(query.error)}</Alert>;
  if (!query.data) return <p className="text-muted-foreground">{t('common.loading')}</p>;
  if (query.data.units.length === 0) return <p>{t('registrations.noUnits')}</p>;
  return (
    <Table>
      <thead>
        <tr>
          <Th>{t('registrations.mealUnit')}</Th>
          <Th className="text-right">{t('registrations.headcount')}</Th>
          <Th className="text-right">{t('registrations.registered')}</Th>
          <Th className="text-right">{t('registrations.notRegistered')}</Th>
          <Th className="text-right">{t('registrations.meals')}</Th>
        </tr>
      </thead>
      <tbody>
        {query.data.units.map((u) => {
          const pct = u.headcount > 0 ? Math.round((u.registered / u.headcount) * 100) : 0;
          return (
            <tr key={u.mealUnitId}>
              <Td>
                <p className="font-medium">{u.name}</p>
                <p className="text-xs text-muted-foreground">{u.pathName}</p>
                {!u.published ? (
                  <Badge variant="warning">{t('registrations.notPublished')}</Badge>
                ) : null}
              </Td>
              <Td className="text-right tabular-nums">{u.headcount}</Td>
              <Td className="text-right tabular-nums">
                {u.registered}{' '}
                <span className="text-xs text-muted-foreground">
                  {t('registrations.progressPct', { pct })}
                </span>
              </Td>
              <Td className="text-right tabular-nums">{u.notRegistered}</Td>
              <Td className="text-right tabular-nums">{u.meals}</Td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}

function NotRegisteredTab({ weekStart }: { weekStart: string }) {
  const [date, setDate] = useState('');
  const query = useQuery({
    queryKey: ['/admin/registrations/not-registered', weekStart, date],
    queryFn: () =>
      api.get<NotRegisteredView>(
        `/admin/registrations/not-registered?weekStart=${weekStart}${date ? `&date=${date}` : ''}`,
      ),
  });
  const dates = useMemo(
    () => [0, 1, 2, 3, 4, 5].map((i) => ({ i, date: addDays(weekStart, i) })),
    [weekStart],
  );
  return (
    <div className="flex flex-col gap-3">
      <div className="flex w-56 flex-col gap-2">
        <Label htmlFor="nr-day">{t('history.date')}</Label>
        <Select id="nr-day" value={date} onChange={(e) => setDate(e.target.value)}>
          <option value="">{t('registrations.allWeek')}</option>
          {dates.map((d) => (
            <option key={d.date} value={d.date}>
              {weekdayName(d.date)} {formatDate(d.date)}
            </option>
          ))}
        </Select>
      </div>
      {query.error ? <Alert variant="error">{apiErrorText(query.error)}</Alert> : null}
      {query.data ? (
        query.data.total === 0 ? (
          <p>{t('registrations.noOne')}</p>
        ) : (
          <>
            <p className="text-sm">{t('registrations.listTotal', { count: query.data.total })}</p>
            <Table>
              <thead>
                <tr>
                  <Th>{t('common.code')}</Th>
                  <Th>{t('common.name')}</Th>
                  <Th>{t('registrations.unit')}</Th>
                  <Th>{t('registrations.mealUnit')}</Th>
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((e) => (
                  <tr key={e.employeeCode}>
                    <Td className="tabular-nums">{e.employeeCode}</Td>
                    <Td className="font-medium">{e.name}</Td>
                    <Td className="text-sm text-muted-foreground">{e.orgPath}</Td>
                    <Td>{e.mealUnitName}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </>
        )
      ) : (
        <p className="text-muted-foreground">{t('common.loading')}</p>
      )}
    </div>
  );
}

const isRegistrationQuery = (key: readonly unknown[]) =>
  String(key[0]).startsWith('/admin/registrations');

function rowErrorsFrom(error: unknown): Record<string, string[]> {
  if (!(error instanceof ApiError) || !Array.isArray(error.details)) return {};
  const out: Record<string, string[]> = {};
  for (const d of error.details as Array<{ employeeCode?: string; code?: string }>) {
    if (!d.employeeCode || !d.code) continue;
    const label = vi.registrations.selectionErrors[d.code as SelectionErrorKey] ?? d.code;
    (out[d.employeeCode] ??= []).push(label);
  }
  return out;
}

function GridTab({ weekStart }: { weekStart: string }) {
  const qc = useQueryClient();
  const units = useRegistrationUnits();
  const [unitId, setUnitId] = useState('');
  const [canteenId, setCanteenId] = useState('');
  const [date, setDate] = useState('');
  const [values, setValues] = useState<GridValues>({});
  const [message, setMessage] = useState<string | null>(null);
  const [extraFor, setExtraFor] = useState<string | null>(null);
  const grid = useRegistrationGrid(unitId, weekStart, canteenId);
  const view = grid.data;

  useEffect(() => {
    if (!view || view.state !== 'PUBLISHED') return;
    const d = view.days.some((x) => x.date === date) ? date : (view.days[0]?.date ?? '');
    setDate(d);
    setValues(gridValues(view, d));
    // Only a new grid resets the values; changing the day is handled by pickDay.
  }, [view]);

  const day = view?.days.find((d) => d.date === date);
  const changes = view && day ? gridChanges(view, date, values) : { rows: [], invalid: {} };
  const dirty = changes.rows.length > 0 || Object.keys(changes.invalid).length > 0;

  const save = useMutation({
    mutationFn: () =>
      api.put<GridSaveResult>(
        `/admin/registrations/units/${encodeURIComponent(unitId)}/days/${date}`,
        { canteenId: view!.canteenId, rows: changes.rows },
      ),
    onSuccess: async (res) => {
      setMessage(t('registrations.savedDay', { changed: res.changedEmployees, meals: res.meals }));
      await qc.invalidateQueries({ predicate: (q) => isRegistrationQuery(q.queryKey) });
    },
  });
  const serverRowErrors = rowErrorsFrom(save.error);

  const pickDay = (d: string) => {
    if (dirty && !window.confirm(t('registrations.leaveConfirm'))) return;
    setDate(d);
    setMessage(null);
    if (view) setValues(gridValues(view, d));
  };

  function moveDown(e: React.KeyboardEvent<HTMLInputElement>, row: number, col: number) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const next = document.querySelector<HTMLInputElement>(`[data-cell="${row + 1}:${col}"]`);
    next?.focus();
    next?.select();
  }

  const totals = view && day ? columnTotals(view, date, values) : {};
  const editable = day?.window === 'ON_BEHALF';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <UnitPicker
          id="grid-unit"
          units={units.data?.items ?? []}
          value={unitId}
          onChange={(id) => {
            setUnitId(id);
            setCanteenId('');
            setMessage(null);
          }}
        />
        <CanteenPicker id="grid-canteen" grid={view} onChange={setCanteenId} />
      </div>
      {grid.error ? <Alert variant="error">{apiErrorText(grid.error)}</Alert> : null}
      {view?.state === 'NOT_PUBLISHED' ? (
        <Alert>{t('week.notPublished', { canteen: view.canteenName ?? '' })}</Alert>
      ) : null}
      {view?.state === 'NO_EMPLOYEES' ? <Alert>{t('registrations.noEmployees')}</Alert> : null}
      {view && (view.skipped.otherCanteen > 0 || view.skipped.cannotRegister > 0) ? (
        <p className="text-xs text-muted-foreground">
          {t('registrations.skipped', {
            other: view.skipped.otherCanteen,
            cannot: view.skipped.cannotRegister,
          })}
        </p>
      ) : null}

      {view?.state === 'PUBLISHED' && day ? (
        <>
          <div
            role="tablist"
            aria-label={t('registrations.tabs.grid')}
            className="flex flex-wrap gap-1"
          >
            {view.days.map((d) => (
              <Button
                key={d.date}
                role="tab"
                aria-selected={d.date === date}
                variant={d.date === date ? 'default' : 'outline'}
                size="sm"
                onClick={() => pickDay(d.date)}
              >
                {weekdayName(d.date)} {formatDate(d.date).slice(0, 5)}
              </Button>
            ))}
          </div>
          <Alert variant={editable ? 'info' : 'warning'}>
            {t(`registrations.windows.${day.window}`, { lock: formatVnTime(day.lockAt) })}
            {editable ? <p className="text-xs">{t('registrations.gridHint')}</p> : null}
          </Alert>
          {save.error && Object.keys(serverRowErrors).length === 0 ? (
            <Alert variant="error">{apiErrorText(save.error)}</Alert>
          ) : null}
          {message ? <Alert role="status">{message}</Alert> : null}

          <div className="w-full overflow-x-auto rounded-md border">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-muted">
                <tr>
                  <th className="sticky left-0 z-10 border-b bg-muted px-2 py-2 text-left text-xs font-semibold">
                    {t('registrations.employee')}
                  </th>
                  {day.items.map((i) => (
                    <th
                      key={i.id}
                      className="min-w-20 border-b px-2 py-2 text-center text-xs font-semibold"
                    >
                      {i.displayName}
                    </th>
                  ))}
                  <th className="border-b px-2 py-2 text-right text-xs font-semibold">
                    {t('registrations.total')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {view.rows.map((row, r) => {
                  const cell = row.cells[date]!;
                  const invalid = changes.invalid[row.employeeCode] ?? [];
                  const errors = serverRowErrors[row.employeeCode] ?? [];
                  const rowTotal = day.items.reduce(
                    (s, i) => s + (Number(values[row.employeeCode]?.[i.id]) || 0),
                    0,
                  );
                  const forecast = cell.forecast
                    ? Object.values(cell.forecast).reduce((s, n) => s + n, 0)
                    : null;
                  return (
                    <tr
                      key={row.employeeCode}
                      className={cn(
                        (invalid.length > 0 || errors.length > 0) && 'bg-destructive/5',
                      )}
                    >
                      <td className="sticky left-0 z-10 min-w-36 border-b bg-card px-2 py-1">
                        <p className="font-medium">{row.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {row.employeeCode}
                          {forecast !== null
                            ? ` · ${t('registrations.forecastShort', { count: forecast })}`
                            : ''}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {cell.blocked ? (
                            <Badge variant="outline">{t('registrations.blocked')}</Badge>
                          ) : null}
                          {cell.extra ? <Badge>{t('registrations.extra')}</Badge> : null}
                          {cell.needsReselect > 0 ? (
                            <Badge variant="warning">
                              {t('registrations.needsReselect', { count: cell.needsReselect })}
                            </Badge>
                          ) : null}
                        </div>
                        {invalid.length > 0 ? (
                          <p className="text-xs text-destructive">
                            {t('registrations.invalidCell')}
                          </p>
                        ) : null}
                        {errors.length > 0 ? (
                          <p className="text-xs text-destructive">
                            {t('registrations.rowError', { errors: errors.join(', ') })}
                          </p>
                        ) : null}
                        {day.window === 'EXTRA' && !cell.blocked ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExtraFor(row.employeeCode)}
                          >
                            {t('registrations.addExtra')}
                          </Button>
                        ) : null}
                      </td>
                      {day.items.map((i, c) => (
                        <td key={i.id} className="border-b px-1 py-1 text-center">
                          <Input
                            data-cell={`${r}:${c}`}
                            inputMode="numeric"
                            aria-label={`${row.name} · ${i.displayName}`}
                            aria-invalid={invalid.includes(i.id)}
                            disabled={!editable || cell.blocked}
                            value={values[row.employeeCode]?.[i.id] ?? ''}
                            onKeyDown={(e) => moveDown(e, r, c)}
                            onChange={(e) => {
                              setMessage(null);
                              const v = e.target.value;
                              setValues((prev) => ({
                                ...prev,
                                [row.employeeCode]: { ...prev[row.employeeCode], [i.id]: v },
                              }));
                            }}
                            className="mx-auto h-11 w-16 text-center tabular-nums"
                          />
                        </td>
                      ))}
                      <td className="border-b px-2 py-1 text-right font-medium tabular-nums">
                        {rowTotal}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-muted/60 font-semibold">
                  <td className="sticky left-0 z-10 bg-muted px-2 py-2">
                    {t('registrations.total')}
                  </td>
                  {day.items.map((i) => (
                    <td key={i.id} className="px-2 py-2 text-center tabular-nums">
                      {totals[i.id] ?? 0}
                    </td>
                  ))}
                  <td className="px-2 py-2 text-right tabular-nums">
                    {Object.values(totals).reduce((s, n) => s + n, 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {extraFor ? (
            <ExtraForm
              view={view}
              date={date}
              employeeCode={extraFor}
              onDone={async (ok) => {
                setExtraFor(null);
                if (ok) {
                  setMessage(t('registrations.extraSaved'));
                  await qc.invalidateQueries({ queryKey: ['/admin/registrations/grid'] });
                }
              }}
            />
          ) : null}

          {editable ? (
            <div className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card p-3 shadow-sm">
              <span className="text-sm text-muted-foreground">
                {dirty ? t('registrations.unsaved') : t('week.noChanges')}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  disabled={!dirty || save.isPending}
                  onClick={() => setValues(gridValues(view, date))}
                >
                  {t('registrations.discard')}
                </Button>
                <Button
                  disabled={
                    changes.rows.length === 0 ||
                    Object.keys(changes.invalid).length > 0 ||
                    save.isPending
                  }
                  onClick={() => save.mutate()}
                >
                  {save.isPending
                    ? t('common.saving')
                    : t('registrations.saveDay', { day: weekdayName(date) })}
                </Button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/** BR-25: extra meals after the lock, with a required reason. */
function ExtraForm({
  view,
  date,
  employeeCode,
  onDone,
}: {
  view: RegistrationGridView;
  date: string;
  employeeCode: string;
  onDone: (ok: boolean) => void;
}) {
  const day = view.days.find((d) => d.date === date)!;
  const row = view.rows.find((r) => r.employeeCode === employeeCode)!;
  const [menuItemId, setMenuItemId] = useState(day.items[0]?.id ?? '');
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState('');
  const add = useMutation({
    mutationFn: () =>
      api.post(`/admin/registrations/employees/${encodeURIComponent(employeeCode)}/extras`, {
        date,
        menuItemId,
        quantity: Number(quantity),
        reason,
      }),
    onSuccess: () => onDone(true),
  });
  const valid = /^[1-9]\d*$/.test(quantity.trim()) && reason.trim().length > 0;
  return (
    <form
      className="flex flex-col gap-3 rounded-md border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) add.mutate();
      }}
    >
      <p className="font-medium">
        {t('registrations.extraTitle', { name: row.name, date: formatDate(date) })}
      </p>
      {add.error ? <Alert variant="error">{apiErrorText(add.error)}</Alert> : null}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-56 flex-col gap-2">
          <Label htmlFor="extra-dish">{t('registrations.extraDish')}</Label>
          <Select
            id="extra-dish"
            value={menuItemId}
            onChange={(e) => setMenuItemId(e.target.value)}
          >
            {day.items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.displayName}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex w-28 flex-col gap-2">
          <Label htmlFor="extra-qty">{t('registrations.extraQuantity')}</Label>
          <Input
            id="extra-qty"
            inputMode="numeric"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
        <div className="flex min-w-72 flex-1 flex-col gap-2">
          <Label htmlFor="extra-reason">{t('registrations.extraReason')}</Label>
          <Input
            id="extra-reason"
            value={reason}
            placeholder={t('registrations.extraReasonPlaceholder')}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={!valid || add.isPending}>
          {t('registrations.addExtra')}
        </Button>
        <Button type="button" variant="ghost" onClick={() => onDone(false)}>
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  );
}
