'use client';

import { addDays, type MyRegistrationWeekView, type SaveRegistrationResult } from '@meal/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CopyCheck, History } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { apiErrorText } from '@/lib/errors';
import {
  applyDayToWeek,
  applySameAsLastWeek,
  changedDates,
  dayTotal,
  draftFromDays,
  isEditable,
  saveBody,
  setQuantity,
  type Draft,
} from '@/lib/registration-draft';
import { formatCloseAt, formatDate, formatVnTime } from '@/lib/utils';
import { t, vi } from '@/messages';
import { DayMeals, DayWindowBadge, weekdayName } from './day-meals';

type Notice = { variant: 'info' | 'warning'; lines: string[] } | null;

const weekUrl = (weekStart: string | null) =>
  `/registrations/me/week${weekStart ? `?weekStart=${weekStart}` : ''}`;

/**
 * /week (J1): one card per serving day with a stepper per meal and no cap (BR-20), the closeAt
 * banner (BR-03), "Same as last week" and "Apply to whole week" (BR-26). After closeAt each day
 * stays editable until its own lock and shows its difference from the forecast (BR-23).
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

  const [draft, setDraft] = useState<Draft>({});
  const [notice, setNotice] = useState<Notice>(null);
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
        setNotice({
          variant: 'info',
          lines: [
            t('week.saved', {
              meals: res.view.totalMeals,
              time: formatCloseAt(res.view.closeAt),
            }),
          ],
        });
      }
    },
  });

  const lastWeek = useMutation({
    mutationFn: () => api.get<MyRegistrationWeekView>(weekUrl(addDays(published!.weekStart, -7))),
    onSuccess: (prev) => {
      if (prev.state !== 'PUBLISHED') {
        setNotice({ variant: 'warning', lines: [t('week.lastWeekEmpty')] });
        return;
      }
      const res = applySameAsLastWeek(draft, days, prev.days);
      if (res.copied === 0) {
        setNotice({ variant: 'warning', lines: [t('week.lastWeekEmpty')] });
        return;
      }
      setDraft(res.draft);
      setNotice(shortcutNotice(res.skipped));
    },
  });

  function shortcutNotice(skipped: Array<{ date: string; type: string; quantity: number }>) {
    return {
      variant: skipped.length > 0 ? ('warning' as const) : ('info' as const),
      lines: [
        t('week.shortcutDone'),
        ...skipped.map((s) =>
          t('week.shortcutSkipped', {
            weekday: weekdayName(s.date),
            type: vi.dishTypes[s.type as keyof typeof vi.dishTypes],
            quantity: s.quantity,
          }),
        ),
      ],
    };
  }

  const go = (delta: number) => {
    if (!current) return;
    if (changed.length > 0 && !window.confirm(t('week.leaveConfirm'))) return;
    setNotice(null);
    setWeekStart(addDays(current, delta));
  };

  const error = query.error ?? save.error ?? lastWeek.error;
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
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                aria-label={t('menu.previousWeek')}
                onClick={() => go(-7)}
              >
                ‹
              </Button>
              <span className="min-w-28 text-center text-sm font-medium">
                {formatDate(current)}
              </span>
              <Button
                variant="outline"
                size="icon"
                aria-label={t('menu.nextWeek')}
                onClick={() => go(7)}
              >
                ›
              </Button>
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error ? <Alert variant="error">{apiErrorText(error)}</Alert> : null}
        {query.isLoading ? <p className="text-muted-foreground">{t('common.loading')}</p> : null}
        {data?.state === 'UNASSIGNED' ? (
          <Alert variant="warning">{t('week.unassigned')}</Alert>
        ) : null}
        {data?.state === 'NOT_PUBLISHED' ? (
          <Alert>{t('week.notPublished', { canteen: data.canteenName })}</Alert>
        ) : null}

        {published ? (
          <>
            <Alert variant={published.forecastTaken ? 'info' : 'warning'}>
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

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={lastWeek.isPending || !days.some(isEditable)}
                onClick={() => lastWeek.mutate()}
              >
                <History className="h-4 w-4" aria-hidden />
                {t('week.sameAsLastWeek')}
              </Button>
            </div>
            {notice ? (
              <Alert variant={notice.variant} role="status">
                {notice.lines.map((l) => (
                  <p key={l}>{l}</p>
                ))}
              </Alert>
            ) : null}

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {days.map((day) => (
                <section key={day.date} className="flex flex-col gap-3 rounded-md border p-3">
                  <header className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-medium">
                      {weekdayName(day.date)}{' '}
                      <span className="text-sm font-normal text-muted-foreground">
                        {formatDate(day.date)}
                      </span>
                    </h2>
                    <DayWindowBadge day={day} />
                  </header>
                  <DayMeals
                    day={day}
                    quantities={draft[day.date] ?? {}}
                    onChange={(itemId, q) => setDraft((d) => setQuantity(d, day.date, itemId, q))}
                  />
                  <footer className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t pt-2">
                    <span className="text-sm font-medium">
                      {t('week.dayTotal', { count: dayTotal(draft, day.date) })}
                    </span>
                    {isEditable(day) ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const res = applyDayToWeek(draft, days, day);
                          setDraft(res.draft);
                          setNotice(shortcutNotice(res.skipped));
                        }}
                      >
                        <CopyCheck className="h-4 w-4" aria-hidden />
                        {t('week.applyToWeek')}
                      </Button>
                    ) : null}
                  </footer>
                </section>
              ))}
            </div>

            <div className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card p-3 shadow-sm">
              <div className="text-sm">
                <p className="font-medium">{t('week.totalMeals', { count: total })}</p>
                <p className="text-muted-foreground">
                  {changed.length > 0 ? t('week.unsaved') : t('week.noChanges')}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  disabled={changed.length === 0 || save.isPending}
                  onClick={() => {
                    setDraft(draftFromDays(days));
                    setNotice(null);
                  }}
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
