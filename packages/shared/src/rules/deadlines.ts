import type { WeekdayTime } from '../settings';
import { addDays, isoWeekdayOf, vnToUtc, type DateString } from './time';

const MS_PER_MINUTE = 60_000;

/**
 * BR-03: registration for week N closes at the end of Thursday of week N-1.
 *
 * `rule` is the `registration.close` setting. Its `time` is the LAST accepted minute (23:59), and
 * the returned closeAt is the exclusive instant one minute later (00:00 Friday), so a save at
 * 23:59:59 is accepted and a save at 00:00:00 is rejected.
 *
 * This is the regular closeAt only. The late-publish variant (BR-04, BR-05) is Phase 1 work.
 *
 * @param weekStart Monday (YYYY-MM-DD) of the week being served (week N).
 */
export function regularCloseAt(weekStart: DateString, rule: WeekdayTime): Date {
  if (isoWeekdayOf(weekStart) !== 1) {
    throw new RangeError(`weekStart must be a Monday, got ${weekStart}`);
  }
  // Week N-1 starts 7 days before weekStart; the rule's weekday is 1-based from Monday.
  const closeDay = addDays(weekStart, -7 + (rule.weekday - 1));
  return new Date(vnToUtc(closeDay, rule.time).getTime() + MS_PER_MINUTE);
}

/** closeAt is exclusive: registration is open strictly before it. */
export function isRegistrationOpen(now: Date, closeAt: Date): boolean {
  return now.getTime() < closeAt.getTime();
}
