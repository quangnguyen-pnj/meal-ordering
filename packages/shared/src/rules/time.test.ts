import { describe, expect, it } from 'vitest';
import {
  isoWeekOf,
  addDays,
  isoWeekdayOf,
  mondayOf,
  parseDateString,
  parseTimeOfDay,
  toVnDateTime,
  vnToUtc,
} from './time';

describe('time helpers (Asia/Ho_Chi_Minh, UTC+7)', () => {
  it('converts a UTC instant to Vietnam wall time across midnight', () => {
    const vn = toVnDateTime(new Date('2026-10-22T17:00:00.000Z'));
    expect(vn).toMatchObject({ date: '2026-10-23', hour: 0, minute: 0, isoWeekday: 5 });
  });

  it('round-trips vnToUtc and toVnDateTime', () => {
    const instant = vnToUtc('2026-10-19', '08:00');
    expect(instant.toISOString()).toBe('2026-10-19T01:00:00.000Z');
    expect(toVnDateTime(instant)).toMatchObject({ date: '2026-10-19', hour: 8, minute: 0 });
  });

  it('computes ISO weekdays (Sunday is 7)', () => {
    expect(isoWeekdayOf('2026-10-19')).toBe(1); // Monday
    expect(isoWeekdayOf('2026-10-25')).toBe(7); // Sunday
  });

  it('finds the Monday of a week', () => {
    expect(mondayOf('2026-10-25')).toBe('2026-10-19');
    expect(mondayOf('2026-10-19')).toBe('2026-10-19');
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('rejects malformed or impossible dates and times', () => {
    expect(() => parseDateString('2026-02-30')).toThrow(RangeError);
    expect(() => parseDateString('26-02-10')).toThrow(RangeError);
    expect(() => parseTimeOfDay('24:00')).toThrow(RangeError);
    expect(parseTimeOfDay('08:10')).toBe(490);
  });
});

describe('ISO week number', () => {
  it('counts weeks from the week with the first Thursday', () => {
    expect(isoWeekOf('2026-10-23')).toEqual({ year: 2026, week: 43 });
    expect(isoWeekOf('2026-07-06')).toEqual({ year: 2026, week: 28 });
    expect(isoWeekOf('2026-01-01')).toEqual({ year: 2026, week: 1 });
  });

  it('puts year-end and new-year days in the week their Thursday falls in', () => {
    expect(isoWeekOf('2024-12-30')).toEqual({ year: 2025, week: 1 });
    expect(isoWeekOf('2027-01-01')).toEqual({ year: 2026, week: 53 });
    expect(isoWeekOf('2027-01-03')).toEqual({ year: 2026, week: 53 });
    expect(isoWeekOf('2027-01-04')).toEqual({ year: 2027, week: 1 });
  });
});
