'use client';

import type { MasterItemView } from '@meal/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingRows } from '@/components/ui/skeleton';
import { Table, Td, Th } from '@/components/ui/table';
import { Tabs } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { apiErrorText } from '@/lib/errors';
import { t, vi } from '@/messages';

type Kind = 'canteens' | 'floors' | 'cost-centers';
const TAB_LABEL: Record<Kind, string> = {
  canteens: vi.master.tabs.canteens,
  floors: vi.master.tabs.floors,
  'cost-centers': vi.master.tabs.costCenters,
};
const ADD_LABEL: Record<Kind, string> = {
  canteens: vi.master.add.canteens,
  floors: vi.master.add.floors,
  'cost-centers': vi.master.add.costCenters,
};
const EDIT_LABEL: Record<Kind, string> = {
  canteens: vi.master.edit.canteens,
  floors: vi.master.edit.floors,
  'cost-centers': vi.master.edit.costCenters,
};

/** /admin/master (BR-62): canteens, floors, cost centers; add, edit, deactivate. */
export function MasterScreen() {
  const [kind, setKind] = useState<Kind>('canteens');
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('master.title')}</CardTitle>
        <CardDescription>{t('master.intro')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Tabs
          label={t('master.title')}
          value={kind}
          onChange={setKind}
          tabs={(Object.keys(TAB_LABEL) as Kind[]).map((key) => ({ key, label: TAB_LABEL[key] }))}
        />
        <MasterTable key={kind} kind={kind} />
      </CardContent>
    </Card>
  );
}

interface Draft {
  id: string | null;
  code: string;
  name: string;
  sortOrder: number;
}

function MasterTable({ kind }: { kind: Kind }) {
  const qc = useQueryClient();
  const path = `/admin/master/${kind}`;
  const list = useQuery({
    queryKey: [path],
    queryFn: () => api.get<{ items: MasterItemView[] }>(path),
  });
  const [draft, setDraft] = useState<Draft | null>(null);
  const isFloor = kind === 'floors';
  const refresh = () => void qc.invalidateQueries({ queryKey: [path] });

  const save = useMutation({
    mutationFn: (d: Draft) =>
      d.id
        ? api.patch(
            `${path}/${d.id}`,
            isFloor ? { name: d.name, sortOrder: d.sortOrder } : { name: d.name },
          )
        : api.post(
            path,
            isFloor
              ? { code: d.code, name: d.name, sortOrder: d.sortOrder }
              : { code: d.code, name: d.name },
          ),
    onSuccess: () => {
      setDraft(null);
      refresh();
    },
  });
  const toggle = useMutation({
    mutationFn: (item: MasterItemView) => api.patch(`${path}/${item.id}`, { active: !item.active }),
    onSuccess: refresh,
  });
  const error = toggle.error ?? list.error;
  const open = (d: Draft) => {
    save.reset();
    setDraft(d);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => open({ id: null, code: '', name: '', sortOrder: 0 })}>
          {ADD_LABEL[kind]}
        </Button>
      </div>
      <Dialog
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? EDIT_LABEL[kind] : ADD_LABEL[kind]}
      >
        {draft ? (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(draft);
            }}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="master-code">{t('common.code')}</Label>
              <Input
                id="master-code"
                required
                data-autofocus={draft.id === null ? true : undefined}
                disabled={draft.id !== null}
                maxLength={32}
                aria-describedby="master-code-hint"
                value={draft.code}
                onChange={(e) => setDraft({ ...draft, code: e.target.value })}
              />
              <p id="master-code-hint" className="text-xs text-muted-foreground">
                {t('master.codeHint')}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="master-name">{t('common.name')}</Label>
              <Input
                id="master-name"
                required
                data-autofocus={draft.id !== null ? true : undefined}
                maxLength={120}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>
            {isFloor ? (
              <div className="flex w-28 flex-col gap-2">
                <Label htmlFor="master-order">{t('master.sortOrder')}</Label>
                <Input
                  id="master-order"
                  type="number"
                  min={0}
                  value={draft.sortOrder}
                  onChange={(e) => setDraft({ ...draft, sortOrder: Number(e.target.value) })}
                />
              </div>
            ) : null}
            {save.error ? <Alert variant="error">{apiErrorText(save.error)}</Alert> : null}
            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setDraft(null)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? t('common.saving') : t('common.save')}
              </Button>
            </div>
          </form>
        ) : null}
      </Dialog>
      {error ? <Alert variant="error">{apiErrorText(error)}</Alert> : null}
      {list.isLoading ? <LoadingRows rows={3} /> : null}
      <Table containerClassName={list.isLoading ? 'hidden' : undefined} className="min-w-[36rem]">
        <thead>
          <tr>
            <Th>{t('common.code')}</Th>
            <Th>{t('common.name')}</Th>
            {isFloor ? <Th>{t('master.sortOrder')}</Th> : null}
            {kind === 'cost-centers' ? <Th>{t('master.source')}</Th> : null}
            <Th>{t('master.usage')}</Th>
            <Th>{t('common.status')}</Th>
            <Th className="text-right">{t('common.actions')}</Th>
          </tr>
        </thead>
        <tbody>
          {(list.data?.items ?? []).map((item) => (
            <tr key={item.id} className={item.active ? undefined : 'text-muted-foreground'}>
              <Td className="font-mono">{item.code}</Td>
              <Td>{item.name}</Td>
              {isFloor ? <Td>{item.sortOrder}</Td> : null}
              {kind === 'cost-centers' ? (
                <Td>{item.source ? vi.master.sources[item.source] : null}</Td>
              ) : null}
              <Td>{item.usageCount}</Td>
              <Td>
                <Badge variant={item.active ? 'success' : 'outline'}>
                  {item.active ? t('common.active') : t('common.inactive')}
                </Badge>
              </Td>
              <Td className="text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      open({
                        id: item.id,
                        code: item.code,
                        name: item.name,
                        sortOrder: item.sortOrder ?? 0,
                      })
                    }
                  >
                    {t('common.edit')}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => toggle.mutate(item)}>
                    {item.active ? t('common.deactivate') : t('common.activate')}
                  </Button>
                </div>
              </Td>
            </tr>
          ))}
          {list.data && list.data.items.length === 0 ? (
            <tr>
              <Td colSpan={7} className="text-muted-foreground">
                {t('master.empty')}
              </Td>
            </tr>
          ) : null}
        </tbody>
      </Table>
    </div>
  );
}
