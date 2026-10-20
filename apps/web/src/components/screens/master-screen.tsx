'use client';

import type { MasterItemView } from '@meal/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  const error = save.error ?? toggle.error ?? list.error;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setDraft({ id: null, code: '', name: '', sortOrder: 0 })}>
          {t('master.addTitle')}
        </Button>
      </div>
      {draft ? (
        <form
          className="flex flex-wrap items-end gap-3 rounded-md border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(draft);
          }}
        >
          <div className="flex w-40 flex-col gap-2">
            <Label htmlFor="master-code">{t('common.code')}</Label>
            <Input
              id="master-code"
              required
              disabled={draft.id !== null}
              maxLength={32}
              title={t('master.codeHint')}
              value={draft.code}
              onChange={(e) => setDraft({ ...draft, code: e.target.value })}
            />
          </div>
          <div className="flex min-w-60 flex-1 flex-col gap-2">
            <Label htmlFor="master-name">{t('common.name')}</Label>
            <Input
              id="master-name"
              required
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
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? t('common.saving') : t('common.save')}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setDraft(null)}>
            {t('common.cancel')}
          </Button>
          <p className="basis-full text-xs text-muted-foreground">{t('master.codeHint')}</p>
        </form>
      ) : null}
      {error ? <Alert variant="error">{apiErrorText(error)}</Alert> : null}
      <Table>
        <thead>
          <tr>
            <Th>{t('common.code')}</Th>
            <Th>{t('common.name')}</Th>
            {isFloor ? <Th>{t('master.sortOrder')}</Th> : null}
            {kind === 'cost-centers' ? <Th>{t('master.source')}</Th> : null}
            <Th>{t('master.usage')}</Th>
            <Th />
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
                      setDraft({
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
        </tbody>
      </Table>
    </div>
  );
}
