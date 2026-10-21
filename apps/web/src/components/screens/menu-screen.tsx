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
  checkMenuMix,
  isoWeekdayOf,
  type DessertView,
  type DishView,
  type MenuSaveResult,
  type MenuWeekView,
} from '@meal/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Check, GripVertical, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useStore } from 'zustand';
import { ResponsiveSelect } from '@/components/responsive-select';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AppDialog } from '@/components/app-dialog';
import { useConfirm } from '@/components/confirm-dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingRows } from '@/components/ui/skeleton';
import { WeekNav } from '@/components/week-nav';
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

  if (canteens.error) return <Alert variant="destructive">{apiErrorText(canteens.error)}</Alert>;
  if (!canteens.data) return <LoadingRows rows={6} />;
  if (canteens.data.items.length === 0) return <Alert>{t('menu.noCanteen')}</Alert>;

  return (
    <Card>
      <CardHeader className="gap-4">
        <CardTitle>{t('menu.title')}</CardTitle>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex w-full flex-col gap-2 sm:w-60">
            <Label htmlFor="menu-canteen">{t('menu.canteen')}</Label>
            <ResponsiveSelect
              id="menu-canteen"
              value={canteenId ?? ''}
              onValueChange={setCanteenId}
              options={canteens.data.items.map((c) => ({ value: c.id, label: c.name }))}
            />
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium leading-none">{t('menu.week')}</p>
            {weekStart ? (
              <WeekNav
                weekStart={weekStart}
                onChange={setWeekStart}
                homeWeekStart={canteens.data.upcomingWeekStart}
              />
            ) : null}
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
  const [pickerDate, setPickerDate] = useState<string | null>(null);
  const [confirm, confirmElement] = useConfirm();
  const [reason, setReason] = useState('');

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
      toast.success(
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
      toast.success(t('menu.published'));
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
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  async function askPublish() {
    if (!view) return;
    const ok = await confirm({
      title: t('menu.publishTitle'),
      description: (
        <>
          <span className="block">{t('menu.publishConfirm')}</span>
          <strong className="mt-2 block text-foreground">
            {t('menu.closeAt', { time: formatCloseAt(view.closeAt) })}
          </strong>
        </>
      ),
      confirmLabel: t('menu.publish'),
    });
    if (ok) publish.mutate();
  }

  if (week.error) return <Alert variant="destructive">{apiErrorText(week.error)}</Alert>;
  if (!view) return <LoadingRows rows={6} />;

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
          <Library dishes={dishes.data?.items ?? []} desserts={desserts.data?.items ?? []} />
          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {days.map((day) => (
              <DayColumn
                key={day.date}
                day={day}
                store={store}
                published={published}
                wasServing={view.days.find((d) => d.date === day.date)?.isServing ?? false}
                locked={locked.has(day.date)}
                onAdd={() => setPickerDate(day.date)}
                dishById={dishById}
                dessertName={dessertName}
                replacementOptions={dishes.data?.items ?? []}
              />
            ))}
          </div>
        </div>

        <DishPicker
          date={pickerDate}
          day={days.find((d) => d.date === pickerDate)}
          dishes={dishes.data?.items ?? []}
          desserts={desserts.data?.items ?? []}
          onClose={() => setPickerDate(null)}
          onAddDish={(id) => {
            if (pickerDate) store.getState().addDish(pickerDate, id);
          }}
          onAddDessert={(id) => {
            if (pickerDate) store.getState().addDessert(pickerDate, id);
          }}
        />
        {confirmElement}

        {error ? <Alert variant="destructive">{apiErrorText(error)}</Alert> : null}
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
              aria-describedby={dirty || view.id === null ? 'publish-hint' : undefined}
              onClick={askPublish}
            >
              {publish.isPending ? t('menu.publishing') : t('menu.publish')}
            </Button>
          ) : null}
          {!published && (dirty || view.id === null) ? (
            <p id="publish-hint" className="basis-full text-sm text-muted-foreground">
              {t('menu.publishNeedsSave')}
            </p>
          ) : null}
        </div>
      </div>
    </DndContext>
  );
}

/** Desktop drag source; phones and keyboards use the per-day "Thêm món" picker instead. */
function Library({ dishes, desserts }: { dishes: DishView[]; desserts: DessertView[] }) {
  const [q, setQ] = useState('');
  const match = (name: string) => name.toLowerCase().includes(q.trim().toLowerCase());
  return (
    <aside className="hidden flex-col gap-3 rounded-md border p-3 lg:sticky lg:top-4 lg:flex lg:max-h-[80vh] lg:self-start lg:overflow-y-auto">
      <p className="font-medium">{t('menu.library')}</p>
      <p className="text-xs text-muted-foreground">{t('menu.libraryHint')}</p>
      <Input
        type="search"
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
            <LibraryEntry key={d.id} dragId={`dish:${d.id}`} label={d.displayName} />
          ))}
      </ul>
      <p className="text-xs font-semibold uppercase text-muted-foreground">{t('menu.desserts')}</p>
      <ul className="flex flex-col gap-1">
        {desserts
          .filter((d) => match(d.name))
          .map((d) => (
            <LibraryEntry key={d.id} dragId={`dessert:${d.id}`} label={d.name} />
          ))}
      </ul>
      {dishes.length === 0 && desserts.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('menu.libraryEmpty')}</p>
      ) : null}
    </aside>
  );
}

function LibraryEntry({ dragId, label }: { dragId: string; label: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: dragId });
  return (
    <li
      ref={setNodeRef}
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined}
      className={cn(
        'flex cursor-grab touch-none items-center gap-2 rounded-md border bg-card px-2 py-2 text-sm',
        isDragging && 'z-10 shadow-lg',
      )}
      {...attributes}
      {...listeners}
      aria-label={label}
    >
      <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="flex-1">{label}</span>
    </li>
  );
}

/** Add dishes and desserts to one day; stays open so several can be added in a row. */
function DishPicker({
  date,
  day,
  dishes,
  desserts,
  onClose,
  onAddDish,
  onAddDessert,
}: {
  date: string | null;
  day: DraftDay | undefined;
  dishes: DishView[];
  desserts: DessertView[];
  onClose: () => void;
  onAddDish: (id: string) => void;
  onAddDessert: (id: string) => void;
}) {
  const onDay = new Set(day?.items.map((i) => i.dishId));
  const dessertsOnDay = new Set(day?.dessertIds);
  const title = date
    ? t('menu.pickerTitle', {
        day: `${vi.weekdays[isoWeekdayOf(date) as keyof typeof vi.weekdays]} ${formatDate(date)}`,
      })
    : '';

  // cmdk filters on `value`; ids keep two dishes with the same name apart.
  const entry = (id: string, label: string, added: boolean, onAdd: () => void) => (
    <CommandItem key={id} value={`${label} ${id}`} disabled={added} onSelect={onAdd}>
      {added ? <Check className="text-primary" aria-hidden /> : <Plus aria-hidden />}
      <span className="flex-1">{label}</span>
      {added ? <span className="text-xs">{t('menu.added')}</span> : null}
    </CommandItem>
  );

  return (
    <AppDialog
      open={date !== null}
      onClose={onClose}
      title={title}
      className="gap-3"
      footer={<Button onClick={onClose}>{t('common.done')}</Button>}
    >
      <Command className="rounded-md border">
        <CommandInput placeholder={t('menu.searchDish')} />
        <CommandList className="max-h-[50vh]">
          <CommandEmpty>
            {dishes.length === 0 && desserts.length === 0
              ? t('menu.libraryEmpty')
              : t('menu.noDishFound')}
          </CommandEmpty>
          <CommandGroup heading={t('menu.mainDishes')}>
            {dishes.map((d) => entry(d.id, d.displayName, onDay.has(d.id), () => onAddDish(d.id)))}
          </CommandGroup>
          <CommandGroup heading={t('menu.desserts')}>
            {desserts.map((d) =>
              entry(d.id, d.name, dessertsOnDay.has(d.id), () => onAddDessert(d.id)),
            )}
          </CommandGroup>
        </CommandList>
      </Command>
    </AppDialog>
  );
}

function DayColumn({
  day,
  store,
  published,
  wasServing,
  locked,
  onAdd,
  dishById,
  dessertName,
  replacementOptions,
}: {
  day: DraftDay;
  store: MenuBuilderStore;
  published: boolean;
  wasServing: boolean;
  locked: boolean;
  onAdd: () => void;
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
      className={cn(
        'flex flex-col gap-2 rounded-md border p-3 transition-colors sm:min-h-48',
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
            onClick={() => actions.setServing(day.date, !day.isServing)}
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
                    <ResponsiveSelect
                      aria-label={`${t('menu.replaceWith')}: ${dish?.displayName ?? ''}`}
                      className="h-9 text-sm"
                      value={item.dishId}
                      onValueChange={(v) => actions.replaceItem(day.date, index, v)}
                      options={[
                        ...(!replacementOptions.some((o) => o.id === item.dishId)
                          ? [{ value: item.dishId, label: dish?.displayName ?? item.dishId }]
                          : []),
                        ...replacementOptions.map((o) => ({
                          value: o.id,
                          label:
                            o.id === item.dishId
                              ? o.displayName
                              : `${t('menu.replaceWith')}: ${o.displayName}`,
                        })),
                      ]}
                    />
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
                    <Button
                      variant="ghost"
                      size="icon"
                      className="-my-1 -mr-1.5 h-6 w-6"
                      aria-label={`${t('common.remove')} ${dessertName.get(id) ?? ''}`}
                      onClick={() => actions.removeDessert(day.date, id)}
                    >
                      <X className="h-3 w-3" aria-hidden />
                    </Button>
                  ) : null}
                </Badge>
              ))}
            </div>
          ) : null}
          {!locked ? (
            <Button variant="outline" size="sm" className="self-start" onClick={onAdd}>
              <Plus className="h-4 w-4" aria-hidden />
              {t('menu.addDish')}
            </Button>
          ) : null}
          {/* BR-13: only a day that already has dishes gets the unusual-mix note. */}
          {mix && !mix.usual && day.items.length > 0 ? (
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
