import { describe, expect, it } from 'vitest';
import { defaultSettingValue } from '../settings';
import {
  computeCloseAt,
  dayFreeEditDeadline,
  dayLockAt,
  isMenuPublishWarningDue,
  menuPublishWarnAt,
  upcomingWeekStart,
} from './deadlines';
import { toVnDateTime, vnToUtc } from './time';

const closeRule = defaultSettingValue('registration.close');
const latePublishHours = defaultSettingValue('registration.latePublishHours');
const lockTime = defaultSettingValue('day.lockTime');
const warnRule = defaultSettingValue('menu.publishWarnAt');

// Week N starts Monday 2026-11-02. Week N-1 runs Monday 2026-10-26 to Sunday 2026-11-01, and its
// regular closeAt is 00:00 Friday 2026-10-30 (shown as 23:59 Thursday).
const weekStart = '2026-11-02';
const publishAt = (date: string, time: string) =>
  computeCloseAt({ weekStart, publishedAt: vnToUtc(date, time), closeRule, latePublishHours });
const vn = (d: Date) => {
  const v = toVnDateTime(d);
  return `${v.date} ${String(v.hour).padStart(2, '0')}:${String(v.minute).padStart(2, '0')}`;
};

describe('closeAt at publish (BR-03, BR-04)', () => {
  it('BR-03: publishing on Monday of week N-1 keeps the regular closeAt (Friday 00:00)', () => {
    const r = publishAt('2026-10-26', '10:00');
    expect(vn(r.closeAt)).toBe('2026-10-30 00:00');
    expect(r.latePublish).toBe(false);
  });

  it('BR-03: publishing at Thursday 23:59 does not extend the close', () => {
    const r = publishAt('2026-10-29', '23:59');
    expect(vn(r.closeAt)).toBe('2026-10-30 00:00');
    expect(r.latePublish).toBe(false);
  });

  it('BR-04: publishing at Friday 00:00 exactly is already late (closeAt is exclusive)', () => {
    const r = publishAt('2026-10-30', '00:00');
    expect(r.latePublish).toBe(true);
    expect(vn(r.closeAt)).toBe('2026-10-31 00:00');
  });

  it('BR-04: publishing at Friday 00:01 gives closeAt = publish time + 24 hours', () => {
    const r = publishAt('2026-10-30', '00:01');
    expect(vn(r.closeAt)).toBe('2026-10-31 00:01');
    expect(r.latePublish).toBe(true);
    expect(vn(r.regularCloseAt)).toBe('2026-10-30 00:00');
  });

  it('BR-04: publishing on Saturday gives closeAt on Sunday at the same time', () => {
    const r = publishAt('2026-10-31', '09:30');
    expect(vn(r.closeAt)).toBe('2026-11-01 09:30');
  });

  it('BR-04: publishing on Sunday 20:00 gives closeAt Monday 20:00 of week N', () => {
    const r = publishAt('2026-11-01', '20:00');
    expect(vn(r.closeAt)).toBe('2026-11-02 20:00');
    expect(r.latePublish).toBe(true);
  });

  it('BR-04: the extension comes from registration.latePublishHours, not from code', () => {
    const r = computeCloseAt({
      weekStart,
      publishedAt: vnToUtc('2026-10-30', '10:00'),
      closeRule,
      latePublishHours: 6,
    });
    expect(vn(r.closeAt)).toBe('2026-10-30 16:00');
  });
});

describe('BR-05: a late closeAt never pushes a day past its own lock', () => {
  const sundayPublish = publishAt('2026-11-01', '20:00'); // closeAt Monday 20:00

  it('BR-05: Monday still locks at its own 08:00 when closeAt is Monday 20:00', () => {
    expect(vn(dayFreeEditDeadline('2026-11-02', sundayPublish.closeAt, lockTime))).toBe(
      '2026-11-02 08:00',
    );
  });

  it('BR-05: Tuesday is bounded by the closeAt (Monday 20:00), which comes before its lock', () => {
    expect(vn(dayFreeEditDeadline('2026-11-03', sundayPublish.closeAt, lockTime))).toBe(
      '2026-11-02 20:00',
    );
  });

  it('BR-05: with a regular closeAt every day is bounded by the closeAt', () => {
    const regular = publishAt('2026-10-26', '10:00').closeAt;
    expect(dayFreeEditDeadline('2026-11-02', regular, lockTime)).toEqual(regular);
  });

  it('BR-05: the day lock time is read from day.lockTime', () => {
    expect(vn(dayLockAt('2026-11-02', '07:30'))).toBe('2026-11-02 07:30');
  });
});

describe('BR-06: menu-not-published warning', () => {
  it('BR-06: starts at 12:00 Monday of week N-1', () => {
    expect(vn(menuPublishWarnAt(weekStart, warnRule))).toBe('2026-10-26 12:00');
  });

  it('BR-06: is not due at 11:59 Monday, is due at 12:00, and stops once published', () => {
    const due = (date: string, time: string, published = false) =>
      isMenuPublishWarningDue({ now: vnToUtc(date, time), weekStart, warnRule, published });
    expect(due('2026-10-26', '11:59')).toBe(false);
    expect(due('2026-10-26', '12:00')).toBe(true);
    expect(due('2026-10-29', '16:00')).toBe(true);
    expect(due('2026-10-29', '16:00', true)).toBe(false);
  });

  it('BR-06: the target week is the Monday after the current Vietnam week', () => {
    expect(upcomingWeekStart(vnToUtc('2026-10-26', '12:00'))).toBe(weekStart);
    // Sunday 23:30 VN still belongs to week N-1.
    expect(upcomingWeekStart(vnToUtc('2026-11-01', '23:30'))).toBe(weekStart);
    expect(upcomingWeekStart(vnToUtc('2026-11-02', '00:00'))).toBe('2026-11-09');
  });
});
