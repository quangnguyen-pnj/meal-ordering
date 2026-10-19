/**
 * Asia/Ho_Chi_Minh helpers. Vietnam has used a fixed UTC+7 offset (no DST) since 1975, so plain
 * offset arithmetic is exact and keeps the shared package free of timezone libraries.
 *
 * Instants are stored in UTC (plan 7.1 rule 4); these functions convert to and from Vietnam wall
 * time. None of them reads the clock: callers pass `now` in.
 */
export const VN_UTC_OFFSET_MINUTES = 7 * 60;
const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;

/** Calendar date as `YYYY-MM-DD` (serving days are dates, not instants). */
export type DateString = string;

export interface VnDateTime {
  date: DateString;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** ISO weekday: 1 = Monday ... 7 = Sunday. */
  isoWeekday: number;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

export function parseDateString(date: DateString): { year: number; month: number; day: number } {
  const m = DATE_RE.exec(date);
  if (!m) throw new RangeError(`Invalid date "${date}", expected YYYY-MM-DD`);
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    throw new RangeError(`Invalid calendar date "${date}"`);
  }
  return { year, month, day };
}

export function formatDateString(year: number, month: number, day: number): DateString {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

/** Minutes since midnight for an `HH:mm` string. */
export function parseTimeOfDay(time: string): number {
  const m = TIME_RE.exec(time);
  if (!m) throw new RangeError(`Invalid time "${time}", expected HH:mm`);
  return Number(m[1]) * 60 + Number(m[2]);
}

export function toVnDateTime(instant: Date): VnDateTime {
  const shifted = new Date(instant.getTime() + VN_UTC_OFFSET_MINUTES * MS_PER_MINUTE);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth() + 1;
  const day = shifted.getUTCDate();
  const jsWeekday = shifted.getUTCDay(); // 0 = Sunday
  return {
    date: formatDateString(year, month, day),
    year,
    month,
    day,
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
    isoWeekday: jsWeekday === 0 ? 7 : jsWeekday,
  };
}

/** The UTC instant at which Vietnam wall time reads `date` + `time` (HH:mm). */
export function vnToUtc(date: DateString, time: string): Date {
  const { year, month, day } = parseDateString(date);
  const minutes = parseTimeOfDay(time);
  const utcMs =
    Date.UTC(year, month - 1, day) +
    minutes * MS_PER_MINUTE -
    VN_UTC_OFFSET_MINUTES * MS_PER_MINUTE;
  return new Date(utcMs);
}

export function addDays(date: DateString, days: number): DateString {
  const { year, month, day } = parseDateString(date);
  const shifted = new Date(Date.UTC(year, month - 1, day) + days * MS_PER_DAY);
  return formatDateString(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth() + 1,
    shifted.getUTCDate(),
  );
}

/** ISO weekday (1 = Monday ... 7 = Sunday) of a calendar date. */
export function isoWeekdayOf(date: DateString): number {
  const { year, month, day } = parseDateString(date);
  const js = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return js === 0 ? 7 : js;
}

/** Monday of the week containing `date`. */
export function mondayOf(date: DateString): DateString {
  return addDays(date, -(isoWeekdayOf(date) - 1));
}
