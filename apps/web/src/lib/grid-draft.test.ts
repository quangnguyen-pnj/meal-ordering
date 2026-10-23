import type { RegistrationGridView } from '@meal/shared';
import { describe, expect, it } from 'vitest';
import { columnTotals, gridChanges, gridValues, parseCell } from './grid-draft';

const DATE = '2026-11-02';
const view: RegistrationGridView = {
  state: 'PUBLISHED',
  orgUnit: { id: 'u', name: 'Tổ', pathName: 'Tổ' },
  weekStart: DATE,
  canteens: [{ id: 'c', name: 'Nhà ăn' }],
  canteenId: 'c',
  canteenName: 'Nhà ăn',
  closeAt: '2026-10-29T17:00:00.000Z',
  forecastTaken: false,
  days: [
    {
      date: DATE,
      window: 'ON_BEHALF',
      lockAt: '2026-11-02T01:00:00.000Z',
      items: [
        {
          id: 'chay',
          displayName: '[Chay] A',
          type: { id: 'CHAY', name: 'Chay', color: '#15803d' },
        },
        { id: 'ca', displayName: '[Mặn] B', type: { id: 'MAN', name: 'Mặn', color: '#b91c1c' } },
      ],
    },
  ],
  rows: ['E1', 'E2', 'E3'].map((employeeCode, n) => ({
    employeeCode,
    name: employeeCode,
    orgPath: '',
    cells: {
      [DATE]: {
        quantities: (n === 0 ? { chay: 1 } : {}) as Record<string, number>,
        forecast: null,
        extra: false,
        needsReselect: 0,
        blocked: false,
      },
    },
  })),
  skipped: { otherCanteen: 0, cannotRegister: 0 },
};

describe('bulk-entry grid', () => {
  it('BR-20: a blank cell is 0; only whole numbers from 0 are accepted', () => {
    expect(parseCell('')).toBe(0);
    expect(parseCell(' 3 ')).toBe(3);
    expect(parseCell('12')).toBe(12);
    expect(parseCell('-1')).toBeNull();
    expect(parseCell('1.5')).toBeNull();
    expect(parseCell('a')).toBeNull();
  });

  it('starts from the stored quantities, blank for 0 like the paper form', () => {
    expect(gridValues(view, DATE)).toEqual({
      E1: { chay: '1', ca: '' },
      E2: { chay: '', ca: '' },
      E3: { chay: '', ca: '' },
    });
  });

  it('sends only changed rows, each with its complete day, and flags invalid cells on the row', () => {
    const values = gridValues(view, DATE);
    values.E1!.ca = '2';
    values.E2!.chay = '0';
    values.E3!.ca = '1,5';
    expect(gridChanges(view, DATE, values)).toEqual({
      rows: [
        {
          employeeCode: 'E1',
          lines: [
            { menuItemId: 'chay', quantity: 1 },
            { menuItemId: 'ca', quantity: 2 },
          ],
        },
      ],
      invalid: { E3: ['ca'] },
    });
    expect(columnTotals(view, DATE, values)).toEqual({ chay: 1, ca: 2 });
  });
});
