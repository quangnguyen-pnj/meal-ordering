import { describe, expect, it } from 'vitest';
import { defaultSettingValue } from '../settings';
import { isRegistrationOpen, lastAcceptedMinute, regularCloseAt } from './deadlines';
import { toVnDateTime } from './time';

const closeRule = defaultSettingValue('registration.close');

describe('BR-03: regular registration closeAt', () => {
  // Week N starts Monday 2026-10-26, so week N-1's Thursday is 2026-10-22.
  const weekStart = '2026-10-26';

  it('BR-03: closeAt is 00:00 Friday Vietnam time, one minute after the displayed 23:59 Thursday', () => {
    const closeAt = regularCloseAt(weekStart, closeRule);
    const vn = toVnDateTime(closeAt);
    expect(vn.date).toBe('2026-10-23');
    expect(vn.isoWeekday).toBe(5);
    expect([vn.hour, vn.minute, vn.second]).toEqual([0, 0, 0]);
    // 00:00 Vietnam on 2026-10-23 is 17:00 UTC the day before.
    expect(closeAt.toISOString()).toBe('2026-10-22T17:00:00.000Z');
  });

  it('BR-03: the UI shows 23:59 Thursday for a closeAt of 00:00 Friday', () => {
    const shown = toVnDateTime(lastAcceptedMinute(regularCloseAt(weekStart, closeRule)));
    expect([shown.date, shown.isoWeekday, shown.hour, shown.minute]).toEqual([
      '2026-10-22',
      4,
      23,
      59,
    ]);
  });

  it('BR-03: a save at Thursday 23:59:30 is accepted', () => {
    const closeAt = regularCloseAt(weekStart, closeRule);
    const thursdayNight = new Date('2026-10-22T16:59:30.000Z'); // 23:59:30 VN
    expect(isRegistrationOpen(thursdayNight, closeAt)).toBe(true);
  });

  it('BR-03: a save at Thursday 23:59:59 is accepted', () => {
    const closeAt = regularCloseAt(weekStart, closeRule);
    expect(isRegistrationOpen(new Date('2026-10-22T16:59:59.000Z'), closeAt)).toBe(true);
  });

  it('BR-03: closeAt is exclusive, so a save at Friday 00:00:00 is rejected', () => {
    const closeAt = regularCloseAt(weekStart, closeRule);
    expect(isRegistrationOpen(new Date('2026-10-22T17:00:00.000Z'), closeAt)).toBe(false);
  });

  it('BR-03: Thursday 23:59:30 and Friday 00:00 give different results', () => {
    const closeAt = regularCloseAt(weekStart, closeRule);
    const before = isRegistrationOpen(new Date('2026-10-22T16:59:30.000Z'), closeAt);
    const after = isRegistrationOpen(new Date('2026-10-22T17:00:00.000Z'), closeAt);
    expect(before).not.toBe(after);
  });

  it('BR-03: the close weekday and time come from the setting, not from code', () => {
    const closeAt = regularCloseAt(weekStart, { weekday: 3, time: '17:00' }); // Wednesday 17:00
    expect(closeAt.toISOString()).toBe('2026-10-21T10:01:00.000Z'); // 17:01 VN
  });

  it('BR-03: weekStart must be a Monday', () => {
    expect(() => regularCloseAt('2026-10-27', closeRule)).toThrow(RangeError);
  });

  it('BR-03: closeAt crosses a month and year boundary correctly', () => {
    // Week N starts Monday 2027-01-04; Thursday of week N-1 is 2024-12-31 + ... = 2020? check: 2027-01-04 - 4 = 2026-12-31
    const closeAt = regularCloseAt('2027-01-04', closeRule);
    expect(toVnDateTime(closeAt).date).toBe('2027-01-01');
  });
});
