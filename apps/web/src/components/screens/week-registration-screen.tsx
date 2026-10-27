'use client';

import { type MyRegistrationWeekView, type SaveRegistrationResult } from '@meal/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useConfirm } from '@/components/confirm-dialog';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingRows } from '@/components/ui/skeleton';
import { WeekNav } from '@/components/week-nav';
import { api } from '@/lib/api';
import { apiErrorText } from '@/lib/errors';
import {
  changedDates,
  dayTotal,
  draftFromDays,
  saveBody,
  setQuantity,
  type Draft,
} from '@/lib/registration-draft';
import { formatCloseAt, formatDate, formatVnTime } from '@/lib/utils';
import { t } from '@/messages';
import { DayMeals, DayWindowBadge, weekdayName } from './day-meals';

const weekUrl = (weekStart: string | null) =>
  `/registrations/me/week${weekStart ? `?weekStart=${weekStart}` : ''}`;

/**
 * /week (J1): one card per serving day with a stepper per meal and no cap (BR-20), the closeAt
 * banner (BR-03). The BR-26 shortcuts were removed (product owner, 2026-10-23). After closeAt
 * each day stays editable until its own lock and shows its difference from the forecast (BR-23).
 */
export function WeekRegistrationScreen() {
  const qc = useQueryClient();
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ['/registrations/me/week', weekStart],
    queryFn: () => api.get<MyRegistrationWeekView>(weekUrl(weekStart)),
  });
  const data = query.data;
  const published = data?.state === 'PUBLISHED' ? data : null;
  const current = weekStart ?? data?.weekStart ?? null;
  // The week the API picked on first load (J1); WeekNav offers a way back to it.
  const [homeWeek, setHomeWeek] = useState<string | null>(null);
  if (!homeWeek && !weekStart && current) setHomeWeek(current);
  const [confirm, confirmDialog] = useConfirm();

  const [draft, setDraft] = useState<Draft>({});
  useEffect(() => {
    setDraft(published ? draftFromDays(published.days) : {});
  }, [published]);

  const days = useMemo(() => published?.days ?? [], [published]);
  const changed = changedDates(days, draft);
  const total = days.reduce((s, d) => s + dayTotal(draft, d.date), 0);

  const save = useMutation({
    mutationFn: () =>
      api.put<SaveRegistrationResult<MyRegistrationWeekView>>(
        '/registrations/me/week',
        saveBody(published!.weekStart, days, draft),
      ),
    onSuccess: (res) => {
      qc.setQueryData(['/registrations/me/week', weekStart], res.view);
      if (res.view.state === 'PUBLISHED') {
        toast.success(
          t('week.saved', { meals: res.view.totalMeals, time: formatCloseAt(res.view.closeAt) }),
        );
      }
    },
  });

  async function go(next: string) {
    if (
      changed.length > 0 &&
      !(await confirm({ title: t('week.leaveConfirm'), confirmLabel: t('week.discard') }))
    )
      return;
    setWeekStart(next);
  }

  const error = query.error ?? save.error;
  const lockTime = days[0] ? formatVnTime(days[0].lockAt) : '';

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <CardTitle>{t('week.title')}</CardTitle>
            <CardDescription>{t('week.intro')}</CardDescription>
          </div>
          {current ? (
            <WeekNav
              weekStart={current}
              onChange={(next) => void go(next)}
              homeWeekStart={homeWeek ?? undefined}
            />
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        {confirmDialog}
        {error ? <Alert variant="destructive">{apiErrorText(error)}</Alert> : null}
        {query.isLoading ? <LoadingRows rows={4} /> : null}
        {data?.state === 'UNASSIGNED' ? (
          <Alert variant="warning">{t('week.unassigned')}</Alert>
        ) : null}
        {data?.state === 'NOT_PUBLISHED' ? (
          <Alert>{t('week.notPublished', { canteen: data.canteenName })}</Alert>
        ) : null}

        {published ? (
          <>
            <Alert variant={'default'}>
              <p>{t('week.canteen', { canteen: published.canteenName })}</p>
              <p className="font-medium">
                {published.forecastTaken
                  ? t('week.afterClose', { lock: lockTime })
                  : t('week.beforeClose', {
                      time: formatCloseAt(published.closeAt),
                      lock: lockTime,
                    })}
              </p>
            </Alert>

            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {days.map((day) => (
                <section
                  key={day.date}
                  className="flex flex-col gap-4 rounded-lg bg-card p-4 shadow-block sm:p-5"
                >
                  <header className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-medium">
                      {weekdayName(day.date)}{' '}
                      <span className="text-xs font-normal text-muted-foreground">
                        ( {formatDate(day.date)} )
                      </span>
                    </h2>
                    <DayWindowBadge day={day} />
                  </header>
                  <DayMeals
                    day={day}
                    quantities={draft[day.date] ?? {}}
                    onChange={(itemId, q) => setDraft((d) => setQuantity(d, day.date, itemId, q))}
                  />
                  <footer className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2">
                    <span className="text-sm font-medium">
                      {t('week.dayTotal', { count: dayTotal(draft, day.date) })}
                    </span>
                  </footer>
                </section>
              ))}
            </div>

            <div className="sticky bottom-0 z-20 -mx-5 flex flex-wrap items-center justify-between gap-3 bg-card px-5 py-3 sm:-mx-6 sm:px-6 shadow-[0_-6px_16px_-6px_rgb(41_37_36/0.12)]">
              <div className="text-sm">
                <p className="font-medium">{t('week.totalMeals', { count: total })}</p>
                <p className="text-muted-foreground">
                  {changed.length > 0 ? t('week.unsaved') : t('week.noChanges')}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={changed.length === 0 || save.isPending}
                  onClick={() => setDraft(draftFromDays(days))}
                >
                  {t('week.discard')}
                </Button>
                <Button
                  disabled={changed.length === 0 || save.isPending}
                  onClick={() => save.mutate()}
                >
                  {save.isPending ? t('common.saving') : t('week.save')}
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
