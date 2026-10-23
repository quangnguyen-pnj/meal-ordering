'use client';

import { isoWeekdayOf, type MyDayView } from '@meal/shared';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { QuantityStepper } from '@/components/ui/quantity-stepper';
import { formatDate, formatVnTime } from '@/lib/utils';
import { t, vi } from '@/messages';

export const weekdayName = (date: string) =>
  vi.weekdays[isoWeekdayOf(date) as keyof typeof vi.weekdays];

/** Status line of a day for the employee (BR-22 to BR-24). */
export function DayWindowBadge({ day }: { day: MyDayView }) {
  if (day.window === 'LOCKED') return <Badge variant="outline">{t('week.window.LOCKED')}</Badge>;
  // Before closeAt the banner already gives the deadline; only later states need a badge.
  if (day.window === 'OPEN') return null;
  return (
    <Badge variant="warning">
      {t('week.window.AFTER_CLOSE', {
        lock: `${formatVnTime(day.lockAt)} ${formatDate(day.date)}`,
      })}
    </Badge>
  );
}

/**
 * One serving day's meals with a stepper per meal (BR-20), the forecast once taken (BR-07,
 * BR-23), meals waiting for reselection (BR-14) and desserts. Shared by /week and /today.
 */
export function DayMeals({
  day,
  quantities,
  onChange,
}: {
  day: MyDayView;
  quantities: Record<string, number>;
  onChange: (menuItemId: string, quantity: number) => void;
}) {
  const locked = day.window === 'LOCKED';
  return (
    <div className="flex flex-col gap-3">
      {day.needsReselect.map((n) => (
        <Alert key={n.displayName} variant="warning">
          {t('week.needsReselect', {
            dish: n.displayName,
            quantity: n.quantity,
            lock: formatVnTime(day.lockAt),
          })}
        </Alert>
      ))}
      <ul className="flex flex-col gap-2">
        {day.items.map((item) => {
          const value = quantities[item.menuItemId] ?? 0;
          return (
            <li key={item.menuItemId} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{item.displayName}</p>
                {day.forecastTotal !== null && item.forecast !== value ? (
                  <p className="text-xs text-muted-foreground">
                    {t('week.forecast', { count: item.forecast })}
                  </p>
                ) : null}
              </div>
              {locked ? (
                <span className="w-14 text-center text-base font-semibold tabular-nums">
                  {value}
                </span>
              ) : (
                <QuantityStepper
                  value={value}
                  onChange={(q) => onChange(item.menuItemId, q)}
                  label={t('week.quantityOf', { dish: item.displayName })}
                  increaseLabel={t('week.increase', { dish: item.displayName })}
                  decreaseLabel={t('week.decrease', { dish: item.displayName })}
                />
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>
          {day.desserts.length > 0
            ? t('week.dessert', { list: day.desserts.join(', ') })
            : t('week.noDessert')}
        </span>
        {day.forecastTotal !== null ? (
          <span>· {t('week.forecast', { count: day.forecastTotal })}</span>
        ) : null}
        {day.changed ? <Badge variant="warning">{t('week.changed')}</Badge> : null}
        {day.extra ? <Badge variant="secondary">{t('week.extra')}</Badge> : null}
      </div>
    </div>
  );
}
