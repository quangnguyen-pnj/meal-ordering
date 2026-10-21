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
import { toast } from 'sonner';
import { ResponsiveSelect } from '@/components/responsive-select';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { AppDialog } from '@/components/app-dialog';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
      <CardContent>
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList aria-label={t('dishes.title')}>
            <TabsTrigger value="main">{t('dishes.tabs.main')}</TabsTrigger>
            <TabsTrigger value="desserts">{t('dishes.tabs.desserts')}</TabsTrigger>
          </TabsList>
          <TabsContent value="main">
            <MainDishes />
          </TabsContent>
          <TabsContent value="desserts">
            <Desserts />
          </TabsContent>
        </Tabs>
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
      toast.success(t('common.saved'));
      void qc.invalidateQueries({ queryKey: ['/admin/dishes'] });
    },
  });
  const archive = useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      api.post(`/admin/dishes/${id}/${archived ? 'archive' : 'restore'}`),
    onSuccess: (_res, v) => {
      // Archiving is reversible: the toast offers the way back.
      toast.success(t(v.archived ? 'dishes.archivedToast' : 'dishes.restoredToast'), {
        action: v.archived
          ? { label: t('common.undo'), onClick: () => archive.mutate({ ...v, archived: false }) }
          : undefined,
      });
      void qc.invalidateQueries({ queryKey: ['/admin/dishes'] });
    },
  });

  const items = (list.data?.items ?? []).filter((d) => !filter || d.type === filter);
  const error = archive.error ?? list.error;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex w-48 flex-col gap-2">
          <Label htmlFor="dish-filter">{t('dishes.filterType')}</Label>
          <ResponsiveSelect
            id="dish-filter"
            value={filter}
            onValueChange={(v) => setFilter(v as DishType | '')}
            options={[
              { value: '', label: t('common.all') },
              ...DISH_TYPES.map((type) => ({ value: type, label: vi.dishTypes[type] })),
            ]}
          />
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <Checkbox checked={showArchived} onCheckedChange={(v) => setShowArchived(v === true)} />
          {t('dishes.showArchived')}
        </label>
        <Button
          className="ml-auto"
          onClick={() => {
            save.reset();
            setEditing({ id: null, name: '', type: 'MAN' });
          }}
        >
          {t('dishes.addMain')}
        </Button>
      </div>

      <AppDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.id ? t('dishes.editMain') : t('dishes.addMain')}
      >
        {editing ? (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(editing);
            }}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="dish-name">{t('common.name')}</Label>
              <Input
                id="dish-name"
                required
                maxLength={120}
                placeholder={t('dishes.namePlaceholder')}
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="dish-type">{t('dishes.type')}</Label>
              <ResponsiveSelect
                id="dish-type"
                value={editing.type}
                onValueChange={(v) => setEditing({ ...editing, type: v as DishType })}
                options={DISH_TYPES.map((type) => ({ value: type, label: vi.dishTypes[type] }))}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {t('dishes.displayName')}:{' '}
              <strong className="text-foreground">
                {editing.name.trim() ? mealDisplayName(editing.type, editing.name) : '…'}
              </strong>
            </p>
            {save.error ? <Alert variant="destructive">{apiErrorText(save.error)}</Alert> : null}
            <DialogActions
              pending={save.isPending}
              disabled={!editing.name.trim()}
              onCancel={() => setEditing(null)}
            />
          </form>
        ) : null}
      </AppDialog>

      {error ? <Alert variant="destructive">{apiErrorText(error)}</Alert> : null}

      {list.isLoading ? <LoadingRows /> : null}
      <Table containerClassName={list.isLoading ? 'hidden' : undefined} className="min-w-[30rem]">
        <TableHeader>
          <TableRow>
            <TableHead>{t('dishes.displayName')}</TableHead>
            <TableHead>{t('dishes.type')}</TableHead>
            <TableHead>{t('dishes.sessions')}</TableHead>
            <TableHead className="text-right">{t('common.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((d) => (
            <TableRow key={d.id} className={d.archivedAt ? 'text-muted-foreground' : undefined}>
              <TableCell>
                {d.displayName}{' '}
                {d.archivedAt ? <Badge variant="outline">{t('dishes.archived')}</Badge> : null}
              </TableCell>
              <TableCell>{vi.dishTypes[d.type]}</TableCell>
              <TableCell>{d.sessions.map((s) => vi.sessions[s]).join(', ')}</TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      save.reset();
                      setEditing({ id: d.id, name: d.name, type: d.type });
                    }}
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
              </TableCell>
            </TableRow>
          ))}
          {items.length === 0 && !list.isLoading ? (
            <TableRow>
              <TableCell colSpan={4} className="text-muted-foreground">
                {t('dishes.empty')}
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
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
      toast.success(t('common.saved'));
      void qc.invalidateQueries({ queryKey: ['/admin/desserts'] });
    },
  });
  const archive = useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      api.post(`/admin/desserts/${id}/${archived ? 'archive' : 'restore'}`),
    onSuccess: (_res, v) => {
      // Archiving is reversible: the toast offers the way back.
      toast.success(t(v.archived ? 'dishes.archivedToast' : 'dishes.restoredToast'), {
        action: v.archived
          ? { label: t('common.undo'), onClick: () => archive.mutate({ ...v, archived: false }) }
          : undefined,
      });
      void qc.invalidateQueries({ queryKey: ['/admin/desserts'] });
    },
  });
  const error = archive.error ?? list.error;
  const items = list.data?.items ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <Checkbox checked={showArchived} onCheckedChange={(v) => setShowArchived(v === true)} />
          {t('dishes.showArchived')}
        </label>
        <Button
          className="ml-auto"
          onClick={() => {
            save.reset();
            setEditing({ id: null, name: '' });
          }}
        >
          {t('dishes.addDessert')}
        </Button>
      </div>
      <AppDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.id ? t('dishes.editDessert') : t('dishes.addDessert')}
      >
        {editing ? (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(editing);
            }}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="dessert-name">{t('common.name')}</Label>
              <Input
                id="dessert-name"
                required
                maxLength={120}
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </div>
            {save.error ? <Alert variant="destructive">{apiErrorText(save.error)}</Alert> : null}
            <DialogActions
              pending={save.isPending}
              disabled={!editing.name.trim()}
              onCancel={() => setEditing(null)}
            />
          </form>
        ) : null}
      </AppDialog>
      {error ? <Alert variant="destructive">{apiErrorText(error)}</Alert> : null}
      {list.isLoading ? <LoadingRows /> : null}
      <Table containerClassName={list.isLoading ? 'hidden' : undefined}>
        <TableHeader>
          <TableRow>
            <TableHead>{t('common.name')}</TableHead>
            <TableHead className="text-right">{t('common.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((d) => (
            <TableRow key={d.id} className={d.archivedAt ? 'text-muted-foreground' : undefined}>
              <TableCell>
                {d.name}{' '}
                {d.archivedAt ? <Badge variant="outline">{t('dishes.archived')}</Badge> : null}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      save.reset();
                      setEditing({ id: d.id, name: d.name });
                    }}
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
              </TableCell>
            </TableRow>
          ))}
          {items.length === 0 && !list.isLoading ? (
            <TableRow>
              <TableCell colSpan={2} className="text-muted-foreground">
                {t('dishes.empty')}
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}

function DialogActions({
  pending,
  disabled,
  onCancel,
}: {
  pending: boolean;
  disabled: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
      <Button type="button" variant="outline" onClick={onCancel}>
        {t('common.cancel')}
      </Button>
      <Button type="submit" disabled={pending || disabled}>
        {pending ? t('common.saving') : t('common.save')}
      </Button>
    </div>
  );
}
