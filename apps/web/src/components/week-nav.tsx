'use client';

import { addDays } from '@meal/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatWeekRange } from '@/lib/utils';
import { t } from '@/messages';

/** Previous / next week with the Monday–Sunday range, and a jump back to the default week. */
export function WeekNav({
  weekStart,
  onChange,
  homeWeekStart,
}: {
  weekStart: string;
  onChange: (weekStart: string) => void;
  /** The week the screen opens on; a "back" link appears when the user has moved away. */
  homeWeekStart?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        aria-label={t('menu.previousWeek')}
        onClick={() => onChange(addDays(weekStart, -7))}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </Button>
      <p className="min-w-44 text-center text-sm font-medium tabular-nums" aria-live="polite">
        {formatWeekRange(weekStart)}
      </p>
      <Button
        variant="outline"
        size="icon"
        aria-label={t('menu.nextWeek')}
        onClick={() => onChange(addDays(weekStart, 7))}
      >
        <ChevronRight className="h-4 w-4" aria-hidden />
      </Button>
      {homeWeekStart && homeWeekStart !== weekStart ? (
        <Button variant="ghost" size="sm" onClick={() => onChange(homeWeekStart)}>
          {t('menu.backToUpcoming')}
        </Button>
      ) : null}
    </div>
  );
}
