import { describe, expect, it } from 'vitest';
import { registrationColumnKey as key, validateRegistrationImport } from './registration-import';

const MON = '2026-11-02';
const TUE = '2026-11-03';
const editable = new Map([
  [MON, new Set(['mon-ca', 'mon-chay'])],
  [TUE, new Set(['tue-ga'])],
]);
const current = new Map<string, Record<string, Record<string, number>>>([
  ['PNJP000001', { [MON]: { 'mon-ca': 1 } }],
  ['PNJP000002', {}],
]);
const columns = [key(MON, 'mon-ca'), key(MON, 'mon-chay'), key(TUE, 'tue-ga')];

describe('BR-21: weekly registration import', () => {
  it('BR-21: turns changed employee-days into whole-day selections; blank is no meal', () => {
    const res = validateRegistrationImport({
      columns,
      editable,
      current,
      rows: [
        {
          rowNumber: 3,
          employeeCode: 'PNJP000001',
          cells: { [columns[0]!]: '1', [columns[1]!]: '', [columns[2]!]: '2' },
        },
        { rowNumber: 4, employeeCode: ' PNJP000002 ', cells: { [columns[1]!]: '1' } },
      ],
    });
    expect(res).toEqual({
      ok: true,
      changes: [
        { employeeCode: 'PNJP000001', date: TUE, lines: [{ menuItemId: 'tue-ga', quantity: 2 }] },
        { employeeCode: 'PNJP000002', date: MON, lines: [{ menuItemId: 'mon-chay', quantity: 1 }] },
      ],
    });
  });

  it('BR-21: re-importing the downloaded file changes nothing', () => {
    const res = validateRegistrationImport({
      columns,
      editable,
      current,
      rows: [{ rowNumber: 3, employeeCode: 'PNJP000001', cells: { [columns[0]!]: '1' } }],
    });
    expect(res).toEqual({ ok: true, changes: [] });
  });

  it('BR-24 / BR-20: a locked day, an unknown employee or a bad number rejects the file', () => {
    const locked = key('2026-11-04', 'wed-thit');
    const res = validateRegistrationImport({
      columns: [...columns, locked],
      editable,
      current,
      rows: [
        { rowNumber: 3, employeeCode: 'PNJP000001', cells: { [columns[0]!]: '1,5' } },
        { rowNumber: 4, employeeCode: 'PNJP000001', cells: {} },
        { rowNumber: 5, employeeCode: 'PNJP999999', cells: {} },
        { rowNumber: 6, employeeCode: 'PNJP000002', cells: { [columns[2]!]: '-1' } },
      ],
    });
    expect(res.ok ? [] : res.errors.map((e) => [e.rowNumber, e.code])).toEqual([
      [2, 'COLUMN_NOT_EDITABLE'],
      [3, 'QUANTITY_INVALID'],
      [4, 'DUPLICATE_EMPLOYEE'],
      [5, 'EMPLOYEE_NOT_IN_LIST'],
      [6, 'QUANTITY_INVALID'],
    ]);
  });
});
