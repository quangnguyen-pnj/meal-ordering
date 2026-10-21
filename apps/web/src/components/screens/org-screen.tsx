'use client';

import type {
  EmployeeMappingView,
  MappingImportView,
  MasterItemView,
  OrgUnitView,
  OrgUnitUpdate,
} from '@meal/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmployeePicker, type PickedEmployee } from '@/components/employee-picker';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useConfirm } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { LoadingRows } from '@/components/ui/skeleton';
import { Table, Td, Th } from '@/components/ui/table';
import { Tabs } from '@/components/ui/tabs';
import { ApiError, api } from '@/lib/api';
import { apiErrorText } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { t, vi } from '@/messages';

type Tab = 'tree' | 'unassigned' | 'missingCostCenter' | 'importExport';

interface SyncResult {
  details: {
    orgUnits: { total: number; created: number; updated: number };
    employees: { total: number; created: number; updated: number };
  } | null;
}

/** /admin/org (BR-60..BR-64). */
export function OrgScreen() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('tree');
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const sync = useMutation({
    mutationFn: () => api.post<SyncResult>('/admin/org/sync'),
    onSuccess: (res) => {
      const d = res.details;
      setSyncNotice(
        d
          ? t('org.syncDone', {
              units: d.orgUnits.total,
              employees: d.employees.total,
              created: d.orgUnits.created + d.employees.created,
              updated: d.orgUnits.updated + d.employees.updated,
            })
          : null,
      );
      void qc.invalidateQueries();
    },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <CardTitle>{t('org.title')}</CardTitle>
            <CardDescription>{t('org.intro')}</CardDescription>
          </div>
          <Button variant="outline" disabled={sync.isPending} onClick={() => sync.mutate()}>
            {sync.isPending ? t('org.syncing') : t('org.sync')}
          </Button>
        </div>
        {sync.error ? <Alert variant="error">{apiErrorText(sync.error)}</Alert> : null}
        {syncNotice ? <Alert role="status">{syncNotice}</Alert> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Tabs
          label={t('org.title')}
          value={tab}
          onChange={setTab}
          tabs={(Object.keys(vi.org.tabs) as Tab[]).map((key) => ({
            key,
            label: vi.org.tabs[key],
          }))}
        />
        {tab === 'tree' ? <TreeTab /> : null}
        {tab === 'unassigned' ? <EmployeeList path="/admin/org/unassigned" showReason /> : null}
        {tab === 'missingCostCenter' ? (
          <EmployeeList path="/admin/org/missing-cost-center" />
        ) : null}
        {tab === 'importExport' ? <ImportExportTab /> : null}
      </CardContent>
    </Card>
  );
}

function useMaster(kind: 'floors' | 'canteens' | 'cost-centers') {
  return useQuery({
    queryKey: [`/admin/master/${kind}`],
    queryFn: () => api.get<{ items: MasterItemView[] }>(`/admin/master/${kind}`),
  });
}

function TreeTab() {
  const tree = useQuery({
    queryKey: ['/admin/org/tree'],
    queryFn: () => api.get<{ items: OrgUnitView[] }>('/admin/org/tree'),
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // null until the user expands or collapses something: then the first two levels are open.
  const [expandedState, setExpanded] = useState<ReadonlySet<string> | 'all' | null>(null);
  const [filter, setFilter] = useState('');

  const nodes = useMemo(() => tree.data?.items ?? [], [tree.data]);
  const expanded = useMemo(
    () => expandedState ?? new Set(nodes.filter((n) => n.level <= 2).map((n) => n.id)),
    [expandedState, nodes],
  );
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const children = useMemo(() => {
    const map = new Map<string | null, OrgUnitView[]>();
    for (const n of nodes) map.set(n.parentId, [...(map.get(n.parentId) ?? []), n]);
    return map;
  }, [nodes]);

  // With a filter, show matches and their ancestors, fully expanded.
  const visibleIds = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return null;
    const ids = new Set<string>();
    for (const n of nodes) {
      if (!n.name.toLowerCase().includes(q) && !n.dmpCode.toLowerCase().includes(q)) continue;
      for (
        let cur: OrgUnitView | undefined = n;
        cur;
        cur = cur.parentId ? byId.get(cur.parentId) : undefined
      ) {
        ids.add(cur.id);
      }
    }
    return ids;
  }, [filter, nodes, byId]);

  const isOpen = (id: string) => visibleIds !== null || expanded === 'all' || expanded.has(id);
  const toggle = (id: string) =>
    setExpanded(() => {
      const next = new Set(expanded === 'all' ? nodes.map((n) => n.id) : expanded);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const renderNode = (n: OrgUnitView, depth: number): React.ReactNode => {
    if (visibleIds && !visibleIds.has(n.id)) return null;
    const kids = children.get(n.id) ?? [];
    return (
      <li key={n.id}>
        <div
          className={cn(
            'flex min-h-11 items-center gap-1 rounded-md pr-2 text-sm hover:bg-accent',
            selectedId === n.id && 'bg-accent font-medium',
          )}
          style={{ paddingLeft: depth * 16 }}
        >
          {kids.length > 0 ? (
            <button
              type="button"
              className="p-1"
              aria-label={t('org.toggleNode', { name: n.name })}
              aria-expanded={isOpen(n.id)}
              onClick={() => toggle(n.id)}
            >
              {isOpen(n.id) ? (
                <ChevronDown className="h-4 w-4" aria-hidden />
              ) : (
                <ChevronRight className="h-4 w-4" aria-hidden />
              )}
            </button>
          ) : (
            <span className="w-6" />
          )}
          <button
            type="button"
            className="flex flex-1 flex-wrap items-center gap-2 py-1 text-left"
            onClick={() => setSelectedId(n.id)}
          >
            <span className={n.active ? undefined : 'text-muted-foreground line-through'}>
              {n.name}
            </span>
            <span className="font-mono text-xs text-muted-foreground">{n.dmpCode}</span>
            {n.isMealUnit ? (
              <Badge variant={n.mealUnitValid ? 'success' : 'error'}>
                {n.mealUnitValid ? t('org.mealUnit') : t('org.mealUnitInvalid')}
              </Badge>
            ) : null}
            {n.directHeadcount > 0 ? (
              <span className="text-xs text-muted-foreground">
                {t('org.headcount', { count: n.directHeadcount })}
              </span>
            ) : null}
          </button>
        </div>
        {kids.length > 0 && isOpen(n.id) ? (
          <ul>{kids.map((k) => renderNode(k, depth + 1))}</ul>
        ) : null}
      </li>
    );
  };

  if (tree.error) return <Alert variant="error">{apiErrorText(tree.error)}</Alert>;
  if (tree.isLoading) return <LoadingRows rows={8} />;
  const selected = selectedId ? byId.get(selectedId) : undefined;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_24rem]">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <Input
            className="w-full sm:max-w-xs"
            type="search"
            aria-label={t('org.filterTree')}
            placeholder={t('org.filterTree')}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <Button variant="ghost" size="sm" onClick={() => setExpanded('all')}>
            {t('org.expandAll')}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setExpanded(new Set())}>
            {t('org.collapseAll')}
          </Button>
        </div>
        <ul className="rounded-md border p-2">
          {(children.get(null) ?? []).map((n) => renderNode(n, 0))}
        </ul>
      </div>
      <div className="lg:sticky lg:top-4 lg:self-start">
        {selected ? (
          <NodeDetail key={selected.id} node={selected} byId={byId} />
        ) : (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            {t('org.selectNode')}
          </p>
        )}
      </div>
    </div>
  );
}

function NodeDetail({ node, byId }: { node: OrgUnitView; byId: Map<string, OrgUnitView> }) {
  const qc = useQueryClient();
  const floors = useMaster('floors');
  const canteens = useMaster('canteens');
  const costCenters = useMaster('cost-centers');
  const [adminPick, setAdminPick] = useState<PickedEmployee | null>(null);
  const [confirm, confirmElement] = useConfirm();
  // The last auto-saved change, so a misclick can be undone (each change is audited).
  const [lastChange, setLastChange] = useState<{ label: string; revert: OrgUnitUpdate } | null>(
    null,
  );
  const [undone, setUndone] = useState(false);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['/admin/org/tree'] });
    void qc.invalidateQueries({ queryKey: ['/admin/org/unassigned'] });
    void qc.invalidateQueries({ queryKey: ['/admin/org/missing-cost-center'] });
  };

  const update = useMutation({
    mutationFn: (v: { patch: OrgUnitUpdate; label: string; revert: OrgUnitUpdate | null }) =>
      api.patch(`/admin/org/units/${node.id}`, v.patch),
    onSuccess: (_res, v) => {
      setLastChange(v.revert ? { label: v.label, revert: v.revert } : null);
      setUndone(v.revert === null);
      refresh();
    },
  });
  const change = (patch: OrgUnitUpdate, label: string) => {
    const [key] = Object.keys(patch) as Array<keyof OrgUnitUpdate>;
    const revert: OrgUnitUpdate =
      key === 'isMealUnit'
        ? { isMealUnit: node.isMealUnit }
        : { [key as 'floorId']: node.own[key as 'floorId'] };
    update.mutate({ patch, label, revert });
  };
  const assign = useMutation({
    mutationFn: (code: string) =>
      api.post(`/admin/org/units/${node.id}/dept-admins`, { employeeCode: code }),
    onSuccess: () => {
      setAdminPick(null);
      refresh();
    },
  });
  const revoke = useMutation({
    mutationFn: (assignmentId: string) => api.post(`/admin/org/dept-admins/${assignmentId}/revoke`),
    onSuccess: refresh,
  });
  const error = update.error ?? assign.error ?? revoke.error;

  const field = (
    key: 'floorId' | 'canteenId' | 'costCenterId',
    resolvedKey: 'floor' | 'canteen' | 'costCenter',
    label: string,
    options: MasterItemView[],
  ) => {
    const resolved = node.resolved[resolvedKey];
    const nameOf = (id: string | null) =>
      options.find((o) => o.id === id)?.name ?? t('common.notSet');
    // With an own value the parent's value is not known here, so the option stays generic.
    const inheritLabel =
      node.own[key] !== null
        ? t('common.inheritFromParent')
        : resolved.id === null
          ? `${t('common.inherit')}: ${t('common.notSet')}`
          : `${t('common.inherit')}: ${nameOf(resolved.id)} (${t('common.inheritedFrom', {
              source: byId.get(resolved.sourceNodeId ?? '')?.name ?? '',
            })})`;
    return (
      <div className="flex flex-col gap-2">
        <Label htmlFor={`node-${key}`}>{label}</Label>
        <Select
          id={`node-${key}`}
          value={node.own[key] ?? ''}
          disabled={update.isPending}
          onChange={(e) => change({ [key]: e.target.value || null }, label)}
        >
          <option value="">{inheritLabel}</option>
          {options
            .filter((o) => o.active || o.id === node.own[key])
            .map((o) => (
              <option key={o.id} value={o.id}>
                {o.code} · {o.name}
              </option>
            ))}
        </Select>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4 rounded-md border p-4">
      {confirmElement}
      <div>
        <p className="font-medium">{node.name}</p>
        <p className="text-xs text-muted-foreground">
          {node.dmpCode} · {t('org.level', { level: node.level })} · {node.dmpLevelName}
          {node.active ? '' : ` · ${t('org.inactiveNode')}`}
        </p>
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={node.isMealUnit}
          disabled={update.isPending}
          onChange={(e) => change({ isMealUnit: e.target.checked }, t('org.mealUnit'))}
        />
        {t('org.mealUnit')}
        {node.isMealUnit && !node.mealUnitValid ? (
          <Badge variant="error">{t('org.mealUnitInvalid')}</Badge>
        ) : null}
      </label>
      {lastChange || undone ? (
        <Alert role="status" className="flex items-center justify-between gap-2 py-2">
          <span>
            {undone ? t('org.undone') : t('org.autoSaved', { field: lastChange?.label ?? '' })}
          </span>
          {lastChange && !undone ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={update.isPending}
              onClick={() =>
                update.mutate({ patch: lastChange.revert, label: lastChange.label, revert: null })
              }
            >
              {t('common.undo')}
            </Button>
          ) : null}
        </Alert>
      ) : null}
      {field('floorId', 'floor', t('org.floor'), floors.data?.items ?? [])}
      {field('canteenId', 'canteen', t('org.canteen'), canteens.data?.items ?? [])}
      {field('costCenterId', 'costCenter', t('org.costCenter'), costCenters.data?.items ?? [])}

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">{t('org.deptAdmins')}</p>
        <ul className="flex flex-col gap-1 text-sm">
          {node.deptAdmins.map((a) => (
            <li key={a.assignmentId} className="flex items-center justify-between gap-2">
              <span>
                {a.name}{' '}
                <span className="font-mono text-xs text-muted-foreground">{a.employeeCode}</span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  const ok = await confirm({
                    title: t('org.revokeTitle'),
                    description: t('org.revokeConfirm', { name: a.name, unit: node.name }),
                    confirmLabel: t('org.revoke'),
                    destructive: true,
                  });
                  if (ok) revoke.mutate(a.assignmentId);
                }}
              >
                {t('org.revoke')}
              </Button>
            </li>
          ))}
        </ul>
        {node.deptAdmins.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('org.noDeptAdmin')}</p>
        ) : null}
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (adminPick) assign.mutate(adminPick.employeeCode);
          }}
        >
          <Label htmlFor={`dept-admin-${node.id}`} className="sr-only">
            {t('org.addDeptAdmin')}
          </Label>
          <EmployeePicker id={`dept-admin-${node.id}`} value={adminPick} onChange={setAdminPick} />
          <Button
            type="submit"
            variant="outline"
            className="self-start"
            disabled={assign.isPending || !adminPick}
          >
            {t('org.addDeptAdmin')}
          </Button>
        </form>
      </div>
      {error ? <Alert variant="error">{apiErrorText(error)}</Alert> : null}
    </div>
  );
}

function EmployeeList({ path, showReason = false }: { path: string; showReason?: boolean }) {
  const list = useQuery({
    queryKey: [path],
    queryFn: () => api.get<{ items: EmployeeMappingView[] }>(path),
  });
  if (list.error) return <Alert variant="error">{apiErrorText(list.error)}</Alert>;
  if (list.isLoading) return <LoadingRows rows={6} />;
  const items = list.data?.items ?? [];
  const reason = (e: EmployeeMappingView) =>
    e.mealStatus === 'NO_MEAL_UNIT'
      ? t('org.reasonNoMealUnit')
      : t('org.reasonInvalid', {
          missing: e.missing.map((m) => vi.org.missingParts[m]).join(', '),
        });
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">{t('common.total', { count: items.length })}</p>
      <Table className="min-w-[40rem]">
        <thead>
          <tr>
            <Th>{t('common.code')}</Th>
            <Th>{t('common.name')}</Th>
            <Th>{t('org.path')}</Th>
            {showReason ? <Th>{t('common.reason')}</Th> : <Th>{t('org.mealUnit')}</Th>}
          </tr>
        </thead>
        <tbody>
          {items.map((e) => (
            <tr key={e.employeeCode}>
              <Td className="font-mono">{e.employeeCode}</Td>
              <Td>{e.name}</Td>
              <Td>{e.orgPath}</Td>
              <Td>{showReason ? reason(e) : (e.mealUnitName ?? t('common.none'))}</Td>
            </tr>
          ))}
          {items.length === 0 && !list.isLoading ? (
            <tr>
              <Td colSpan={4} className="text-muted-foreground">
                {t('org.emptyList')}
              </Td>
            </tr>
          ) : null}
        </tbody>
      </Table>
    </div>
  );
}

const codeOrDash = (v: string | null) => v ?? t('common.none');

function ImportExportTab() {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<MappingImportView | null>(null);

  const exportFile = useMutation({
    mutationFn: () => api.download('/admin/org/mapping/export', 'mapping-to-chuc.xlsx'),
  });
  const upload = useMutation({
    mutationFn: (f: File) => api.upload<MappingImportView>('/admin/org/mapping/imports', f),
    onSuccess: setResult,
  });
  const apply = useMutation({
    mutationFn: (id: string) =>
      api.post<MappingImportView>(`/admin/org/mapping/imports/${id}/apply`),
    onSuccess: (res) => {
      setResult(res);
      void qc.invalidateQueries();
    },
  });

  const fileError = (error: unknown) => {
    if (error instanceof ApiError && Array.isArray(error.details)) {
      const code = (error.details[0] as { message?: string } | undefined)?.message;
      const known = vi.org.fileErrors as Record<string, string>;
      if (code && known[code]) return known[code];
    }
    return apiErrorText(error);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="flex flex-col gap-2">
        <p className="font-medium">{t('org.exportTitle')}</p>
        <p className="text-sm text-muted-foreground">{t('org.exportHint')}</p>
        <div>
          <Button
            variant="outline"
            disabled={exportFile.isPending}
            onClick={() => exportFile.mutate()}
          >
            {t('common.download')}
          </Button>
        </div>
        {exportFile.error ? <Alert variant="error">{apiErrorText(exportFile.error)}</Alert> : null}
      </section>
      <section className="flex flex-col gap-2">
        <p className="font-medium">{t('org.importTitle')}</p>
        <p className="text-sm text-muted-foreground">{t('org.importHint')}</p>
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (file) upload.mutate(file);
          }}
        >
          <Label htmlFor="mapping-file" className="sr-only">
            {t('org.chooseFile')}
          </Label>
          <Input
            id="mapping-file"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="max-w-xs"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setResult(null);
            }}
          />
          <Button type="submit" disabled={!file || upload.isPending}>
            {t('org.upload')}
          </Button>
        </form>
        {upload.error ? <Alert variant="error">{fileError(upload.error)}</Alert> : null}
        {apply.error ? <Alert variant="error">{apiErrorText(apply.error)}</Alert> : null}
      </section>

      {result ? (
        <section className="flex flex-col gap-3 lg:col-span-2">
          {result.status === 'REJECTED' ? (
            <>
              <Alert variant="error">{t('org.rejected', { count: result.errorCount })}</Alert>
              <Table>
                <thead>
                  <tr>
                    <Th>{t('org.row')}</Th>
                    <Th>{t('org.field')}</Th>
                    <Th>{t('org.value')}</Th>
                    <Th>{t('org.error')}</Th>
                  </tr>
                </thead>
                <tbody>
                  {result.errors.map((e, i) => (
                    <tr key={i}>
                      <Td>{e.rowNumber}</Td>
                      <Td>{vi.org.fields[e.field]}</Td>
                      <Td className="font-mono">{e.value || t('common.none')}</Td>
                      <Td>{vi.org.rowErrors[e.code]}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </>
          ) : (
            <>
              <Alert role="status">
                {result.status === 'APPLIED'
                  ? t('org.applied', { count: result.changes.length })
                  : result.changes.length === 0
                    ? t('org.noChanges')
                    : t('org.preview', { count: result.changes.length, rows: result.rowCount })}
              </Alert>
              {result.changes.length > 0 ? (
                <Table>
                  <thead>
                    <tr>
                      <Th>{t('org.row')}</Th>
                      <Th>{t('common.code')}</Th>
                      <Th>{t('common.name')}</Th>
                      <Th>{t('org.floor')}</Th>
                      <Th>{t('org.canteen')}</Th>
                      <Th>{t('org.costCenter')}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.changes.map((c) => (
                      <tr key={c.rowNumber}>
                        <Td>{c.rowNumber}</Td>
                        <Td className="font-mono">{c.code}</Td>
                        <Td>{c.name}</Td>
                        {(['floorCode', 'canteenCode', 'costCenterCode'] as const).map((k) => (
                          <Td
                            key={k}
                            className={
                              c.before[k] !== c.after[k] ? 'font-medium' : 'text-muted-foreground'
                            }
                          >
                            {c.before[k] === c.after[k]
                              ? codeOrDash(c.after[k])
                              : `${codeOrDash(c.before[k])} → ${codeOrDash(c.after[k])}`}
                          </Td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : null}
              {result.status === 'PREVIEW' && result.changes.length > 0 ? (
                <div>
                  <Button disabled={apply.isPending} onClick={() => apply.mutate(result.id)}>
                    {t('org.apply')}
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}
