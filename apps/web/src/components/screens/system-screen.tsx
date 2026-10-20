'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
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
  const [code, setCode] = useState('');
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
    mutationFn: () => api.post('/system/roles', { employeeCode: code.trim(), role }),
    onSuccess: () => {
      setCode('');
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
              if (code.trim()) assign.mutate();
            }}
          >
            <div className="flex w-56 flex-col gap-2">
              <Label htmlFor="role-code">{t('org.employeeCode')}</Label>
              <Input id="role-code" value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
            <div className="flex w-56 flex-col gap-2">
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
            <Button type="submit" disabled={!code.trim() || assign.isPending}>
              {t('system.assign')}
            </Button>
          </form>
          {error ? <Alert variant="error">{apiErrorText(error)}</Alert> : null}
          <Table>
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
                      onClick={() =>
                        window.confirm(
                          t('system.revokeConfirm', { role: vi.roles[r.role], name: r.name }),
                        ) && revoke.mutate(r.id)
                      }
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
          <Table>
            <thead>
              <tr>
                <Th>{t('system.started')}</Th>
                <Th>{t('dishes.type')}</Th>
                <Th />
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
            </tbody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
