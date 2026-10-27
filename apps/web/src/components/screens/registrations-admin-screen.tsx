'use client';

import {
  addDays,
  type GridSaveResult,
  type NotRegisteredView,
  type OrgFilterOption,
  type RegistrationGridView,
  type RegistrationImportView,
  type RegistrationProgressView,
} from '@meal/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileSpreadsheet } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AppDialog } from '@/components/app-dialog';
import { useConfirm } from '@/components/confirm-dialog';
import { DishName } from '@/components/dish-name';
import { ExcelImportDialog } from '@/components/excel-import-dialog';
import { OrgLevelFilter } from '@/components/org-level-filter';
import { ResponsiveSelect } from '@/components/responsive-select';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingRows } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WeekNav } from '@/components/week-nav';
import { ApiError, api } from '@/lib/api';
import { apiErrorText } from '@/lib/errors';
import { columnTotals, gridChanges, gridValues, type GridValues } from '@/lib/grid-draft';
import { cn, formatDate, formatVnTime } from '@/lib/utils';
import { t, vi } from '@/messages';
import { weekdayName } from './day-meals';
import {
  CanteenPicker,
  UnitPicker,
  useRegistrationGrid,
  useRegistrationUnits,
} from './registration-admin-shared';

type SelectionErrorKey = keyof typeof vi.registrations.selectionErrors;

const isRegistrationQuery = (key: readonly unknown[]) =>
  String(key[0]).startsWith('/admin/registrations');

/**
 * /admin/registrations (plan 4.1, J2): progress by unit, the not-registered list (BR-21) and the
 * bulk-entry grid, usable on a 768 px tablet. Dept admins see their units, HC admins the factory.
 */
export function RegistrationsAdminScreen() {
  const units = useRegistrationUnits();
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const home = units.data?.upcomingWeekStart;
  const week = weekStart ?? home ?? null;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <CardTitle>{t('registrations.title')}</CardTitle>
            <CardDescription>{t('registrations.intro')}</CardDescription>
          </div>
          {week ? <WeekNav weekStart={week} onChange={setWeekStart} homeWeekStart={home} /> : null}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {units.error ? <Alert variant="destructive">{apiErrorText(units.error)}</Alert> : null}
        {units.isLoading ? <LoadingRows rows={3} /> : null}
        {week ? (
          <Tabs defaultValue="progress">
            <TabsList aria-label={t('registrations.title')}>
              <TabsTrigger value="progress">{t('registrations.tabs.progress')}</TabsTrigger>
              <TabsTrigger value="notRegistered">
                {t('registrations.tabs.notRegistered')}
              </TabsTrigger>
              <TabsTrigger value="grid">{t('registrations.tabs.grid')}</TabsTrigger>
            </TabsList>
            <TabsContent value="progress">
              <ProgressTab weekStart={week} />
            </TabsContent>
            <TabsContent value="notRegistered">
              <NotRegisteredTab weekStart={week} />
            </TabsContent>
            <TabsContent value="grid">
              <GridTab weekStart={week} />
            </TabsContent>
          </Tabs>
        ) : null}
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
  if (query.error) return <Alert variant="destructive">{apiErrorText(query.error)}</Alert>;
  if (!query.data) return <LoadingRows />;
  if (query.data.units.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('registrations.noUnits')}</p>;
  }
  return (
    <Table className="min-w-[36rem]">
      <TableHeader>
        <TableRow>
          <TableHead>{t('registrations.mealUnit')}</TableHead>
          <TableHead className="text-right">{t('registrations.headcount')}</TableHead>
          <TableHead className="text-right">{t('registrations.registered')}</TableHead>
          <TableHead className="text-right">{t('registrations.notRegistered')}</TableHead>
          <TableHead className="text-right">{t('registrations.meals')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {query.data.units.map((u) => {
          const pct = u.headcount > 0 ? Math.round((u.registered / u.headcount) * 100) : 0;
          return (
            <TableRow key={u.mealUnitId}>
              <TableCell>
                <p className="font-medium">{u.name}</p>
                <p className="text-xs text-muted-foreground">{u.pathName}</p>
                {!u.published ? (
                  <Badge variant="warning" className="mt-1">
                    {t('registrations.notPublished')}
                  </Badge>
                ) : null}
              </TableCell>
              <TableCell className="text-right tabular-nums">{u.headcount}</TableCell>
              <TableCell className="text-right tabular-nums">
                {u.registered}{' '}
                <span className="text-xs text-muted-foreground">
                  {t('registrations.progressPct', { pct })}
                </span>
              </TableCell>
              <TableCell className="text-right tabular-nums">{u.notRegistered}</TableCell>
              <TableCell className="text-right tabular-nums">{u.meals}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function NotRegisteredTab({ weekStart }: { weekStart: string }) {
  const [date, setDate] = useState('');
  const [orgUnitId, setOrgUnitId] = useState('');
  const query = useQuery({
    queryKey: ['/admin/registrations/not-registered', weekStart, date, orgUnitId],
    queryFn: () => {
      const q = new URLSearchParams({ weekStart });
      if (date) q.set('date', date);
      if (orgUnitId) q.set('orgUnitId', orgUnitId);
      return api.get<NotRegisteredView>(`/admin/registrations/not-registered?${q}`);
    },
  });
  // Khối / Trung tâm / Phòng ban filter, within the caller's scope.
  const orgUnits = useQuery({
    queryKey: ['/admin/registrations/org-units'],
    queryFn: () => api.get<{ items: OrgFilterOption[] }>('/admin/registrations/org-units'),
  });
  const options = [
    { value: '', label: t('registrations.allWeek') },
    ...[0, 1, 2, 3, 4, 5, 6].map((i) => {
      const d = addDays(weekStart, i);
      return { value: d, label: `${weekdayName(d)} ${formatDate(d)}` };
    }),
  ];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex w-full flex-col gap-2 sm:w-56">
          <Label htmlFor="nr-day">{t('history.date')}</Label>
          <ResponsiveSelect id="nr-day" value={date} onValueChange={setDate} options={options} />
        </div>
        <OrgLevelFilter
          id="nr-org"
          options={orgUnits.data?.items ?? []}
          value={orgUnitId}
          onChange={setOrgUnitId}
        />
      </div>
      {query.error ? <Alert variant="destructive">{apiErrorText(query.error)}</Alert> : null}
      {query.isLoading ? <LoadingRows /> : null}
      {query.data && query.data.total === 0 ? (
        <p className="text-sm text-muted-foreground">{t('registrations.noOne')}</p>
      ) : null}
      {query.data && query.data.total > 0 ? (
        <>
          <p className="text-sm">{t('registrations.listTotal', { count: query.data.total })}</p>
          <Table className="min-w-[36rem]">
            <TableHeader>
              <TableRow>
                <TableHead>{t('common.code')}</TableHead>
                <TableHead>{t('common.name')}</TableHead>
                <TableHead>{t('registrations.unit')}</TableHead>
                <TableHead>{t('registrations.mealUnit')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data.items.map((e) => (
                <TableRow key={e.employeeCode}>
                  <TableCell className="tabular-nums">{e.employeeCode}</TableCell>
                  <TableCell className="font-medium">{e.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{e.orgPath}</TableCell>
                  <TableCell>{e.mealUnitName}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      ) : null}
    </div>
  );
}

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
  const [confirm, confirmDialog] = useConfirm();
  const [unitId, setUnitId] = useState('');
  const [canteenId, setCanteenId] = useState('');
  const [date, setDate] = useState('');
  const [values, setValues] = useState<GridValues>({});
  const [extraFor, setExtraFor] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const grid = useRegistrationGrid(unitId, weekStart, canteenId);
  const view = grid.data;

  // A new grid (unit, week, save) resets the values; switching days goes through pickDay.
  useEffect(() => {
    if (!view || view.state !== 'PUBLISHED') return;
    const d = view.days.some((x) => x.date === date) ? date : (view.days[0]?.date ?? '');
    setDate(d);
    setValues(gridValues(view, d));
  }, [view]);

  const day = view?.days.find((d) => d.date === date);
  const changes = view && day ? gridChanges(view, date, values) : { rows: [], invalid: {} };
  const invalidCount = Object.keys(changes.invalid).length;
  const dirty = changes.rows.length > 0 || invalidCount > 0;

  const save = useMutation({
    mutationFn: () =>
      api.put<GridSaveResult>(
        `/admin/registrations/units/${encodeURIComponent(unitId)}/days/${date}`,
        { canteenId: view!.canteenId, rows: changes.rows },
      ),
    onSuccess: async (res) => {
      toast.success(
        t('registrations.savedDay', { changed: res.changedEmployees, meals: res.meals }),
      );
      await qc.invalidateQueries({ predicate: (q) => isRegistrationQuery(q.queryKey) });
    },
  });
  const serverRowErrors = rowErrorsFrom(save.error);

  async function pickDay(d: string) {
    if (d === date) return;
    if (
      dirty &&
      !(await confirm({
        title: t('registrations.leaveConfirm'),
        confirmLabel: t('registrations.discard'),
      }))
    )
      return;
    setDate(d);
    save.reset();
    if (view) setValues(gridValues(view, d));
  }

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
    <div className="flex flex-col gap-4">
      {confirmDialog}
      <div className="flex flex-wrap items-end gap-3">
        <UnitPicker
          id="grid-unit"
          units={units.data?.items ?? []}
          value={unitId}
          canteenId={view?.canteenId ?? null}
          onChange={(id) => {
            setUnitId(id);
            setCanteenId('');
            save.reset();
          }}
        />
        <CanteenPicker id="grid-canteen" grid={view} onChange={setCanteenId} />
        {view?.state === 'PUBLISHED' && view.days.some((d) => d.window === 'ON_BEHALF') ? (
          <Button variant="outline" className="ml-auto" onClick={() => setImportOpen(true)}>
            <FileSpreadsheet className="h-4 w-4" aria-hidden />
            {t('registrations.import.open')}
          </Button>
        ) : null}
      </div>
      {view?.state === 'PUBLISHED' ? (
        <WeekImport
          open={importOpen}
          onClose={() => setImportOpen(false)}
          unitId={unitId}
          weekStart={weekStart}
          canteenId={view.canteenId!}
          unsavedDay={dirty}
          onApplied={async () => {
            await qc.invalidateQueries({ predicate: (q) => isRegistrationQuery(q.queryKey) });
          }}
        />
      ) : null}
      {grid.error ? <Alert variant="destructive">{apiErrorText(grid.error)}</Alert> : null}
      {grid.isLoading ? <LoadingRows /> : null}
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
          <Tabs value={date} onValueChange={(d) => void pickDay(d)}>
            <TabsList aria-label={t('registrations.tabs.grid')}>
              {view.days.map((d) => (
                <TabsTrigger key={d.date} value={d.date}>
                  {weekdayName(d.date)} {formatDate(d.date).slice(0, 5)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Alert variant={editable ? 'default' : 'warning'}>
            <p>{t(`registrations.windows.${day.window}`, { lock: formatVnTime(day.lockAt) })}</p>
            {editable ? (
              <p className="text-xs text-muted-foreground">{t('registrations.gridHint')}</p>
            ) : null}
          </Alert>
          {save.error && Object.keys(serverRowErrors).length === 0 ? (
            <Alert variant="destructive">{apiErrorText(save.error)}</Alert>
          ) : null}

          <Table>
            <TableHeader className="bg-muted">
              <TableRow className="hover:bg-transparent">
                <TableHead className="sticky left-0 z-10 bg-muted px-2">
                  {t('registrations.employee')}
                </TableHead>
                {day.items.map((i) => (
                  <TableHead
                    key={i.id}
                    className="min-w-20 whitespace-normal px-2 text-center normal-case tracking-normal"
                  >
                    <DishName type={i.type} displayName={i.displayName} />
                  </TableHead>
                ))}
                <TableHead className="px-2 text-right">{t('registrations.total')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
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
                const hasError = invalid.length > 0 || errors.length > 0;
                return (
                  <TableRow
                    key={row.employeeCode}
                    className={cn('hover:bg-transparent', hasError && 'bg-destructive/5')}
                  >
                    <TableCell
                      className={cn(
                        'sticky left-0 z-10 min-w-36 bg-card px-2 py-1.5',
                        hasError && 'bg-destructive/5',
                      )}
                    >
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
                        {cell.extra ? (
                          <Badge variant="secondary">{t('registrations.extra')}</Badge>
                        ) : null}
                        {cell.needsReselect > 0 ? (
                          <Badge variant="warning">
                            {t('registrations.needsReselect', { count: cell.needsReselect })}
                          </Badge>
                        ) : null}
                      </div>
                      {invalid.length > 0 ? (
                        <p className="text-xs text-destructive">{t('registrations.invalidCell')}</p>
                      ) : null}
                      {errors.length > 0 ? (
                        <p className="text-xs text-destructive">
                          {t('registrations.rowError', { errors: errors.join(', ') })}
                        </p>
                      ) : null}
                      {day.window === 'EXTRA' && !cell.blocked ? (
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto px-0"
                          onClick={() => setExtraFor(row.employeeCode)}
                        >
                          {t('registrations.addExtra')}
                        </Button>
                      ) : null}
                    </TableCell>
                    {day.items.map((i, c) => (
                      <TableCell key={i.id} className="px-1 py-1.5 text-center">
                        <Input
                          data-cell={`${r}:${c}`}
                          inputMode="numeric"
                          aria-label={`${row.name} · ${i.displayName}`}
                          aria-invalid={invalid.includes(i.id)}
                          disabled={!editable || cell.blocked}
                          value={values[row.employeeCode]?.[i.id] ?? ''}
                          onKeyDown={(e) => moveDown(e, r, c)}
                          onChange={(e) => {
                            const v = e.target.value;
                            setValues((prev) => ({
                              ...prev,
                              [row.employeeCode]: { ...prev[row.employeeCode], [i.id]: v },
                            }));
                          }}
                          className="mx-auto w-16 text-center tabular-nums"
                        />
                      </TableCell>
                    ))}
                    <TableCell className="px-2 text-right font-medium tabular-nums">
                      {rowTotal}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <tfoot className="bg-muted/60 font-semibold">
              <tr>
                <td className="sticky left-0 z-10 bg-muted px-2 py-3">
                  {t('registrations.total')}
                </td>
                {day.items.map((i) => (
                  <td key={i.id} className="px-2 py-3 text-center tabular-nums">
                    {totals[i.id] ?? 0}
                  </td>
                ))}
                <td className="px-2 py-3 text-right tabular-nums">
                  {Object.values(totals).reduce((s, n) => s + n, 0)}
                </td>
              </tr>
            </tfoot>
          </Table>

          <ExtraDialog
            view={view}
            date={date}
            employeeCode={extraFor}
            onClose={() => setExtraFor(null)}
            onSaved={async () => {
              setExtraFor(null);
              toast.success(t('registrations.extraSaved'));
              await qc.invalidateQueries({ predicate: (q) => isRegistrationQuery(q.queryKey) });
            }}
          />

          {editable && dirty ? (
            <div className="sticky bottom-0 z-20 -mx-6 flex flex-wrap items-center justify-between gap-3 bg-card px-6 py-3 shadow-[0_-6px_16px_-6px_rgb(41_37_36/0.12)]">
              <p className="text-sm" role="status">
                {invalidCount > 0
                  ? t('registrations.invalidRows', { count: invalidCount })
                  : t('registrations.unsaved')}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={save.isPending}
                  onClick={() => {
                    setValues(gridValues(view, date));
                    save.reset();
                  }}
                >
                  {t('registrations.discard')}
                </Button>
                <Button
                  disabled={changes.rows.length === 0 || invalidCount > 0 || save.isPending}
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
function ExtraDialog({
  view,
  date,
  employeeCode,
  onClose,
  onSaved,
}: {
  view: RegistrationGridView;
  date: string;
  employeeCode: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const day = view.days.find((d) => d.date === date);
  const row = view.rows.find((r) => r.employeeCode === employeeCode);
  const [menuItemId, setMenuItemId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState('');
  const add = useMutation({
    mutationFn: () =>
      api.post(`/admin/registrations/employees/${encodeURIComponent(employeeCode!)}/extras`, {
        date,
        menuItemId: menuItemId || day!.items[0]!.id,
        quantity: Number(quantity),
        reason,
      }),
    onSuccess: () => {
      setQuantity('1');
      setReason('');
      onSaved();
    },
  });
  const valid = /^[1-9]\d*$/.test(quantity.trim()) && reason.trim().length > 0;

  return (
    <AppDialog
      open={employeeCode !== null && !!row && !!day}
      onClose={() => {
        add.reset();
        onClose();
      }}
      title={t('registrations.extraTitle', { name: row?.name ?? '', date: formatDate(date) })}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button form="extra-form" type="submit" disabled={!valid || add.isPending}>
            {add.isPending ? t('common.saving') : t('registrations.addExtra')}
          </Button>
        </>
      }
    >
      <form
        id="extra-form"
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) add.mutate();
        }}
      >
        {add.error ? <Alert variant="destructive">{apiErrorText(add.error)}</Alert> : null}
        <div className="flex flex-col gap-2">
          <Label htmlFor="extra-dish">{t('registrations.extraDish')}</Label>
          <ResponsiveSelect
            id="extra-dish"
            value={menuItemId || day?.items[0]?.id || ''}
            onValueChange={setMenuItemId}
            options={(day?.items ?? []).map((i) => ({ value: i.id, label: i.displayName }))}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="extra-qty">{t('registrations.extraQuantity')}</Label>
          <Input
            id="extra-qty"
            inputMode="numeric"
            className="w-28"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="extra-reason">{t('registrations.extraReason')}</Label>
          <Input
            id="extra-reason"
            value={reason}
            placeholder={t('registrations.extraReasonPlaceholder')}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
      </form>
    </AppDialog>
  );
}

/**
 * The unit's week as an Excel file (2026-10-23): download it filled with the current quantities,
 * edit it, check it, then save every changed day at once. The grid's rules apply (BR-21).
 */
function WeekImport({
  open,
  onClose,
  unitId,
  weekStart,
  canteenId,
  unsavedDay,
  onApplied,
}: {
  open: boolean;
  onClose: () => void;
  unitId: string;
  weekStart: string;
  canteenId: string;
  unsavedDay: boolean;
  onApplied: () => Promise<void>;
}) {
  const base = `/admin/registrations/units/${encodeURIComponent(unitId)}`;
  const query = `weekStart=${weekStart}&canteenId=${encodeURIComponent(canteenId)}`;
  return (
    <ExcelImportDialog<RegistrationImportView>
      open={open}
      onClose={onClose}
      title={t('registrations.import.title')}
      hint={`${t('registrations.import.hint')}${unsavedDay ? ` ${t('registrations.unsaved')}` : ''}`}
      template={{
        path: `${base}/import-template?${query}`,
        fileName: `dang-ky-${weekStart}.xlsx`,
      }}
      labels={{
        template: t('registrations.import.template'),
        file: t('registrations.import.file'),
        check: t('registrations.import.check'),
      }}
      upload={(file, apply) =>
        api.upload<RegistrationImportView>(`${base}/import?${query}&apply=${apply}`, file)
      }
      summarize={(r) =>
        r.status === 'REJECTED'
          ? {
              text: t('registrations.import.rejected', { count: r.errors.length }),
              errors: r.errors.map((e) =>
                t('registrations.import.rowError', {
                  row: e.rowNumber,
                  error: vi.registrations.import.errors[e.code],
                  value: e.value || t('common.none'),
                }),
              ),
              applyLabel: null,
            }
          : {
              text:
                r.status === 'APPLIED'
                  ? t('registrations.import.applied', {
                      employees: r.changedEmployees,
                      days: r.changedDays,
                    })
                  : r.changedDays === 0
                    ? t('registrations.import.nothing')
                    : t('registrations.import.preview', {
                        employees: r.changedEmployees,
                        days: r.changedDays,
                      }),
              errors: [],
              applyLabel:
                r.changedDays > 0 ? t('registrations.import.apply', { days: r.changedDays }) : null,
            }
      }
      onApplied={(r) => {
        toast.success(
          t('registrations.import.applied', { employees: r.changedEmployees, days: r.changedDays }),
        );
        void onApplied();
      }}
    />
  );
}
