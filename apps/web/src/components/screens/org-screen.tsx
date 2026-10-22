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
import {
  headcountByMealUnit,
  indexTree,
  mealUnitsInheriting,
  nodePath,
  subtree,
  unassignedBelow,
  type OrgTreeIndex,
} from '@/lib/org-tree';
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

/** "tầng, nhà ăn": what a meal unit still lacks (BR-63). */
const missingParts = (n: OrgUnitView) =>
  (['floor', 'canteen'] as const)
    .filter((k) => n.resolved[k].id === null)
    .map((k) => vi.org.missingParts[k])
    .join(', ');

function useMasterName(kind: 'floors' | 'canteens') {
  const list = useMaster(kind);
  return (id: string | null) =>
    list.data?.items.find((o) => o.id === id)?.name ?? t('common.notSet');
}

type TreeView = 'tree' | 'mealUnits';

function TreeTab() {
  const tree = useQuery({
    queryKey: ['/admin/org/tree'],
    queryFn: () => api.get<{ items: OrgUnitView[] }>('/admin/org/tree'),
  });
  const [view, setView] = useState<TreeView>('tree');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<string> | 'all'>(new Set());
  const [filter, setFilter] = useState('');

  const nodes = tree.data?.items ?? [];
  const idx = useMemo(() => indexTree(nodes), [nodes]);
  const { byId, children } = idx;
  const mealCounts = useMemo(() => headcountByMealUnit(nodes), [nodes]);
  const unassigned = useMemo(() => unassignedBelow(idx), [idx]);

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
    setExpanded((prev) => {
      const next = new Set(prev === 'all' ? nodes.map((n) => n.id) : prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // BR-60: a meal unit shows its group size, other nodes name the meal unit they follow.
  const mealTag = (n: OrgUnitView) => {
    if (n.isMealUnit) {
      const count = mealCounts.get(n.id) ?? 0;
      return (
        <Badge variant={n.mealUnitValid ? 'default' : 'error'}>
          {n.mealUnitValid
            ? t('org.mealUnitBadge', { count })
            : t('org.mealUnitInvalidBadge', { missing: missingParts(n), count })}
        </Badge>
      );
    }
    if (n.mealUnitId) {
      return (
        <span className="text-xs text-muted-foreground">
          <span aria-hidden>→ </span>
          <span className="sr-only">{t('org.followsMealUnit')} </span>
          {byId.get(n.mealUnitId)?.name}
        </span>
      );
    }
    const count = unassigned.get(n.id) ?? 0;
    return count > 0 ? (
      <Badge variant="warning">{t('org.noMealUnitBadge', { count })}</Badge>
    ) : null;
  };

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
            {mealTag(n)}
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
  const selected = selectedId ? byId.get(selectedId) : undefined;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_24rem]">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <Input
            className="max-w-xs"
            aria-label={t('org.filterTree')}
            placeholder={t('org.filterTree')}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <div
            role="group"
            aria-label={t('org.viewLabel')}
            className="flex rounded-md border p-0.5"
          >
            {(['tree', 'mealUnits'] as const).map((v) => (
              <Button
                key={v}
                variant="ghost"
                size="sm"
                className={cn(view === v && 'bg-accent font-medium')}
                aria-pressed={view === v}
                onClick={() => setView(v)}
              >
                {v === 'tree' ? t('org.viewTree') : t('org.viewMealUnits')}
              </Button>
            ))}
          </div>
          {view === 'tree' ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => setExpanded('all')}>
                {t('org.expandAll')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setExpanded(new Set())}>
                {t('org.collapseAll')}
              </Button>
            </>
          ) : null}
        </div>
        {view === 'tree' ? (
          <ul className="rounded-md border p-2">
            {(children.get(null) ?? []).map((n) => renderNode(n, 0))}
          </ul>
        ) : (
          <MealUnitList
            idx={idx}
            mealCounts={mealCounts}
            filter={filter.trim().toLowerCase()}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        )}
      </div>
      <div>
        {selected ? (
          <NodeDetail key={selected.id} node={selected} idx={idx} />
        ) : (
          <p className="text-sm text-muted-foreground">{t('org.selectNode')}</p>
        )}
      </div>
    </div>
  );
}

/** Every meal unit of the factory on one screen: the groups meals are delivered to (BR-60). */
function MealUnitList({
  idx,
  mealCounts,
  filter,
  selectedId,
  onSelect,
}: {
  idx: OrgTreeIndex;
  mealCounts: Map<string | null, number>;
  filter: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const floorName = useMasterName('floors');
  const canteenName = useMasterName('canteens');
  const all = [...idx.byId.values()].filter((n) => n.isMealUnit);
  const units = filter
    ? all.filter(
        (n) => n.name.toLowerCase().includes(filter) || n.dmpCode.toLowerCase().includes(filter),
      )
    : all;
  const nameOr = (id: string | null, name: (id: string | null) => string) =>
    id === null ? t('common.none') : name(id);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        {t('org.mealUnitsSummary', { count: all.length, unassigned: mealCounts.get(null) ?? 0 })}
      </p>
      <Table>
        <thead>
          <tr>
            <Th>{t('org.mealUnit')}</Th>
            <Th>{t('org.path')}</Th>
            <Th>{t('org.mealUnitPeople')}</Th>
            <Th>{t('org.floor')}</Th>
            <Th>{t('org.canteen')}</Th>
            <Th>{t('org.mealUnitState')}</Th>
          </tr>
        </thead>
        <tbody>
          {units.map((n) => (
            <tr key={n.id} className={cn(selectedId === n.id && 'bg-accent')}>
              <Td>
                <button
                  type="button"
                  className="min-h-11 text-left font-medium underline-offset-4 hover:underline"
                  onClick={() => onSelect(n.id)}
                >
                  {n.name}
                </button>
              </Td>
              <Td>{nodePath(n.id, idx)}</Td>
              <Td>{mealCounts.get(n.id) ?? 0}</Td>
              <Td>{nameOr(n.resolved.floor.id, floorName)}</Td>
              <Td>{nameOr(n.resolved.canteen.id, canteenName)}</Td>
              <Td>
                {n.mealUnitValid ? (
                  <Badge variant="success">{t('org.mealUnitOk')}</Badge>
                ) : (
                  <Badge variant="error">
                    {t('org.mealUnitMissing', { missing: missingParts(n) })}
                  </Badge>
                )}
              </Td>
            </tr>
          ))}
          {units.length === 0 ? (
            <tr>
              <Td colSpan={6} className="text-muted-foreground">
                {t('org.noMealUnits')}
              </Td>
            </tr>
          ) : null}
        </tbody>
      </Table>
    </div>
  );
}

/** BR-60 / BR-63: where the employees of this node get their meal, in words. */
function mealStatus(
  node: OrgUnitView,
  idx: OrgTreeIndex,
  floorName: (id: string | null) => string,
  canteenName: (id: string | null) => string,
): { text: string; warn: boolean } {
  const below = headcountByMealUnit(subtree(node.id, idx));
  const count = below.get(node.mealUnitId) ?? 0;
  const others = [...below.values()].reduce((a, b) => a + b, 0) - count;
  const mealUnit = node.mealUnitId ? idx.byId.get(node.mealUnitId) : undefined;

  let text: string;
  let warn: boolean;
  if (!mealUnit) {
    text = count > 0 ? t('org.statusNone', { count }) : t('org.statusNoneEmpty');
    warn = count > 0;
  } else {
    const own = mealUnit.id === node.id;
    const place = {
      floor: floorName(mealUnit.resolved.floor.id),
      canteen: canteenName(mealUnit.resolved.canteen.id),
    };
    const missing = missingParts(mealUnit);
    warn = !mealUnit.mealUnitValid;
    if (own) {
      text = warn
        ? t('org.statusOwnInvalid', { count, missing })
        : t('org.statusOwn', { count, ...place });
    } else {
      text = warn
        ? t('org.statusInheritedInvalid', { count, name: mealUnit.name, missing })
        : t('org.statusInherited', { count, name: mealUnit.name, ...place });
    }
  }
  if (others > 0) text = `${text} ${t('org.statusOthersBelow', { count: others })}`;
  return { text, warn };
}

/** BR-62 / BR-63: which meal units a floor or canteen set here would reach. */
function reachHint(node: OrgUnitView, key: 'floorId' | 'canteenId', idx: OrgTreeIndex) {
  if (node.isMealUnit) return null;
  const reached = mealUnitsInheriting(node.id, key, idx);
  if (reached.length > 0) {
    const shown = reached
      .slice(0, 3)
      .map((n) => n.name)
      .join(', ');
    const names =
      reached.length > 3 ? t('org.andMore', { names: shown, count: reached.length - 3 }) : shown;
    return { effective: true, text: t('org.appliesToBelow', { names }) };
  }
  const anyBelow = [...subtree(node.id, idx)].some((n) => n.isMealUnit);
  return {
    effective: false,
    text: anyBelow ? t('org.noEffectOverridden') : t('org.noEffectNoMealUnit'),
  };
}

function NodeDetail({ node, idx }: { node: OrgUnitView; idx: OrgTreeIndex }) {
  const qc = useQueryClient();
  const floors = useMaster('floors');
  const canteens = useMaster('canteens');
  const costCenters = useMaster('cost-centers');
  const floorName = useMasterName('floors');
  const canteenName = useMasterName('canteens');
  const [adminCode, setAdminCode] = useState('');
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['/admin/org/tree'] });
    void qc.invalidateQueries({ queryKey: ['/admin/org/unassigned'] });
    void qc.invalidateQueries({ queryKey: ['/admin/org/missing-cost-center'] });
  };

  const update = useMutation({
    mutationFn: (patch: OrgUnitUpdate) => api.patch(`/admin/org/units/${node.id}`, patch),
    onSuccess: refresh,
  });
  const assign = useMutation({
    mutationFn: () =>
      api.post(`/admin/org/units/${node.id}/dept-admins`, { employeeCode: adminCode.trim() }),
    onSuccess: () => {
      setAdminCode('');
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
    hint: { effective: boolean; text: string } | null = null,
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
              source: idx.byId.get(resolved.sourceNodeId ?? '')?.name ?? '',
            })})`;
    return (
      <div className={cn('flex flex-col gap-2', hint && !hint.effective && 'opacity-60')}>
        <Label htmlFor={`node-${key}`}>{label}</Label>
        <Select
          id={`node-${key}`}
          value={node.own[key] ?? ''}
          disabled={update.isPending}
          aria-describedby={hint ? `node-${key}-hint` : undefined}
          onChange={(e) => update.mutate({ [key]: e.target.value || null })}
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
        {hint ? (
          <p id={`node-${key}-hint`} className="text-xs text-muted-foreground">
            {hint.text}
          </p>
        ) : null}
      </div>
    );
  };

  const parent = node.parentId ? idx.byId.get(node.parentId) : undefined;
  const parentMealUnit = parent?.mealUnitId ? idx.byId.get(parent.mealUnitId) : undefined;
  const status = mealStatus(node, idx, floorName, canteenName);
  const choices = [
    { value: true, label: t('org.isMealUnitYes'), hint: t('org.isMealUnitYesHint') },
    {
      value: false,
      label: t('org.isMealUnitNo'),
      hint: parentMealUnit
        ? t('org.isMealUnitNoHintParent', { name: parentMealUnit.name })
        : t('org.isMealUnitNoHintNone'),
    },
  ];

  return (
    <div className="flex flex-col gap-6 rounded-md border p-4">
      <div>
        <p className="font-medium">{node.name}</p>
        <p className="text-xs text-muted-foreground">
          {node.dmpCode} · {t('org.level', { level: node.level })} · {node.dmpLevelName}
          {node.active ? '' : ` · ${t('org.inactiveNode')}`}
        </p>
      </div>

      <section className="flex flex-col gap-4">
        <h3 className="font-medium">{t('org.mealSection')}</h3>
        <fieldset className="flex flex-col gap-1" disabled={update.isPending}>
          <legend className="mb-1 text-sm font-medium">{t('org.isMealUnitQuestion')}</legend>
          {choices.map((c) => (
            <label key={String(c.value)} className="flex min-h-11 items-start gap-2 py-1 text-sm">
              <input
                type="radio"
                className="mt-1"
                name={`meal-unit-${node.id}`}
                checked={node.isMealUnit === c.value}
                onChange={() => update.mutate({ isMealUnit: c.value })}
              />
              <span>
                <span className="font-medium">{c.label}</span>
                <span className="block text-muted-foreground">{c.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <Alert variant={status.warn ? 'warning' : 'info'}>
          <span className="font-medium">{t('org.statusTitle')}: </span>
          {status.text}
        </Alert>
        {field(
          'floorId',
          'floor',
          t('org.floor'),
          floors.data?.items ?? [],
          reachHint(node, 'floorId', idx),
        )}
        {field(
          'canteenId',
          'canteen',
          t('org.canteen'),
          canteens.data?.items ?? [],
          reachHint(node, 'canteenId', idx),
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h3 className="font-medium">{t('org.costSection')}</h3>
          <p className="text-xs text-muted-foreground">{t('org.costSectionHint')}</p>
        </div>
        {field('costCenterId', 'costCenter', t('org.costCenter'), costCenters.data?.items ?? [])}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="font-medium">{t('org.deptAdmins')}</h3>
        <ul className="flex flex-col gap-1 text-sm">
          {node.deptAdmins.map((a) => (
            <li key={a.assignmentId} className="flex items-center justify-between gap-2">
              <span>
                {a.name}{' '}
                <span className="font-mono text-xs text-muted-foreground">{a.employeeCode}</span>
              </span>
              <Button variant="ghost" size="sm" onClick={() => revoke.mutate(a.assignmentId)}>
                {t('org.revoke')}
              </Button>
            </li>
          ))}
        </ul>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (adminCode.trim()) assign.mutate();
          }}
        >
          <Input
            aria-label={t('org.employeeCode')}
            placeholder={t('org.employeeCode')}
            value={adminCode}
            onChange={(e) => setAdminCode(e.target.value)}
          />
          <Button type="submit" variant="outline" disabled={assign.isPending || !adminCode.trim()}>
            {t('common.add')}
          </Button>
        </form>
      </section>
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
      <Table>
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
