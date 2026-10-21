'use client';

import type { EmployeeMappingView, MasterItemView, ResetPinResult } from '@meal/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, MoreHorizontal, Wallet } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { AppDialog } from '@/components/app-dialog';
import { returnFocus, useConfirm } from '@/components/confirm-dialog';
import { ResponsiveSelect } from '@/components/responsive-select';
import { Alert } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useDebounced } from '@/hooks/use-debounced';
import { api } from '@/lib/api';
import { apiErrorText } from '@/lib/errors';
import { formatRange } from '@/lib/utils';
import { t, vi } from '@/messages';

const PAGE = 50;

interface Filters {
  q: string;
  mealStatus: string;
  status: string;
  floorId: string;
  canteenId: string;
  costCenterId: string;
}

/** The last two levels of an org path ("Tổ Nhẫn / Nhóm Nhẫn 1"); the full path goes in a tooltip. */
export function shortOrgPath(path: string): string {
  const parts = path.split(' / ');
  return parts.length <= 2 ? path : `… / ${parts.slice(-2).join(' / ')}`;
}

const roleText = (e: EmployeeMappingView) =>
  e.roles
    .filter((r) => r !== 'EMPLOYEE')
    .map((r) => vi.roles[r as keyof typeof vi.roles])
    .join(', ');

function MealUnit({ e }: { e: EmployeeMappingView }) {
  return e.mealStatus === 'OK' ? (
    <>{e.mealUnitName}</>
  ) : (
    <Badge variant="destructive">{vi.employees.mealStatuses[e.mealStatus]}</Badge>
  );
}

function CostCenter({ e }: { e: EmployeeMappingView }) {
  return (
    <>
      {e.costCenterName ?? t('common.none')}
      {e.costCenterSource ? (
        <span className="block text-xs text-muted-foreground">
          {vi.employees.costCenterSource[e.costCenterSource]}
        </span>
      ) : null}
    </>
  );
}

/**
 * /admin/employees: scoped finder (dept admins see their units), meal unit and roles,
 * cost-center override (HC / system admin, BR-63) and PIN reset with a one-time temporary PIN.
 */
export function EmployeesScreen({ canManageOrg }: { canManageOrg: boolean }) {
  const qc = useQueryClient();
  const [confirm, confirmElement] = useConfirm();
  const [filters, setFilters] = useState<Filters>({
    q: '',
    mealStatus: '',
    status: 'ACTIVE',
    floorId: '',
    canteenId: '',
    costCenterId: '',
  });
  const [offset, setOffset] = useState(0);
  const [tempPin, setTempPin] = useState<{
    name: string;
    code: string;
    pin: string;
    trigger: HTMLElement | null;
  } | null>(null);
  // The row's menu button goes with each dialog, so focus can return to it afterwards.
  const [overrideFor, setOverrideFor] = useState<{
    employee: EmployeeMappingView;
    trigger: HTMLElement | null;
  } | null>(null);
  const [overrideCc, setOverrideCc] = useState('');
  const q = useDebounced(filters.q.trim());

  const query = new URLSearchParams({ offset: String(offset), limit: String(PAGE) });
  for (const [k, v] of Object.entries({ ...filters, q })) if (v) query.set(k, v.trim());
  const list = useQuery({
    queryKey: ['/employees', query.toString()],
    queryFn: () => api.get<{ total: number; items: EmployeeMappingView[] }>(`/employees?${query}`),
    placeholderData: (prev) => prev,
  });
  const floors = useQuery({
    queryKey: ['/admin/master/floors'],
    queryFn: () => api.get<{ items: MasterItemView[] }>('/admin/master/floors'),
    enabled: canManageOrg,
  });
  const canteens = useQuery({
    queryKey: ['/admin/master/canteens'],
    queryFn: () => api.get<{ items: MasterItemView[] }>('/admin/master/canteens'),
    enabled: canManageOrg,
  });
  const costCenters = useQuery({
    queryKey: ['/admin/master/cost-centers'],
    queryFn: () => api.get<{ items: MasterItemView[] }>('/admin/master/cost-centers'),
    enabled: canManageOrg,
  });

  const resetPin = useMutation({
    mutationFn: ({ e }: { e: EmployeeMappingView; trigger: HTMLElement | null }) =>
      api.post<ResetPinResult>(`/employees/${encodeURIComponent(e.employeeCode)}/pin/reset`),
    onSuccess: (res, { e, trigger }) =>
      setTempPin({ name: e.name, code: e.employeeCode, pin: res.temporaryPin, trigger }),
  });
  const setOverride = useMutation({
    mutationFn: ({ code, costCenterId }: { code: string; costCenterId: string | null }) =>
      api.put(`/employees/${encodeURIComponent(code)}/cost-center-override`, { costCenterId }),
    onSuccess: () => {
      setOverrideFor(null);
      toast.success(t('employees.overrideSaved'));
      void qc.invalidateQueries({ queryKey: ['/employees'] });
    },
  });

  async function askResetPin(e: EmployeeMappingView, trigger: HTMLElement | null) {
    const ok = await confirm({
      title: t('employees.resetPinTitle'),
      description: t('employees.resetPinConfirm', { name: e.name }),
      confirmLabel: t('employees.resetPin'),
      returnFocusTo: trigger,
    });
    if (ok) resetPin.mutate({ e, trigger });
  }

  const update = (patch: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setOffset(0);
  };
  const items = list.data?.items ?? [];
  const total = list.data?.total ?? 0;
  const error = list.error ?? resetPin.error;

  const masterSelect = (
    id: keyof Filters,
    label: string,
    options: MasterItemView[] | undefined,
  ) => (
    <div className="flex w-full flex-col gap-2 sm:w-48">
      <Label htmlFor={`f-${id}`}>{label}</Label>
      <ResponsiveSelect
        id={`f-${id}`}
        value={filters[id]}
        onValueChange={(v) => update({ [id]: v })}
        options={[
          { value: '', label: t('common.all') },
          ...(options ?? []).map((o) => ({ value: o.id, label: `${o.code} · ${o.name}` })),
        ]}
      />
    </div>
  );

  const actions = (e: EmployeeMappingView) => (
    <RowActions
      employee={e}
      canManageOrg={canManageOrg}
      resetPending={resetPin.isPending}
      onOverride={(trigger) => {
        setOverride.reset();
        setOverrideCc(e.costCenterOverrideId ?? '');
        setOverrideFor({ employee: e, trigger });
      }}
      onResetPin={(trigger) => askResetPin(e, trigger)}
    />
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('employees.title')}</CardTitle>
        <CardDescription>{t('employees.intro')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div
          role="group"
          className="grid grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap"
          aria-label={t('employees.filters')}
        >
          <div className="col-span-2 flex w-full flex-col gap-2 sm:w-64">
            <Label htmlFor="f-q">{t('common.search')}</Label>
            <Input
              id="f-q"
              type="search"
              value={filters.q}
              onChange={(e) => update({ q: e.target.value })}
            />
          </div>
          <div className="col-span-2 flex w-full flex-col gap-2 sm:w-56">
            <Label htmlFor="f-meal">{t('employees.mealStatus')}</Label>
            <ResponsiveSelect
              id="f-meal"
              value={filters.mealStatus}
              onValueChange={(v) => update({ mealStatus: v })}
              options={[
                { value: '', label: t('common.all') },
                ...Object.entries(vi.employees.mealStatuses).map(([k, label]) => ({
                  value: k,
                  label,
                })),
              ]}
            />
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-40">
            <Label htmlFor="f-status">{t('employees.statusFilter')}</Label>
            <ResponsiveSelect
              id="f-status"
              value={filters.status}
              onValueChange={(v) => update({ status: v })}
              options={[
                { value: '', label: t('common.all') },
                { value: 'ACTIVE', label: vi.employees.status.ACTIVE },
                { value: 'LEFT', label: vi.employees.status.LEFT },
              ]}
            />
          </div>
          {canManageOrg ? (
            <>
              {masterSelect('floorId', t('org.floor'), floors.data?.items)}
              {masterSelect('canteenId', t('org.canteen'), canteens.data?.items)}
              {masterSelect('costCenterId', t('org.costCenter'), costCenters.data?.items)}
            </>
          ) : null}
        </div>

        {error ? <Alert variant="destructive">{apiErrorText(error)}</Alert> : null}

        <p className="text-sm text-muted-foreground" aria-live="polite">
          {list.data ? formatRange(offset, items.length, total) : ' '}
        </p>

        {list.isLoading ? (
          <LoadingRows rows={8} />
        ) : (
          <>
            {/* Phones: one card per employee. */}
            <ul className="flex flex-col gap-2 md:hidden">
              {items.map((e) => (
                <li
                  key={e.employeeCode}
                  className={`rounded-lg bg-card p-4 text-sm shadow-block ${e.status === 'LEFT' ? 'text-muted-foreground' : ''}`}
                >
                  <p className="font-medium">
                    {e.name}{' '}
                    <span className="font-mono text-xs text-muted-foreground">
                      {e.employeeCode}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">{e.orgPath}</p>
                  <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                    <dt className="text-muted-foreground">{t('org.mealUnit')}</dt>
                    <dd>
                      <MealUnit e={e} />
                    </dd>
                    <dt className="text-muted-foreground">{t('org.floor')}</dt>
                    <dd>{e.floorName ?? t('common.none')}</dd>
                    <dt className="text-muted-foreground">{t('org.costCenter')}</dt>
                    <dd>
                      <CostCenter e={e} />
                    </dd>
                    {roleText(e) ? (
                      <>
                        <dt className="text-muted-foreground">{t('employees.roles')}</dt>
                        <dd>{roleText(e)}</dd>
                      </>
                    ) : null}
                  </dl>
                  <div className="-mb-1 -mr-2 flex justify-end">{actions(e)}</div>
                </li>
              ))}
            </ul>

            <Table containerClassName="hidden md:block" className="min-w-[56rem]">
              <TableHeader>
                <TableRow>
                  <TableHead>{t('employees.employee')}</TableHead>
                  <TableHead>{t('org.path')}</TableHead>
                  <TableHead>{t('org.mealUnit')}</TableHead>
                  <TableHead>{t('org.floor')}</TableHead>
                  <TableHead>{t('org.costCenter')}</TableHead>
                  <TableHead>{t('employees.roles')}</TableHead>
                  <TableHead className="text-right">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((e) => (
                  <TableRow
                    key={e.employeeCode}
                    className={e.status === 'LEFT' ? 'text-muted-foreground' : undefined}
                  >
                    <TableCell className="whitespace-nowrap">
                      <span className="font-medium">{e.name}</span>
                      <span className="block font-mono text-xs text-muted-foreground">
                        {e.employeeCode}
                      </span>
                    </TableCell>
                    <TableCell className="min-w-36 max-w-44 text-xs">
                      <Tooltip>
                        <TooltipTrigger className="text-left">
                          {shortOrgPath(e.orgPath)}
                        </TooltipTrigger>
                        <TooltipContent>{e.orgPath}</TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <MealUnit e={e} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {e.floorName ?? t('common.none')}
                    </TableCell>
                    <TableCell className="min-w-44">
                      <CostCenter e={e} />
                    </TableCell>
                    <TableCell className="text-xs">{roleText(e)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end">{actions(e)}</div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {total === 0 ? (
              <p className="rounded-lg bg-muted/50 p-8 text-center text-sm text-muted-foreground">
                {t('employees.empty')}
              </p>
            ) : null}
          </>
        )}

        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE))}
          >
            {t('common.previous')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={offset + PAGE >= total}
            onClick={() => setOffset(offset + PAGE)}
          >
            {t('common.next')}
          </Button>
        </div>
      </CardContent>

      {confirmElement}

      {/* An AlertDialog: the one-time PIN closes only with the button, never by a stray click. */}
      <AlertDialog open={tempPin !== null}>
        <AlertDialogContent onCloseAutoFocus={(ev) => returnFocus(ev, tempPin?.trigger)}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('employees.temporaryPinTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {tempPin ? `${tempPin.name} · ${tempPin.code}` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <p className="rounded-lg bg-muted py-4 text-center font-mono text-4xl font-semibold tracking-[0.3em]">
            {tempPin?.pin}
          </p>
          <Alert variant="warning">{t('employees.temporaryPinHint')}</Alert>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setTempPin(null)}>
              {t('employees.temporaryPinDone')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AppDialog
        open={overrideFor !== null}
        onClose={() => setOverrideFor(null)}
        returnFocusTo={overrideFor?.trigger}
        title={t('employees.overrideTitle', { name: overrideFor?.employee.name ?? '' })}
        description={t('employees.overrideHint')}
      >
        <form
          id="override-form"
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!overrideFor) return;
            setOverride.mutate({
              code: overrideFor.employee.employeeCode,
              costCenterId: overrideCc || null,
            });
          }}
        >
          <Label htmlFor="override-cc">{t('org.costCenter')}</Label>
          <ResponsiveSelect
            id="override-cc"
            value={overrideCc}
            onValueChange={setOverrideCc}
            options={[
              { value: '', label: t('employees.clearOverride') },
              ...(costCenters.data?.items ?? [])
                .filter((c) => c.active)
                .map((c) => ({ value: c.id, label: `${c.code} · ${c.name}` })),
            ]}
          />
          {setOverride.error ? (
            <Alert variant="destructive">{apiErrorText(setOverride.error)}</Alert>
          ) : null}
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setOverrideFor(null)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={setOverride.isPending}>
              {setOverride.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        </form>
      </AppDialog>
    </Card>
  );
}

/** The row's "…" menu (shadcn/ui DropdownMenu). Its button is where focus returns afterwards. */
function RowActions({
  employee: e,
  canManageOrg,
  resetPending,
  onOverride,
  onResetPin,
}: {
  employee: EmployeeMappingView;
  canManageOrg: boolean;
  resetPending: boolean;
  onOverride: (trigger: HTMLElement | null) => void;
  onResetPin: (trigger: HTMLElement | null) => void;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          ref={trigger}
          variant="ghost"
          size="icon"
          aria-label={t('employees.actionsFor', { name: e.name })}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="max-w-56 truncate">{e.name}</DropdownMenuLabel>
        {canManageOrg ? (
          <DropdownMenuItem onSelect={() => onOverride(trigger.current)}>
            <Wallet aria-hidden />
            {t('employees.override')}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem disabled={resetPending} onSelect={() => onResetPin(trigger.current)}>
          <KeyRound aria-hidden />
          {t('employees.resetPin')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
