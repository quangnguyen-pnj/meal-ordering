'use client';

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  addDays,
  checkMenuMix,
  isoWeekdayOf,
  mondayOf,
  type DessertView,
  type DishView,
  type MenuSaveResult,
  type MenuWeekView,
} from '@meal/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, GripVertical, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useStore } from 'zustand';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { api } from '@/lib/api';
import { apiErrorText } from '@/lib/errors';
import {
  createMenuBuilderStore,
  type DraftDay,
  type MenuBuilderStore,
} from '@/lib/menu-builder-store';
import { cn, formatCloseAt, formatDate } from '@/lib/utils';
import { t, vi } from '@/messages';

interface CanteensResponse {
  items: Array<{ id: string; code: string; name: string }>;
  upcomingWeekStart: string;
}

/** /admin/menu: canteen picker, dish library, week grid, save draft and publish (BR-08..BR-15). */
export function MenuScreen() {
  const canteens = useQuery({
    queryKey: ['menu-canteens'],
    queryFn: () => api.get<CanteensResponse>('/admin/menu/canteens'),
  });
  const [canteenId, setCanteenId] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState<string | null>(null);

  useEffect(() => {
    if (canteens.data && !canteenId) setCanteenId(canteens.data.items[0]?.id ?? null);
    if (canteens.data && !weekStart) setWeekStart(canteens.data.upcomingWeekStart);
  }, [canteens.data, canteenId, weekStart]);

  if (canteens.error) return <Alert variant="error">{apiErrorText(canteens.error)}</Alert>;
  if (!canteens.data) return <p className="text-muted-foreground">{t('common.loading')}</p>;
  if (canteens.data.items.length === 0) return <Alert>{t('menu.noCanteen')}</Alert>;

  return (
    <Card>
      <CardHeader className="gap-4">
        <CardTitle>{t('menu.title')}</CardTitle>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex w-60 flex-col gap-2">
            <Label htmlFor="menu-canteen">{t('menu.canteen')}</Label>
            <Select
              id="menu-canteen"
              value={canteenId ?? ''}
              onChange={(e) => setCanteenId(e.target.value)}
            >
              {canteens.data.items.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="menu-week">{t('menu.week')}</Label>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                aria-label={t('menu.previousWeek')}
                onClick={() => weekStart && setWeekStart(addDays(weekStart, -7))}
              >
                ‹
              </Button>
              <Input
                id="menu-week"
                type="date"
                className="w-44"
                value={weekStart ?? ''}
                onChange={(e) => e.target.value && setWeekStart(mondayOf(e.target.value))}
              />
              <Button
                variant="outline"
                size="icon"
                aria-label={t('menu.nextWeek')}
                onClick={() => weekStart && setWeekStart(addDays(weekStart, 7))}
              >
                ›
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {canteenId && weekStart ? (
          <WeekEditor
            key={`${canteenId}:${weekStart}`}
            canteenId={canteenId}
            weekStart={weekStart}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

function WeekEditor({ canteenId, weekStart }: { canteenId: string; weekStart: string }) {
  const qc = useQueryClient();
  const [store] = useState<MenuBuilderStore>(() => createMenuBuilderStore());
  const days = useStore(store, (s) => s.days);
  const dirty = useStore(store, (s) => s.dirty);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const weekKey = ['menu-week', canteenId, weekStart];
  const week = useQuery({
    queryKey: weekKey,
    queryFn: () =>
      api.get<MenuWeekView>(`/admin/menu/weeks?canteenId=${canteenId}&weekStart=${weekStart}`),
  });
  const dishes = useQuery({
    queryKey: ['/admin/dishes', false],
    queryFn: () => api.get<{ items: DishView[] }>('/admin/dishes?includeArchived=false'),
  });
  const desserts = useQuery({
    queryKey: ['/admin/desserts', false],
    queryFn: () => api.get<{ items: DessertView[] }>('/admin/desserts?includeArchived=false'),
  });

  useEffect(() => {
    if (week.data) store.getState().load(week.data);
  }, [week.data, store]);

  // Names for every dish shown, including archived ones still on the menu.
  const dishById = useMemo(() => {
    const map = new Map<string, Pick<DishView, 'type' | 'displayName'>>();
    for (const d of week.data?.days ?? [])
      for (const i of d.items) map.set(i.dishId, { type: i.type, displayName: i.displayName });
    for (const d of dishes.data?.items ?? []) map.set(d.id, d);
    return map;
  }, [week.data, dishes.data]);
  const dessertName = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of week.data?.days ?? []) for (const x of d.desserts) map.set(x.id, x.name);
    for (const d of desserts.data?.items ?? []) map.set(d.id, d.name);
    return map;
  }, [week.data, desserts.data]);

  const view = week.data;
  const published = view !== undefined && view.status !== 'NEW' && view.status !== 'DRAFT';
  const locked = new Set(view?.lockedDates ?? []);

  const save = useMutation({
    mutationFn: () =>
      api.put<MenuSaveResult>('/admin/menu/weeks', {
        canteenId,
        weekStart,
        reason: reason.trim() || undefined,
        days: store.getState().days.filter((d) => !locked.has(d.date)),
      }),
    onSuccess: (res) => {
      qc.setQueryData(weekKey, res.menu);
      store.getState().load(res.menu);
      setReason('');
      setNotice(
        published
          ? t('menu.effects', {
              moved: res.effects.movedRegistrations,
              flagged: res.effects.flaggedRegistrations,
              notified: res.effects.notifiedEmployees,
            })
          : t('common.saved'),
      );
    },
  });
  const publish = useMutation({
    mutationFn: () => api.post<MenuWeekView>(`/admin/menu/weeks/${view?.id}/publish`),
    onSuccess: (res) => {
      qc.setQueryData(weekKey, res);
      setNotice(t('menu.published'));
    },
  });

  function onDragEnd(event: DragEndEvent) {
    const target = event.over?.id;
    if (typeof target !== 'string' || !target.startsWith('day:')) return;
    const date = target.slice(4);
    if (locked.has(date)) return;
    const [kind, id] = String(event.active.id).split(':') as ['dish' | 'dessert', string];
    if (kind === 'dish') store.getState().addDish(date, id);
    else store.getState().addDessert(date, id);
    setNotice(null);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  if (week.error) return <Alert variant="error">{apiErrorText(week.error)}</Alert>;
  if (!view) return <p className="text-muted-foreground">{t('common.loading')}</p>;

  const error = save.error ?? publish.error;
  const statusVariant = published ? 'success' : view.status === 'DRAFT' ? 'warning' : 'outline';

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={statusVariant}>{vi.menu.status[view.status]}</Badge>
          <span className="text-sm">
            {view.closeAtIsExpected
              ? t('menu.expectedCloseAt', { time: formatCloseAt(view.closeAt) })
              : t('menu.closeAt', { time: formatCloseAt(view.closeAt) })}
          </span>
          {view.latePublish ? <Badge variant="warning">{t('menu.latePublish')}</Badge> : null}
        </div>
        {published ? <Alert>{t('menu.publishedEditHint')}</Alert> : null}

        <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
          <Library
            dishes={dishes.data?.items ?? []}
            desserts={desserts.data?.items ?? []}
            selectedDate={selectedDate && !locked.has(selectedDate) ? selectedDate : null}
            onAddDish={(id) => selectedDate && store.getState().addDish(selectedDate, id)}
            onAddDessert={(id) => selectedDate && store.getState().addDessert(selectedDate, id)}
          />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {days.map((day) => (
              <DayColumn
                key={day.date}
                day={day}
                store={store}
                published={published}
                wasServing={view.days.find((d) => d.date === day.date)?.isServing ?? false}
                locked={locked.has(day.date)}
                selected={selectedDate === day.date}
                onSelect={() => setSelectedDate(day.date)}
                dishById={dishById}
                dessertName={dessertName}
                replacementOptions={dishes.data?.items ?? []}
              />
            ))}
          </div>
        </div>

        {error ? <Alert variant="error">{apiErrorText(error)}</Alert> : null}
        {notice ? <Alert role="status">{notice}</Alert> : null}
        {dirty ? <p className="text-sm text-muted-foreground">{t('menu.unsaved')}</p> : null}

        <div className="flex flex-wrap items-end gap-3">
          {published ? (
            <div className="flex min-w-72 flex-1 flex-col gap-2">
              <Label htmlFor="menu-reason">{t('common.reasonOptional')}</Label>
              <Input
                id="menu-reason"
                maxLength={500}
                placeholder={t('menu.reasonPlaceholder')}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          ) : null}
          <Button
            variant={published ? 'default' : 'outline'}
            disabled={save.isPending || (!dirty && view.id !== null)}
            onClick={() => save.mutate()}
          >
            {save.isPending
              ? t('common.saving')
              : published
                ? t('menu.saveChanges')
                : t('menu.saveDraft')}
          </Button>
          {!published ? (
            <Button
              disabled={publish.isPending || dirty || view.id === null}
              onClick={() => window.confirm(t('menu.publishConfirm')) && publish.mutate()}
            >
              {publish.isPending ? t('menu.publishing') : t('menu.publish')}
            </Button>
          ) : null}
        </div>
      </div>
    </DndContext>
  );
}

function Library({
  dishes,
  desserts,
  selectedDate,
  onAddDish,
  onAddDessert,
}: {
  dishes: DishView[];
  desserts: DessertView[];
  selectedDate: string | null;
  onAddDish: (id: string) => void;
  onAddDessert: (id: string) => void;
}) {
  const [q, setQ] = useState('');
  const match = (name: string) => name.toLowerCase().includes(q.trim().toLowerCase());
  const target = selectedDate
    ? `${vi.weekdays[isoWeekdayOf(selectedDate) as keyof typeof vi.weekdays]}`
    : null;
  return (
    <aside className="flex flex-col gap-3 rounded-md border p-3 lg:sticky lg:top-4 lg:max-h-[80vh] lg:overflow-y-auto">
      <p className="font-medium">{t('menu.library')}</p>
      <p className="text-xs text-muted-foreground">{t('menu.libraryHint')}</p>
      <Input
        aria-label={t('common.search')}
        placeholder={t('common.search')}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <p className="text-xs font-semibold uppercase text-muted-foreground">
        {t('menu.mainDishes')}
      </p>
      <ul className="flex flex-col gap-1">
        {dishes
          .filter((d) => match(d.displayName))
          .map((d) => (
            <LibraryEntry
              key={d.id}
              dragId={`dish:${d.id}`}
              label={d.displayName}
              addLabel={target ? `${t('menu.addTo')} ${target}` : null}
              onAdd={() => onAddDish(d.id)}
            />
          ))}
      </ul>
      <p className="text-xs font-semibold uppercase text-muted-foreground">{t('menu.desserts')}</p>
      <ul className="flex flex-col gap-1">
        {desserts
          .filter((d) => match(d.name))
          .map((d) => (
            <LibraryEntry
              key={d.id}
              dragId={`dessert:${d.id}`}
              label={d.name}
              addLabel={target ? `${t('menu.addTo')} ${target}` : null}
              onAdd={() => onAddDessert(d.id)}
            />
          ))}
      </ul>
    </aside>
  );
}

function LibraryEntry({
  dragId,
  label,
  addLabel,
  onAdd,
}: {
  dragId: string;
  label: string;
  addLabel: string | null;
  onAdd: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: dragId });
  return (
    <li
      ref={setNodeRef}
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined}
      className={cn(
        'flex items-center gap-2 rounded-md border bg-card px-2 py-1 text-sm',
        isDragging && 'z-10 shadow-lg',
      )}
    >
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground"
        aria-label={label}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" aria-hidden />
      </button>
      <span className="flex-1">{label}</span>
      {addLabel ? (
        <Button variant="ghost" size="sm" onClick={onAdd} title={addLabel}>
          {t('common.add')}
        </Button>
      ) : null}
    </li>
  );
}

function DayColumn({
  day,
  store,
  published,
  wasServing,
  locked,
  selected,
  onSelect,
  dishById,
  dessertName,
  replacementOptions,
}: {
  day: DraftDay;
  store: MenuBuilderStore;
  published: boolean;
  wasServing: boolean;
  locked: boolean;
  selected: boolean;
  onSelect: () => void;
  dishById: Map<string, Pick<DishView, 'type' | 'displayName'>>;
  dessertName: Map<string, string>;
  replacementOptions: DishView[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${day.date}`, disabled: locked });
  const weekday = vi.weekdays[isoWeekdayOf(day.date) as keyof typeof vi.weekdays];
  const types = day.items.map((i) => dishById.get(i.dishId)?.type).filter((x) => x !== undefined);
  const mix = day.isServing ? checkMenuMix(types) : null;
  const actions = store.getState();
  // BR-08 / open-questions Q16: a published serving day cannot be turned off.
  const canToggle = !locked && !(published && wasServing && day.isServing);

  return (
    <section
      ref={setNodeRef}
      aria-label={`${weekday} ${formatDate(day.date)}`}
      onClick={onSelect}
      className={cn(
        'flex min-h-48 flex-col gap-2 rounded-md border p-3 transition-colors',
        selected && 'ring-2 ring-ring',
        isOver && 'bg-accent',
        !day.isServing && 'bg-muted/50',
        locked && 'opacity-70',
      )}
    >
      <header className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{weekday}</p>
          <p className="text-xs text-muted-foreground">{formatDate(day.date)}</p>
        </div>
        {locked ? (
          <Badge variant="outline">{t('menu.locked')}</Badge>
        ) : canToggle ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              actions.setServing(day.date, !day.isServing);
            }}
          >
            {day.isServing ? t('menu.disableDay') : t('menu.enableDay')}
          </Button>
        ) : null}
      </header>

      {!day.isServing ? (
        <p className="text-sm text-muted-foreground">{t('menu.notServing')}</p>
      ) : (
        <>
          <ul className="flex flex-col gap-1">
            {day.items.map((item, index) => {
              const dish = dishById.get(item.dishId);
              return (
                <li
                  key={`${item.id ?? 'new'}:${item.dishId}`}
                  className="flex flex-col gap-1 rounded border px-2 py-1 text-sm"
                >
                  <div className="flex items-center gap-1">
                    <span className="flex-1">{dish?.displayName ?? item.dishId}</span>
                    {!locked ? (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label={t('common.previous')}
                          onClick={() => actions.moveItem(day.date, index, -1)}
                        >
                          <ArrowUp className="h-3 w-3" aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label={t('common.next')}
                          onClick={() => actions.moveItem(day.date, index, 1)}
                        >
                          <ArrowDown className="h-3 w-3" aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label={t('common.remove')}
                          onClick={() => actions.removeItem(day.date, index)}
                        >
                          <X className="h-4 w-4" aria-hidden />
                        </Button>
                      </>
                    ) : null}
                  </div>
                  {published && item.id && !locked ? (
                    <Select
                      aria-label={`${t('menu.replaceWith')}: ${dish?.displayName ?? ''}`}
                      className="h-9 text-sm"
                      value={item.dishId}
                      onChange={(e) => actions.replaceItem(day.date, index, e.target.value)}
                    >
                      {!replacementOptions.some((o) => o.id === item.dishId) ? (
                        <option value={item.dishId}>{dish?.displayName}</option>
                      ) : null}
                      {replacementOptions.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.id === item.dishId
                            ? o.displayName
                            : `${t('menu.replaceWith')}: ${o.displayName}`}
                        </option>
                      ))}
                    </Select>
                  ) : null}
                </li>
              );
            })}
            {day.items.length === 0 ? (
              <li className="rounded border border-dashed px-2 py-3 text-center text-xs text-muted-foreground">
                {t('menu.emptyDay')}
              </li>
            ) : null}
          </ul>
          {day.dessertIds.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {day.dessertIds.map((id) => (
                <Badge key={id} variant="outline" className="gap-1">
                  {dessertName.get(id) ?? id}
                  {!locked ? (
                    <button
                      type="button"
                      aria-label={t('common.remove')}
                      onClick={() => actions.removeDessert(day.date, id)}
                    >
                      <X className="h-3 w-3" aria-hidden />
                    </button>
                  ) : null}
                </Badge>
              ))}
            </div>
          ) : null}
          {mix && !mix.usual ? (
            <p
              className="rounded-md border border-warning/50 bg-warning/15 px-2 py-1 text-xs"
              role="status"
            >
              {t('menu.mixWarning', {
                issues: mix.issues
                  .map((i) => t('menu.mixIssue', { type: vi.dishTypes[i.type], actual: i.actual }))
                  .join(', '),
              })}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
