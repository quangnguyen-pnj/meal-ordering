'use client';

import {
  DISH_TYPES,
  mealDisplayName,
  type DessertView,
  type DishType,
  type DishView,
} from '@meal/shared';
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
import { Tabs } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { apiErrorText } from '@/lib/errors';
import { t, vi } from '@/messages';

type Tab = 'main' | 'desserts';
type Editing = { id: string | null; name: string; type: DishType };

/** /admin/dishes (BR-10): main dishes and desserts; add, edit, archive, restore. */
export function DishesScreen() {
  const [tab, setTab] = useState<Tab>('main');
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('dishes.title')}</CardTitle>
        <CardDescription>{t('dishes.intro')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Tabs
          label={t('dishes.title')}
          value={tab}
          onChange={setTab}
          tabs={[
            { key: 'main', label: t('dishes.tabs.main') },
            { key: 'desserts', label: t('dishes.tabs.desserts') },
          ]}
        />
        {tab === 'main' ? <MainDishes /> : <Desserts />}
      </CardContent>
    </Card>
  );
}

function useLibrary<T>(path: string, includeArchived: boolean) {
  return useQuery({
    queryKey: [path, includeArchived],
    queryFn: () => api.get<{ items: T[] }>(`${path}?includeArchived=${includeArchived}`),
  });
}

function MainDishes() {
  const qc = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const [filter, setFilter] = useState<DishType | ''>('');
  const [editing, setEditing] = useState<Editing | null>(null);
  const list = useLibrary<DishView>('/admin/dishes', showArchived);

  const save = useMutation({
    mutationFn: (e: Editing) => {
      const body = { name: e.name, type: e.type, sessions: ['LUNCH'] };
      return e.id ? api.put(`/admin/dishes/${e.id}`, body) : api.post('/admin/dishes', body);
    },
    onSuccess: () => {
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ['/admin/dishes'] });
    },
  });
  const archive = useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      api.post(`/admin/dishes/${id}/${archived ? 'archive' : 'restore'}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['/admin/dishes'] }),
  });

  const items = (list.data?.items ?? []).filter((d) => !filter || d.type === filter);
  const error = save.error ?? archive.error ?? list.error;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex w-48 flex-col gap-2">
          <Label htmlFor="dish-filter">{t('dishes.filterType')}</Label>
          <Select
            id="dish-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value as DishType | '')}
          >
            <option value="">{t('common.all')}</option>
            {DISH_TYPES.map((type) => (
              <option key={type} value={type}>
                {vi.dishTypes[type]}
              </option>
            ))}
          </Select>
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          {t('dishes.showArchived')}
        </label>
        <Button className="ml-auto" onClick={() => setEditing({ id: null, name: '', type: 'MAN' })}>
          {t('dishes.addMain')}
        </Button>
      </div>

      {editing ? (
        <form
          className="flex flex-wrap items-end gap-3 rounded-md border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(editing);
          }}
        >
          <div className="flex min-w-60 flex-1 flex-col gap-2">
            <Label htmlFor="dish-name">{t('common.name')}</Label>
            <Input
              id="dish-name"
              required
              autoFocus
              maxLength={120}
              placeholder={t('dishes.namePlaceholder')}
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            />
          </div>
          <div className="flex w-40 flex-col gap-2">
            <Label htmlFor="dish-type">{t('dishes.type')}</Label>
            <Select
              id="dish-type"
              value={editing.type}
              onChange={(e) => setEditing({ ...editing, type: e.target.value as DishType })}
            >
              {DISH_TYPES.map((type) => (
                <option key={type} value={type}>
                  {vi.dishTypes[type]}
                </option>
              ))}
            </Select>
          </div>
          <p className="min-h-11 py-3 text-sm text-muted-foreground">
            {t('dishes.displayName')}:{' '}
            <strong>
              {editing.name.trim() ? mealDisplayName(editing.type, editing.name) : '…'}
            </strong>
          </p>
          <div className="flex gap-2">
            <Button type="submit" disabled={save.isPending || !editing.name.trim()}>
              {save.isPending ? t('common.saving') : t('common.save')}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
              {t('common.cancel')}
            </Button>
          </div>
        </form>
      ) : null}

      {error ? <Alert variant="error">{apiErrorText(error)}</Alert> : null}

      <Table>
        <thead>
          <tr>
            <Th>{t('dishes.displayName')}</Th>
            <Th>{t('dishes.type')}</Th>
            <Th>{t('dishes.sessions')}</Th>
            <Th className="text-right">{t('common.actions')}</Th>
          </tr>
        </thead>
        <tbody>
          {items.map((d) => (
            <tr key={d.id} className={d.archivedAt ? 'text-muted-foreground' : undefined}>
              <Td>
                {d.displayName}{' '}
                {d.archivedAt ? <Badge variant="outline">{t('dishes.archived')}</Badge> : null}
              </Td>
              <Td>{vi.dishTypes[d.type]}</Td>
              <Td>{d.sessions.map((s) => vi.sessions[s]).join(', ')}</Td>
              <Td className="text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditing({ id: d.id, name: d.name, type: d.type })}
                  >
                    {t('common.edit')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => archive.mutate({ id: d.id, archived: !d.archivedAt })}
                  >
                    {d.archivedAt ? t('common.restore') : t('common.archive')}
                  </Button>
                </div>
              </Td>
            </tr>
          ))}
          {items.length === 0 && !list.isLoading ? (
            <tr>
              <Td colSpan={4} className="text-muted-foreground">
                {t('dishes.empty')}
              </Td>
            </tr>
          ) : null}
        </tbody>
      </Table>
    </div>
  );
}

function Desserts() {
  const qc = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<{ id: string | null; name: string } | null>(null);
  const list = useLibrary<DessertView>('/admin/desserts', showArchived);

  const save = useMutation({
    mutationFn: (e: { id: string | null; name: string }) =>
      e.id
        ? api.put(`/admin/desserts/${e.id}`, { name: e.name })
        : api.post('/admin/desserts', { name: e.name }),
    onSuccess: () => {
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ['/admin/desserts'] });
    },
  });
  const archive = useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      api.post(`/admin/desserts/${id}/${archived ? 'archive' : 'restore'}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['/admin/desserts'] }),
  });
  const error = save.error ?? archive.error ?? list.error;
  const items = list.data?.items ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          {t('dishes.showArchived')}
        </label>
        <Button className="ml-auto" onClick={() => setEditing({ id: null, name: '' })}>
          {t('dishes.addDessert')}
        </Button>
      </div>
      {editing ? (
        <form
          className="flex flex-wrap items-end gap-3 rounded-md border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(editing);
          }}
        >
          <div className="flex min-w-60 flex-1 flex-col gap-2">
            <Label htmlFor="dessert-name">{t('common.name')}</Label>
            <Input
              id="dessert-name"
              required
              autoFocus
              maxLength={120}
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            />
          </div>
          <Button type="submit" disabled={save.isPending || !editing.name.trim()}>
            {save.isPending ? t('common.saving') : t('common.save')}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
            {t('common.cancel')}
          </Button>
        </form>
      ) : null}
      {error ? <Alert variant="error">{apiErrorText(error)}</Alert> : null}
      <Table>
        <thead>
          <tr>
            <Th>{t('common.name')}</Th>
            <Th className="text-right">{t('common.actions')}</Th>
          </tr>
        </thead>
        <tbody>
          {items.map((d) => (
            <tr key={d.id} className={d.archivedAt ? 'text-muted-foreground' : undefined}>
              <Td>
                {d.name}{' '}
                {d.archivedAt ? <Badge variant="outline">{t('dishes.archived')}</Badge> : null}
              </Td>
              <Td className="text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditing({ id: d.id, name: d.name })}
                  >
                    {t('common.edit')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => archive.mutate({ id: d.id, archived: !d.archivedAt })}
                  >
                    {d.archivedAt ? t('common.restore') : t('common.archive')}
                  </Button>
                </div>
              </Td>
            </tr>
          ))}
          {items.length === 0 && !list.isLoading ? (
            <tr>
              <Td colSpan={2} className="text-muted-foreground">
                {t('dishes.empty')}
              </Td>
            </tr>
          ) : null}
        </tbody>
      </Table>
    </div>
  );
}
