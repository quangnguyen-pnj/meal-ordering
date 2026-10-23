import { describe, expect, it } from 'vitest';
import { defaultSettingValue } from '../settings';
import { regularCloseAt } from './deadlines';
import {
  adminDayWindow,
  compareWithForecast,
  employeeDayWindow,
  forecastLinesOf,
  isLostByLeaver,
  validateDaySelection,
} from './registration';
import { vnToUtc } from './time';

const LOCK = defaultSettingValue('day.lockTime'); // 08:00
const CLOSE_RULE = defaultSettingValue('registration.close'); // Thursday 23:59

// Week N starts Monday 2026-11-02; closeAt is Friday 2026-10-30 00:00 (shown 23:59 Thursday).
const WEEK = '2026-11-02';
const MONDAY = WEEK;
const closeAt = regularCloseAt(WEEK, CLOSE_RULE);
const at = (date: string, time: string, seconds = 0) =>
  new Date(vnToUtc(date, time).getTime() + seconds * 1000);

describe('BR-20: no portion limit (example table of plan 2.3)', () => {
  // Menu of Mặn Cá kho, Mặn Thịt kho, Chay, Cháo.
  const menu = new Set(['ca', 'thit', 'chay', 'chao']);

  it('BR-20: 3 Mặn Cá kho is valid (no portion limit)', () => {
    expect(validateDaySelection([{ menuItemId: 'ca', quantity: 3 }], menu)).toEqual({ ok: true });
  });

  it('BR-20: 1 Chay + 1 Cháo + 1 Mặn Cá kho + 1 Mặn Thịt kho is valid (several dishes and types)', () => {
    const lines = ['chay', 'chao', 'ca', 'thit'].map((menuItemId) => ({ menuItemId, quantity: 1 }));
    expect(validateDaySelection(lines, menu)).toEqual({ ok: true });
  });

  it('BR-20: 0 of every dish is valid and means not registered', () => {
    const lines = [...menu].map((menuItemId) => ({ menuItemId, quantity: 0 }));
    expect(validateDaySelection(lines, menu)).toEqual({ ok: true });
    expect(validateDaySelection([], menu)).toEqual({ ok: true });
  });

  it('BR-20: −1 Mặn Cá kho is invalid: quantity must be non-negative', () => {
    expect(validateDaySelection([{ menuItemId: 'ca', quantity: -1 }], menu)).toEqual({
      ok: false,
      errors: [{ code: 'QUANTITY_NEGATIVE', menuItemId: 'ca' }],
    });
  });

  it('BR-20: 1.5 Chay is invalid: quantity must be an integer', () => {
    expect(validateDaySelection([{ menuItemId: 'chay', quantity: 1.5 }], menu)).toEqual({
      ok: false,
      errors: [{ code: 'QUANTITY_NOT_INTEGER', menuItemId: 'chay' }],
    });
  });

  it("BR-20: a dish not on that day's menu is invalid", () => {
    expect(validateDaySelection([{ menuItemId: 'pho', quantity: 1 }], menu)).toEqual({
      ok: false,
      errors: [{ code: 'ITEM_NOT_ON_MENU', menuItemId: 'pho' }],
    });
  });

  it('BR-20: the same dish twice in one selection is rejected as ambiguous', () => {
    const res = validateDaySelection(
      [
        { menuItemId: 'ca', quantity: 1 },
        { menuItemId: 'ca', quantity: 2 },
      ],
      menu,
    );
    expect(res).toEqual({ ok: false, errors: [{ code: 'DUPLICATE_ITEM', menuItemId: 'ca' }] });
  });

  it('BR-20: a cap could later be added as a setting without touching callers; none applies today', () => {
    const lines = [{ menuItemId: 'ca', quantity: 50 }];
    expect(validateDaySelection(lines, menu).ok).toBe(true);
    expect(validateDaySelection(lines, menu, { maxPerDay: 10 }).ok).toBe(false);
  });
});

describe('BR-22 to BR-24: what an employee may change, and when', () => {
  const window = (now: Date, date = MONDAY, forecastTaken = false) =>
    employeeDayWindow({ now, date, closeAt, lockTime: LOCK, forecastTaken });

  it('BR-22: before closeAt an employee adds, changes and removes freely', () => {
    expect(window(at('2026-10-27', '10:00'))).toBe('OPEN');
    expect(window(at('2026-10-29', '23:59', 59))).toBe('OPEN');
  });

  it('BR-22: at closeAt (Friday 00:00) the free period ends; the result is the forecast', () => {
    expect(window(at('2026-10-30', '00:00'))).toBe('AFTER_CLOSE');
  });

  it('BR-23: from closeAt to 08:00 on day D, employees may still add, change and remove', () => {
    expect(window(at('2026-10-31', '15:00'))).toBe('AFTER_CLOSE');
    expect(window(at(MONDAY, '07:59', 59))).toBe('AFTER_CLOSE');
  });

  it('BR-23: an employee with no forecast can add a meal at 07:59 on day D', () => {
    // The window does not depend on having a forecast; validation accepts a first line.
    expect(window(at(MONDAY, '07:59'))).toBe('AFTER_CLOSE');
    expect(validateDaySelection([{ menuItemId: 'ca', quantity: 1 }], new Set(['ca'])).ok).toBe(
      true,
    );
  });

  it('BR-23: once the forecast was taken, a change counts as after closeAt whatever the clock says', () => {
    expect(window(at('2026-10-29', '23:59', 59), MONDAY, true)).toBe('AFTER_CLOSE');
  });

  it('BR-24: at 08:00 on day D employees cannot change anything', () => {
    expect(window(at(MONDAY, '08:00'))).toBe('LOCKED');
    expect(window(at(MONDAY, '12:00'))).toBe('LOCKED');
    // Tuesday is still open for changes on Monday morning.
    expect(window(at(MONDAY, '08:00'), '2026-11-03')).toBe('AFTER_CLOSE');
  });

  it('BR-05 / BR-24: a late closeAt after a day’s 08:00 still locks that day at 08:00', () => {
    const lateClose = at(MONDAY, '20:00');
    expect(
      employeeDayWindow({
        now: at(MONDAY, '09:00'),
        date: MONDAY,
        closeAt: lateClose,
        lockTime: LOCK,
      }),
    ).toBe('LOCKED');
    expect(
      employeeDayWindow({
        now: at(MONDAY, '09:00'),
        date: '2026-11-03',
        closeAt: lateClose,
        lockTime: LOCK,
      }),
    ).toBe('OPEN');
  });

  it('BR-24: the lock time comes from the setting', () => {
    expect(
      employeeDayWindow({ now: at(MONDAY, '08:30'), date: MONDAY, closeAt, lockTime: '09:00' }),
    ).toBe('AFTER_CLOSE');
  });
});

describe('BR-21 / BR-25: what an admin may do for an employee', () => {
  const window = (now: Date, finalized = false) =>
    adminDayWindow({ now, date: MONDAY, lockTime: LOCK, finalized });

  it('BR-21: dept admins register on behalf until 08:00 on day D, also after closeAt', () => {
    expect(window(at('2026-10-27', '09:00'))).toBe('ON_BEHALF');
    expect(window(at(MONDAY, '07:59'))).toBe('ON_BEHALF');
  });

  it('BR-25: after 08:00 and before finalization, admins only add meals flagged Extra', () => {
    expect(window(at(MONDAY, '08:00'))).toBe('EXTRA');
    expect(window(at(MONDAY, '08:25'))).toBe('EXTRA');
  });

  it('BR-25: after finalization nothing goes through registration (BR-46)', () => {
    expect(window(at(MONDAY, '08:40'), true)).toBe('CLOSED');
  });

  it('BR-25: until finalization exists (P4), the extra window ends with day D', () => {
    expect(window(at(MONDAY, '23:59'))).toBe('EXTRA');
    expect(window(at('2026-11-03', '00:00'))).toBe('CLOSED');
  });
});

describe('BR-07: forecast lines and differences', () => {
  it('BR-07: the forecast holds active lines with a positive quantity only', () => {
    const regs = [
      { menuItemId: 'a', quantity: 2, status: 'ACTIVE' as const },
      { menuItemId: 'b', quantity: 0, status: 'ACTIVE' as const },
      { menuItemId: 'c', quantity: 1, status: 'NEEDS_RESELECT' as const },
      { menuItemId: 'd', quantity: 1, status: 'CANCELLED' as const },
    ];
    expect(forecastLinesOf(regs).map((r) => r.menuItemId)).toEqual(['a']);
  });

  it('BR-23: an added meal and a first meal without forecast both show as differences', () => {
    const added = compareWithForecast(
      [{ menuItemId: 'ca', quantity: 1 }],
      [
        { menuItemId: 'ca', quantity: 1 },
        { menuItemId: 'chay', quantity: 1 },
      ],
    );
    expect(added.changed).toBe(true);
    expect(added.lines).toEqual([
      { menuItemId: 'ca', forecast: 1, actual: 1, difference: 0 },
      { menuItemId: 'chay', forecast: 0, actual: 1, difference: 1 },
    ]);
    expect([added.forecastTotal, added.actualTotal]).toEqual([1, 2]);

    const noForecast = compareWithForecast([], [{ menuItemId: 'ca', quantity: 1 }]);
    expect(noForecast).toMatchObject({ changed: true, forecastTotal: 0, actualTotal: 1 });
  });

  it('BR-23: removing everything is a negative difference; unchanged is no difference', () => {
    expect(compareWithForecast([{ menuItemId: 'ca', quantity: 2 }], []).lines).toEqual([
      { menuItemId: 'ca', forecast: 2, actual: 0, difference: -2 },
    ]);
    expect(
      compareWithForecast(
        [{ menuItemId: 'ca', quantity: 2 }],
        [
          { menuItemId: 'ca', quantity: 2 },
          { menuItemId: 'chay', quantity: 0 },
        ],
      ),
    ).toMatchObject({ changed: false });
  });
});

describe('BR-36: leavers lose their meals from their end date', () => {
  const now = at('2026-11-02', '02:00');
  it('BR-36: meals on and after the end date are lost; earlier ones are kept', () => {
    const lost = (date: string) =>
      isLostByLeaver({ date, endDate: '2026-11-04', now, lockTime: LOCK });
    expect(lost('2026-11-03')).toBe(false);
    expect(lost('2026-11-04')).toBe(true);
    expect(lost('2026-11-06')).toBe(true);
  });

  it('BR-36: a day whose lock has passed is left alone (reconciliation shows it)', () => {
    expect(
      isLostByLeaver({
        date: '2026-11-02',
        endDate: '2026-10-30',
        now: at('2026-11-02', '09:00'),
        lockTime: LOCK,
      }),
    ).toBe(false);
  });
});
