'use client';

import { addDays, type HistoryView } from '@meal/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, Td, Th } from '@/components/ui/table';
import { api } from '@/lib/api';
import { apiErrorText } from '@/lib/errors';
import { formatDate } from '@/lib/utils';
import { t } from '@/messages';
import { weekdayName } from './day-meals';

const STATUS_VARIANT = {
  REGISTERED: 'success',
  NOT_REGISTERED: 'outline',
  CANCELLED: 'error',
} as const;

/** /history: past days with the forecast taken at closeAt, the actual meals and a status. */
export function HistoryScreen() {
  // Null: the API picks the last 4 weeks up to today (server time).
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const query = useQuery({
    queryKey: ['/registrations/me/history', range],
    queryFn: () =>
      api.get<HistoryView>(
        `/registrations/me/history${range ? `?from=${range.from}&to=${range.to}` : ''}`,
      ),
  });
  const data = query.data;
  const shift = (days: number) =>
    data && setRange({ from: addDays(data.from, days), to: addDays(data.to, days) });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('history.title')}</CardTitle>
        <CardDescription>{t('history.intro')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {query.error ? <Alert variant="error">{apiErrorText(query.error)}</Alert> : null}
        {data ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => shift(-28)}>
              ‹ {t('history.earlier')}
            </Button>
            <span className="text-sm font-medium">
              {t('history.range', { from: formatDate(data.from), to: formatDate(data.to) })}
            </span>
            <Button variant="outline" size="sm" disabled={range === null} onClick={() => shift(28)}>
              {t('history.later')} ›
            </Button>
          </div>
        ) : null}
        {query.isLoading ? <p className="text-muted-foreground">{t('common.loading')}</p> : null}
        {data && data.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('history.empty')}</p>
        ) : null}
        {data && data.items.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>{t('history.date')}</Th>
                <Th className="text-right">{t('history.forecast')}</Th>
                <Th className="text-right">{t('history.actual')}</Th>
                <Th>{t('history.meals')}</Th>
                <Th>{t('history.statusLabel')}</Th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((d) => (
                <tr key={d.date}>
                  <Td className="whitespace-nowrap">
                    {weekdayName(d.date)} {formatDate(d.date)}
                  </Td>
                  <Td className="text-right tabular-nums">{d.forecast ?? t('common.none')}</Td>
                  <Td className="text-right tabular-nums">{d.actual}</Td>
                  <Td className="text-sm">
                    {d.meals
                      .map(
                        (m) =>
                          `${m.actual} × ${m.displayName}` +
                          (m.cancelled > 0
                            ? ` (${t('history.cancelled', { count: m.cancelled })})`
                            : ''),
                      )
                      .join(', ') || t('common.none')}
                  </Td>
                  <Td>
                    <Badge variant={STATUS_VARIANT[d.status]}>
                      {t(`history.status.${d.status}`)}
                    </Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : null}
      </CardContent>
    </Card>
  );
}
