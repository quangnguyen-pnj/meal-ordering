'use client';

import { isoWeekdayOf, type MyMenuWeekView } from '@meal/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingRows } from '@/components/ui/skeleton';
import { WeekNav } from '@/components/week-nav';
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
  // The week the API picked on first load; WeekNav offers a way back to it.
  const [homeWeek, setHomeWeek] = useState<string | null>(null);
  const menu = useQuery({
    queryKey: ['/menu/my-week', weekStart],
    queryFn: () =>
      api.get<MyMenuWeekView>(`/menu/my-week${weekStart ? `?weekStart=${weekStart}` : ''}`),
  });
  const data = menu.data;
  const current =
    weekStart ?? (data?.state === 'PUBLISHED' ? data.menu.weekStart : data?.weekStart);
  if (!homeWeek && !weekStart && current) setHomeWeek(current);

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
              onChange={setWeekStart}
              homeWeekStart={homeWeek ?? undefined}
            />
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
                  <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm">
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
        {menu.isLoading ? <LoadingRows rows={4} /> : null}
      </CardContent>
    </Card>
  );
}
