'use client';

import { addDays, isoWeekdayOf, type MyMenuWeekView } from '@meal/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { apiErrorText } from '@/lib/errors';
import { formatCloseAt, formatDate } from '@/lib/utils';
import { t, vi } from '@/messages';

/**
 * /week, Phase 1 part: the published menu of the employee's canteen (BR-02, BR-15). The quantity
 * steppers and shortcuts for registration arrive in P2.
 */
export function WeekMenuScreen() {
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const menu = useQuery({
    queryKey: ['/menu/my-week', weekStart],
    queryFn: () =>
      api.get<MyMenuWeekView>(`/menu/my-week${weekStart ? `?weekStart=${weekStart}` : ''}`),
  });
  const data = menu.data;
  const current =
    weekStart ?? (data?.state === 'PUBLISHED' ? data.menu.weekStart : data?.weekStart);

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
                onClick={() => setWeekStart(addDays(current, -7))}
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
                onClick={() => setWeekStart(addDays(current, 7))}
              >
                ›
              </Button>
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {menu.error ? <Alert variant="error">{apiErrorText(menu.error)}</Alert> : null}
        {data?.state === 'UNASSIGNED' ? (
          <Alert variant="warning">{t('week.unassigned')}</Alert>
        ) : null}
        {data?.state === 'NOT_PUBLISHED' ? (
          <Alert>{t('week.notPublished', { canteen: data.canteenName })}</Alert>
        ) : null}
        {data?.state === 'PUBLISHED' ? (
          <>
            <p className="text-sm">
              {t('week.canteen', { canteen: data.menu.canteenName })} ·{' '}
              <strong>{t('week.closeAt', { time: formatCloseAt(data.menu.closeAt) })}</strong>
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.menu.days.map((day) => (
                <section key={day.date} className="rounded-md border p-3">
                  <h2 className="font-medium">
                    {vi.weekdays[isoWeekdayOf(day.date) as keyof typeof vi.weekdays]}{' '}
                    <span className="text-sm font-normal text-muted-foreground">
                      {formatDate(day.date)}
                    </span>
                  </h2>
                  <ul className="mt-2 flex flex-col gap-1 text-sm">
                    {day.items.map((i) => (
                      <li key={i.id}>{i.displayName}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {day.desserts.length > 0
                      ? `${t('menu.desserts')}: ${day.desserts.map((d) => d.name).join(', ')}`
                      : t('week.noDessert')}
                  </p>
                </section>
              ))}
            </div>
          </>
        ) : null}
        {menu.isLoading ? <p className="text-muted-foreground">{t('common.loading')}</p> : null}
      </CardContent>
    </Card>
  );
}
