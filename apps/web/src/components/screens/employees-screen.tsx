'use client';

import type { EmployeeMappingView, MasterItemView, ResetPinResult } from '@meal/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Table, Td, Th } from '@/components/ui/table';
import { api } from '@/lib/api';
import { apiErrorText } from '@/lib/errors';
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

/**
 * /admin/employees: scoped finder (dept admins see their units), meal unit and roles,
 * cost-center override (HC / system admin, BR-63) and PIN reset with a one-time temporary PIN.
 */
export function EmployeesScreen({ canManageOrg }: { canManageOrg: boolean }) {
  const qc = useQueryClient();
  const [filters, setFilters] = useState<Filters>({
    q: '',
    mealStatus: '',
    status: 'ACTIVE',
    floorId: '',
    canteenId: '',
    costCenterId: '',
  });
  const [offset, setOffset] = useState(0);
  const [tempPin, setTempPin] = useState<{ name: string; pin: string } | null>(null);
  const [overrideFor, setOverrideFor] = useState<EmployeeMappingView | null>(null);

  const query = new URLSearchParams({ offset: String(offset), limit: String(PAGE) });
  for (const [k, v] of Object.entries(filters)) if (v) query.set(k, v.trim());
  const list = useQuery({
    queryKey: ['/employees', query.toString()],
    queryFn: () => api.get<{ total: number; items: EmployeeMappingView[] }>(`/employees?${query}`),
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
    onSuccess: (res, e) => setTempPin({ name: e.name, pin: res.temporaryPin }),
  });
  const setOverride = useMutation({
    mutationFn: ({ code, costCenterId }: { code: string; costCenterId: string | null }) =>
      api.put(`/employees/${encodeURIComponent(code)}/cost-center-override`, { costCenterId }),
    onSuccess: () => {
      setOverrideFor(null);
      void qc.invalidateQueries({ queryKey: ['/employees'] });
    },
  });

  const update = (patch: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setOffset(0);
  };
  const total = list.data?.total ?? 0;
  const error = list.error ?? resetPin.error ?? setOverride.error;

  const masterSelect = (id: keyof Filters, label: string, items: MasterItemView[] | undefined) => (
    <div className="flex w-48 flex-col gap-2">
      <Label htmlFor={`f-${id}`}>{label}</Label>
      <Select id={`f-${id}`} value={filters[id]} onChange={(e) => update({ [id]: e.target.value })}>
        <option value="">{t('common.all')}</option>
        {(items ?? []).map((o) => (
          <option key={o.id} value={o.id}>
            {o.code} · {o.name}
          </option>
        ))}
      </Select>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('employees.title')}</CardTitle>
        <CardDescription>{t('employees.intro')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3" aria-label={t('employees.filters')}>
          <div className="flex w-64 flex-col gap-2">
            <Label htmlFor="f-q">{t('common.search')}</Label>
            <Input id="f-q" value={filters.q} onChange={(e) => update({ q: e.target.value })} />
          </div>
          <div className="flex w-56 flex-col gap-2">
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
          <div className="flex w-40 flex-col gap-2">
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

        {tempPin ? (
          <Alert variant="warning" role="status">
            <p className="font-medium">
              {t('employees.temporaryPin', { name: tempPin.name, pin: tempPin.pin })}
            </p>
            <p>{t('employees.temporaryPinHint')}</p>
            <Button variant="ghost" size="sm" onClick={() => setTempPin(null)}>
              {t('banners.dismiss')}
            </Button>
          </Alert>
        ) : null}
        {error ? <Alert variant="error">{apiErrorText(error)}</Alert> : null}

        {overrideFor ? (
          <form
            className="flex flex-wrap items-end gap-3 rounded-md border p-4"
            onSubmit={(e) => {
              e.preventDefault();
              const value = new FormData(e.currentTarget).get('cc') as string;
              setOverride.mutate({ code: overrideFor.employeeCode, costCenterId: value || null });
            }}
          >
            <div className="flex min-w-72 flex-col gap-2">
              <Label htmlFor="override-cc">
                {t('employees.overrideTitle', { name: overrideFor.name })}
              </Label>
              <Select
                id="override-cc"
                name="cc"
                defaultValue={overrideFor.costCenterOverrideId ?? ''}
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
            </div>
            <Button type="submit" disabled={setOverride.isPending}>
              {t('common.save')}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOverrideFor(null)}>
              {t('common.cancel')}
            </Button>
          </form>
        ) : null}

        <p className="text-sm text-muted-foreground">{t('common.total', { count: total })}</p>
        <Table>
          <thead>
            <tr>
              <Th>{t('common.code')}</Th>
              <Th>{t('common.name')}</Th>
              <Th>{t('org.path')}</Th>
              <Th>{t('org.mealUnit')}</Th>
              <Th>{t('org.floor')}</Th>
              <Th>{t('org.costCenter')}</Th>
              <Th>{t('employees.roles')}</Th>
              <Th className="text-right">{t('common.actions')}</Th>
            </tr>
          </thead>
          <tbody>
            {(list.data?.items ?? []).map((e) => (
              <tr
                key={e.employeeCode}
                className={e.status === 'LEFT' ? 'text-muted-foreground' : undefined}
              >
                <Td className="font-mono">{e.employeeCode}</Td>
                <Td>{e.name}</Td>
                <Td className="text-xs">{e.orgPath}</Td>
                <Td>
                  {e.mealStatus === 'OK' ? (
                    e.mealUnitName
                  ) : (
                    <Badge variant="error">{vi.employees.mealStatuses[e.mealStatus]}</Badge>
                  )}
                </Td>
                <Td>{e.floorName ?? t('common.none')}</Td>
                <Td>
                  {e.costCenterName ?? t('common.none')}
                  {e.costCenterSource ? (
                    <span className="text-xs text-muted-foreground">
                      {' '}
                      ({vi.employees.costCenterSource[e.costCenterSource]})
                    </span>
                  ) : null}
                </Td>
                <Td className="text-xs">
                  {e.roles
                    .filter((r) => r !== 'EMPLOYEE')
                    .map((r) => vi.roles[r as keyof typeof vi.roles])
                    .join(', ')}
                </Td>
                <Td className="text-right">
                  <div className="flex justify-end gap-1">
                    {canManageOrg ? (
                      <Button variant="ghost" size="sm" onClick={() => setOverrideFor(e)}>
                        {t('employees.override')}
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={resetPin.isPending}
                      onClick={() =>
                        window.confirm(t('employees.resetPinConfirm', { name: e.name })) &&
                        resetPin.mutate(e)
                      }
                    >
                      {t('employees.resetPin')}
                    </Button>
                  </div>
                </Td>
              </tr>
            ))}
            {total === 0 && !list.isLoading ? (
              <tr>
                <Td colSpan={8} className="text-muted-foreground">
                  {t('employees.empty')}
                </Td>
              </tr>
            ) : null}
          </tbody>
        </Table>
        <div className="flex justify-end gap-2">
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
    </Card>
  );
}
