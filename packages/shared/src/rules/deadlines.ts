import type { WeekdayTime } from '../settings';
import { addDays, isoWeekdayOf, mondayOf, toVnDateTime, vnToUtc, type DateString } from './time';

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;

/**
 * BR-03: registration for week N closes at the end of Thursday of week N-1.
 *
 * `rule` is the `registration.close` setting. Its `time` is the LAST accepted minute (23:59), and
 * the returned closeAt is the exclusive instant one minute later (00:00 Friday), so a save at
 * 23:59:59 is accepted and a save at 00:00:00 is rejected.
 *
 * This is the regular closeAt only; `computeCloseAt` adds the late-publish case (BR-04).
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

/**
 * BR-03: what the UI shows for a closeAt. closeAt is exclusive (00:00 Friday), so screens show
 * the last accepted minute (23:59 Thursday).
 */
export function lastAcceptedMinute(closeAt: Date): Date {
  return new Date(closeAt.getTime() - MS_PER_MINUTE);
}

/** closeAt is exclusive: registration is open strictly before it. */
export function isRegistrationOpen(now: Date, closeAt: Date): boolean {
  return now.getTime() < closeAt.getTime();
}

export interface CloseAtResult {
  closeAt: Date;
  /** True when BR-04 applied: the menu was published at or after the regular closeAt. */
  latePublish: boolean;
  regularCloseAt: Date;
}

/**
 * BR-03 / BR-04: closeAt of week N, computed once at publish time.
 *
 * - Published before the regular closeAt: closeAt is the regular one (a late publish before that
 *   instant does not extend it, BR-03).
 * - Still unpublished at the regular closeAt: closeAt = publish time + `latePublishHours` (BR-04).
 *
 * Per-day locks still apply on top of this (BR-05, see `dayFreeEditDeadline`).
 */
export function computeCloseAt(args: {
  weekStart: DateString;
  publishedAt: Date;
  closeRule: WeekdayTime;
  latePublishHours: number;
}): CloseAtResult {
  const regular = regularCloseAt(args.weekStart, args.closeRule);
  if (args.publishedAt.getTime() < regular.getTime()) {
    return { closeAt: regular, latePublish: false, regularCloseAt: regular };
  }
  return {
    closeAt: new Date(args.publishedAt.getTime() + args.latePublishHours * MS_PER_HOUR),
    latePublish: true,
    regularCloseAt: regular,
  };
}

/** The instant serving day `date` locks for employees (`day.lockTime`, 08:00 by default). */
export function dayLockAt(date: DateString, lockTime: string): Date {
  return vnToUtc(date, lockTime);
}

/**
 * BR-05: a late closeAt (BR-04) never pushes a serving day past its own lock. The free-edit
 * deadline of a day is the earlier of the week's closeAt and that day's lock.
 */
export function dayFreeEditDeadline(date: DateString, closeAt: Date, lockTime: string): Date {
  const lock = dayLockAt(date, lockTime);
  return lock.getTime() < closeAt.getTime() ? lock : closeAt;
}

/** BR-06: when the "menu not published" warning for week N starts (Monday 12:00 of week N-1). */
export function menuPublishWarnAt(weekStart: DateString, rule: WeekdayTime): Date {
  if (isoWeekdayOf(weekStart) !== 1) {
    throw new RangeError(`weekStart must be a Monday, got ${weekStart}`);
  }
  return vnToUtc(addDays(weekStart, -7 + (rule.weekday - 1)), rule.time);
}

/** BR-06: the week whose menu the warning is about: the Monday after the current Vietnam week. */
export function upcomingWeekStart(now: Date): DateString {
  return addDays(mondayOf(toVnDateTime(now).date), 7);
}

/** BR-06: warn the HC admin from `menu.publishWarnAt` until week N's menu is published. */
export function isMenuPublishWarningDue(args: {
  now: Date;
  weekStart: DateString;
  warnRule: WeekdayTime;
  published: boolean;
}): boolean {
  if (args.published) return false;
  return args.now.getTime() >= menuPublishWarnAt(args.weekStart, args.warnRule).getTime();
}
