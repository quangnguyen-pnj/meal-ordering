'use client';

import type { EmployeeMappingView, MasterItemView, ResetPinResult } from '@meal/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, useConfirm } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { LoadingRows } from '@/components/ui/skeleton';
import { Table, Td, Th } from '@/components/ui/table';
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
    <Badge variant="error">{vi.employees.mealStatuses[e.mealStatus]}</Badge>
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
  const [tempPin, setTempPin] = useState<{ name: string; code: string; pin: string } | null>(null);
  const [overrideFor, setOverrideFor] = useState<EmployeeMappingView | null>(null);
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
    mutationFn: (e: EmployeeMappingView) =>
      api.post<ResetPinResult>(`/employees/${encodeURIComponent(e.employeeCode)}/pin/reset`),
    onSuccess: (res, e) =>
      setTempPin({ name: e.name, code: e.employeeCode, pin: res.temporaryPin }),
  });
  const setOverride = useMutation({
    mutationFn: ({ code, costCenterId }: { code: string; costCenterId: string | null }) =>
      api.put(`/employees/${encodeURIComponent(code)}/cost-center-override`, { costCenterId }),
    onSuccess: () => {
      setOverrideFor(null);
      void qc.invalidateQueries({ queryKey: ['/employees'] });
    },
  });

  async function askResetPin(e: EmployeeMappingView) {
    const ok = await confirm({
      title: t('employees.resetPinTitle'),
      description: t('employees.resetPinConfirm', { name: e.name }),
      confirmLabel: t('employees.resetPin'),
    });
    if (ok) resetPin.mutate(e);
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
      <Select id={`f-${id}`} value={filters[id]} onChange={(e) => update({ [id]: e.target.value })}>
        <option value="">{t('common.all')}</option>
        {(options ?? []).map((o) => (
          <option key={o.id} value={o.id}>
            {o.code} · {o.name}
          </option>
        ))}
      </Select>
    </div>
  );

  const actions = (e: EmployeeMappingView) => (
    <>
      {canManageOrg ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setOverride.reset();
            setOverrideFor(e);
          }}
        >
          {t('employees.override')}
        </Button>
      ) : null}
      <Button
        variant="ghost"
        size="sm"
        disabled={resetPin.isPending}
        onClick={() => askResetPin(e)}
      >
        {t('employees.resetPin')}
      </Button>
    </>
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
            <Select
              id="f-meal"
              value={filters.mealStatus}
              onChange={(e) => update({ mealStatus: e.target.value })}
            >
              <option value="">{t('common.all')}</option>
              {Object.entries(vi.employees.mealStatuses).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-40">
            <Label htmlFor="f-status">{t('employees.statusFilter')}</Label>
            <Select
              id="f-status"
              value={filters.status}
              onChange={(e) => update({ status: e.target.value })}
            >
              <option value="">{t('common.all')}</option>
              <option value="ACTIVE">{vi.employees.status.ACTIVE}</option>
              <option value="LEFT">{vi.employees.status.LEFT}</option>
            </Select>
          </div>
          {canManageOrg ? (
            <>
              {masterSelect('floorId', t('org.floor'), floors.data?.items)}
              {masterSelect('canteenId', t('org.canteen'), canteens.data?.items)}
              {masterSelect('costCenterId', t('org.costCenter'), costCenters.data?.items)}
            </>
          ) : null}
        </div>

        {error ? <Alert variant="error">{apiErrorText(error)}</Alert> : null}

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
                  className={`rounded-md border p-3 text-sm ${e.status === 'LEFT' ? 'text-muted-foreground' : ''}`}
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
                  <div className="-mx-3 -mb-2 mt-1 flex flex-wrap justify-end">{actions(e)}</div>
                </li>
              ))}
            </ul>

            <Table containerClassName="hidden md:block" className="min-w-[56rem]">
              <thead>
                <tr>
                  <Th>{t('employees.employee')}</Th>
                  <Th>{t('org.path')}</Th>
                  <Th>{t('org.mealUnit')}</Th>
                  <Th>{t('org.floor')}</Th>
                  <Th>{t('org.costCenter')}</Th>
                  <Th>{t('employees.roles')}</Th>
                  <Th className="text-right">{t('common.actions')}</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((e) => (
                  <tr
                    key={e.employeeCode}
                    className={e.status === 'LEFT' ? 'text-muted-foreground' : undefined}
                  >
                    <Td className="whitespace-nowrap">
                      <span className="font-medium">{e.name}</span>
                      <span className="block font-mono text-xs text-muted-foreground">
                        {e.employeeCode}
                      </span>
                    </Td>
                    <Td className="min-w-44 max-w-60 text-xs" title={e.orgPath}>
                      {shortOrgPath(e.orgPath)}
                    </Td>
                    <Td className="whitespace-nowrap">
                      <MealUnit e={e} />
                    </Td>
                    <Td className="whitespace-nowrap">{e.floorName ?? t('common.none')}</Td>
                    <Td className="min-w-52">
                      <CostCenter e={e} />
                    </Td>
                    <Td className="text-xs">{roleText(e)}</Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-1">{actions(e)}</div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            {total === 0 ? (
              <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
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

      <Dialog
        open={tempPin !== null}
        onClose={() => setTempPin(null)}
        dismissible={false}
        title={t('employees.temporaryPinTitle')}
        description={tempPin ? `${tempPin.name} · ${tempPin.code}` : undefined}
        footer={
          <Button data-autofocus onClick={() => setTempPin(null)}>
            {t('employees.temporaryPinDone')}
          </Button>
        }
      >
        <p className="my-2 rounded-md border bg-muted py-4 text-center font-mono text-4xl font-semibold tracking-[0.3em]">
          {tempPin?.pin}
        </p>
        <Alert variant="warning">{t('employees.temporaryPinHint')}</Alert>
      </Dialog>

      <Dialog
        open={overrideFor !== null}
        onClose={() => setOverrideFor(null)}
        title={t('employees.overrideTitle', { name: overrideFor?.name ?? '' })}
        description={t('employees.overrideHint')}
      >
        <form
          id="override-form"
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!overrideFor) return;
            const value = new FormData(e.currentTarget).get('cc') as string;
            setOverride.mutate({ code: overrideFor.employeeCode, costCenterId: value || null });
          }}
        >
          <Label htmlFor="override-cc">{t('org.costCenter')}</Label>
          <Select
            id="override-cc"
            name="cc"
            data-autofocus
            defaultValue={overrideFor?.costCenterOverrideId ?? ''}
          >
            <option value="">{t('employees.clearOverride')}</option>
            {(costCenters.data?.items ?? [])
              .filter((c) => c.active)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} · {c.name}
                </option>
              ))}
          </Select>
          {setOverride.error ? (
            <Alert variant="error">{apiErrorText(setOverride.error)}</Alert>
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
      </Dialog>
    </Card>
  );
}
