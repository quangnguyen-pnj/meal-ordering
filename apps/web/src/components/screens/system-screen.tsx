'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { EmployeePicker, type PickedEmployee } from '@/components/employee-picker';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useConfirm } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { LoadingRows } from '@/components/ui/skeleton';
import { Table, Td, Th } from '@/components/ui/table';
import { api } from '@/lib/api';
import { apiErrorText } from '@/lib/errors';
import { formatVnDateTime } from '@/lib/utils';
import { t, vi } from '@/messages';

type PrivilegedRole = 'HC_ADMIN' | 'SYS_ADMIN';

interface RoleRow {
  id: string;
  role: PrivilegedRole;
  employeeCode: string;
  name: string;
  createdAt: string;
}

interface SyncRunRow {
  id: string;
  type: keyof typeof vi.system.syncType;
  status: keyof typeof vi.system.syncStatus;
  startedAt: string;
  recordCount: number | null;
  error: string | null;
}

/** /system: HC and system admin roles (system admins only) and the sync log. */
export function SystemScreen() {
  const qc = useQueryClient();
  const [pick, setPick] = useState<PickedEmployee | null>(null);
  const [confirm, confirmElement] = useConfirm();
  const [role, setRole] = useState<PrivilegedRole>('HC_ADMIN');
  const roles = useQuery({
    queryKey: ['/system/roles'],
    queryFn: () => api.get<{ items: RoleRow[] }>('/system/roles'),
  });
  const runs = useQuery({
    queryKey: ['/system/sync-runs'],
    queryFn: () => api.get<{ items: SyncRunRow[] }>('/system/sync-runs'),
  });
  const assign = useMutation({
    mutationFn: (employeeCode: string) => api.post('/system/roles', { employeeCode, role }),
    onSuccess: () => {
      setPick(null);
      void qc.invalidateQueries({ queryKey: ['/system/roles'] });
    },
  });
  const revoke = useMutation({
    mutationFn: (id: string) => api.post(`/system/roles/${id}/revoke`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['/system/roles'] }),
  });
  const error = roles.error ?? assign.error ?? revoke.error;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('system.rolesTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (pick) assign.mutate(pick.employeeCode);
            }}
          >
            <div className="flex w-full flex-col gap-2 sm:w-80">
              <Label htmlFor="role-code">{t('employeePicker.label')}</Label>
              <EmployeePicker id="role-code" value={pick} onChange={setPick} />
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-56">
              <Label htmlFor="role-role">{t('system.role')}</Label>
              <Select
                id="role-role"
                value={role}
                onChange={(e) => setRole(e.target.value as PrivilegedRole)}
              >
                <option value="HC_ADMIN">{vi.roles.HC_ADMIN}</option>
                <option value="SYS_ADMIN">{vi.roles.SYS_ADMIN}</option>
              </Select>
            </div>
            <Button type="submit" disabled={!pick || assign.isPending}>
              {t('system.assign')}
            </Button>
          </form>
          {error ? <Alert variant="error">{apiErrorText(error)}</Alert> : null}
          {confirmElement}
          {roles.isLoading ? <LoadingRows rows={2} /> : null}
          <Table
            containerClassName={roles.isLoading ? 'hidden' : undefined}
            className="min-w-[36rem]"
          >
            <thead>
              <tr>
                <Th>{t('common.code')}</Th>
                <Th>{t('common.name')}</Th>
                <Th>{t('system.role')}</Th>
                <Th>{t('system.since')}</Th>
                <Th className="text-right">{t('common.actions')}</Th>
              </tr>
            </thead>
            <tbody>
              {(roles.data?.items ?? []).map((r) => (
                <tr key={r.id}>
                  <Td className="font-mono">{r.employeeCode}</Td>
                  <Td>{r.name}</Td>
                  <Td>{vi.roles[r.role]}</Td>
                  <Td>{formatVnDateTime(r.createdAt)}</Td>
                  <Td className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        const ok = await confirm({
                          title: t('system.revokeTitle'),
                          description: t('system.revokeConfirm', {
                            role: vi.roles[r.role],
                            name: r.name,
                          }),
                          confirmLabel: t('system.revoke'),
                          destructive: true,
                        });
                        if (ok) revoke.mutate(r.id);
                      }}
                    >
                      {t('system.revoke')}
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('system.syncTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          {runs.error ? <Alert variant="error">{apiErrorText(runs.error)}</Alert> : null}
          {runs.isLoading ? <LoadingRows rows={3} /> : null}
          <Table
            containerClassName={runs.isLoading ? 'hidden' : undefined}
            className="min-w-[36rem]"
          >
            <thead>
              <tr>
                <Th>{t('system.started')}</Th>
                <Th>{t('dishes.type')}</Th>
                <Th>{t('common.status')}</Th>
                <Th>{t('system.records')}</Th>
                <Th>{t('system.error')}</Th>
              </tr>
            </thead>
            <tbody>
              {(runs.data?.items ?? []).map((r) => (
                <tr key={r.id}>
                  <Td>{formatVnDateTime(r.startedAt)}</Td>
                  <Td>{vi.system.syncType[r.type]}</Td>
                  <Td>
                    <Badge
                      variant={
                        r.status === 'SUCCESS'
                          ? 'success'
                          : r.status === 'FAILED'
                            ? 'error'
                            : 'outline'
                      }
                    >
                      {vi.system.syncStatus[r.status]}
                    </Badge>
                  </Td>
                  <Td>{r.recordCount ?? t('common.none')}</Td>
                  <Td className="max-w-md truncate text-xs" title={r.error ?? undefined}>
                    {r.error ?? ''}
                  </Td>
                </tr>
              ))}
              {runs.data && runs.data.items.length === 0 ? (
                <tr>
                  <Td colSpan={5} className="text-muted-foreground">
                    {t('system.noSyncRuns')}
                  </Td>
                </tr>
              ) : null}
            </tbody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
