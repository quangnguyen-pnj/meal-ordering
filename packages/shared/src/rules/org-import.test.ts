import { describe, expect, it } from 'vitest';
import { validateMappingRows, type MappingLookups, type RawMappingRow } from './mapping-import';
import { buildDmpTree, mapDmpLevel } from './org-sync';

describe('BR-61: DMP levels map to 1–6', () => {
  it('BR-61: depth 1 to 6 maps to the same level, anything else does not', () => {
    expect([1, 2, 3, 4, 5, 6].map(mapDmpLevel)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(mapDmpLevel(0)).toBeNull();
    expect(mapDmpLevel(7)).toBeNull();
  });

  const n = (code: string, parentCode: string | null) => ({
    code,
    name: code,
    parentCode,
    levelName: `L ${code}`,
    costCenterCode: null,
  });

  it('BR-61: computes levels from the tree and orders parents first', () => {
    const r = buildDmpTree([n('C', 'B'), n('A', null), n('B', 'A')]);
    expect(r.ok && r.nodes.map((x) => [x.code, x.level])).toEqual([
      ['A', 1],
      ['B', 2],
      ['C', 3],
    ]);
  });

  it('BR-61: a 7th level rejects the whole tree', () => {
    const chain = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7'].map((c, i, all) =>
      n(c, i === 0 ? null : (all[i - 1] as string)),
    );
    expect(buildDmpTree(chain)).toEqual({
      ok: false,
      errors: [{ code: 'TOO_DEEP', nodeCode: 'L7', depth: 7 }],
    });
  });

  it('BR-61: unknown parents, duplicates and cycles reject the tree', () => {
    expect(buildDmpTree([n('A', 'X')])).toMatchObject({
      ok: false,
      errors: [{ code: 'UNKNOWN_PARENT' }],
    });
    expect(buildDmpTree([n('A', null), n('A', null)])).toMatchObject({
      ok: false,
      errors: [{ code: 'DUPLICATE_CODE' }],
    });
    expect(buildDmpTree([n('A', 'B'), n('B', 'A')])).toMatchObject({
      ok: false,
      errors: [{ code: 'CYCLE' }, { code: 'CYCLE' }],
    });
  });
});

describe('BR-64: mapping import validation', () => {
  const lookups: MappingLookups = {
    orgCodes: new Set(['XCT', 'KVP']),
    employeeCodes: new Set(['PNJP000001']),
    floorCodes: new Set(['T1', 'T2']),
    canteenCodes: new Set(['CT-GV']),
    costCenterCodes: new Set(['CC01', 'CC03']),
  };
  const row = (rowNumber: number, cells: Partial<RawMappingRow>): RawMappingRow => ({
    rowNumber,
    type: 'ORG',
    code: '',
    floorCode: '',
    canteenCode: '',
    costCenterCode: '',
    ...cells,
  });

  it('BR-64: valid rows parse, blanks mean "inherit"', () => {
    const r = validateMappingRows(
      [
        row(2, { code: 'XCT', floorCode: 'T2', costCenterCode: 'CC03' }),
        row(3, { type: 'employee', code: 'PNJP000001', costCenterCode: 'CC01' }),
      ],
      lookups,
    );
    expect(r).toEqual({
      ok: true,
      rows: [
        {
          rowNumber: 2,
          type: 'ORG',
          code: 'XCT',
          floorCode: 'T2',
          canteenCode: null,
          costCenterCode: 'CC03',
        },
        {
          rowNumber: 3,
          type: 'EMPLOYEE',
          code: 'PNJP000001',
          floorCode: null,
          canteenCode: null,
          costCenterCode: 'CC01',
        },
      ],
    });
  });

  it('BR-64: one invalid row rejects the whole file with row-level errors', () => {
    const r = validateMappingRows(
      [
        row(2, { code: 'XCT', floorCode: 'T2' }),
        row(3, { code: 'KVP', floorCode: 'T9' }),
        row(4, { code: 'NOPE' }),
      ],
      lookups,
    );
    expect(r).toEqual({
      ok: false,
      errors: [
        { rowNumber: 3, field: 'floorCode', code: 'FLOOR_UNKNOWN', value: 'T9' },
        { rowNumber: 4, field: 'code', code: 'ORG_UNKNOWN', value: 'NOPE' },
      ],
    });
  });

  it('BR-64 / BR-63: an employee row may not set floor or canteen', () => {
    const r = validateMappingRows(
      [row(2, { type: 'EMPLOYEE', code: 'PNJP000001', floorCode: 'T1', canteenCode: 'CT-GV' })],
      lookups,
    );
    expect(r.ok ? [] : r.errors.map((e) => e.code)).toEqual([
      'EMPLOYEE_FLOOR_OR_CANTEEN',
      'EMPLOYEE_FLOOR_OR_CANTEEN',
    ]);
  });

  it('BR-64: rejects bad types, missing codes, unknown cost centers and duplicates', () => {
    const r = validateMappingRows(
      [
        row(2, { type: 'X', code: 'XCT' }),
        row(3, { code: '' }),
        row(4, { code: 'XCT', costCenterCode: 'CC99' }),
        row(5, { code: 'KVP' }),
        row(6, { code: 'KVP' }),
      ],
      lookups,
    );
    expect(r.ok ? [] : r.errors.map((e) => [e.rowNumber, e.code])).toEqual([
      [2, 'TYPE_INVALID'],
      [3, 'CODE_REQUIRED'],
      [4, 'COST_CENTER_UNKNOWN'],
      [6, 'DUPLICATE_TARGET'],
    ]);
  });
});
