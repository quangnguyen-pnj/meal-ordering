/**
 * BR-64: mapping import from the Excel template. One row maps an org node (floor, canteen, cost
 * center) or an employee (cost-center override). Every row is validated; one invalid row rejects
 * the whole file.
 *
 * A row states the complete mapping of its target: a blank cell means "no own value", so the
 * target inherits again (BR-62). Exporting and re-importing the same file therefore changes
 * nothing. Targets not in the file are left untouched.
 */

export const MAPPING_TARGET_TYPES = ['ORG', 'EMPLOYEE'] as const;
export type MappingTargetType = (typeof MAPPING_TARGET_TYPES)[number];

export interface RawMappingRow {
  /** 1-based spreadsheet row number, for error messages. */
  rowNumber: number;
  type: string;
  code: string;
  floorCode: string;
  canteenCode: string;
  costCenterCode: string;
}

export interface MappingRow {
  rowNumber: number;
  type: MappingTargetType;
  code: string;
  floorCode: string | null;
  canteenCode: string | null;
  costCenterCode: string | null;
}

export const MAPPING_ROW_ERROR_CODES = [
  'TYPE_INVALID',
  'CODE_REQUIRED',
  'ORG_UNKNOWN',
  'EMPLOYEE_UNKNOWN',
  'FLOOR_UNKNOWN',
  'CANTEEN_UNKNOWN',
  'COST_CENTER_UNKNOWN',
  'EMPLOYEE_FLOOR_OR_CANTEEN',
  'DUPLICATE_TARGET',
] as const;
export type MappingRowErrorCode = (typeof MAPPING_ROW_ERROR_CODES)[number];

export type MappingRowField = 'type' | 'code' | 'floorCode' | 'canteenCode' | 'costCenterCode';

export interface MappingRowError {
  rowNumber: number;
  field: MappingRowField;
  code: MappingRowErrorCode;
  value: string;
}

/** Codes that exist and may be used. Inactive master data is not in these sets (BR-62). */
export interface MappingLookups {
  orgCodes: ReadonlySet<string>;
  employeeCodes: ReadonlySet<string>;
  floorCodes: ReadonlySet<string>;
  canteenCodes: ReadonlySet<string>;
  costCenterCodes: ReadonlySet<string>;
}

const blankToNull = (v: string): string | null => (v.trim() === '' ? null : v.trim());

export function validateMappingRows(
  raw: readonly RawMappingRow[],
  lookups: MappingLookups,
): { ok: true; rows: MappingRow[] } | { ok: false; errors: MappingRowError[] } {
  const errors: MappingRowError[] = [];
  const rows: MappingRow[] = [];
  const seen = new Set<string>();

  for (const r of raw) {
    const fail = (field: MappingRowField, code: MappingRowErrorCode, value: string) =>
      errors.push({ rowNumber: r.rowNumber, field, code, value });
    const before = errors.length;

    const type = r.type.trim().toUpperCase();
    const code = r.code.trim();
    const floorCode = blankToNull(r.floorCode);
    const canteenCode = blankToNull(r.canteenCode);
    const costCenterCode = blankToNull(r.costCenterCode);

    if (type !== 'ORG' && type !== 'EMPLOYEE') fail('type', 'TYPE_INVALID', r.type);
    if (code === '') fail('code', 'CODE_REQUIRED', r.code);
    else if (type === 'ORG' && !lookups.orgCodes.has(code)) fail('code', 'ORG_UNKNOWN', code);
    else if (type === 'EMPLOYEE' && !lookups.employeeCodes.has(code))
      fail('code', 'EMPLOYEE_UNKNOWN', code);

    if (type === 'EMPLOYEE') {
      // BR-63: floor and canteen come from the meal unit; only cost center is set per employee.
      if (floorCode !== null) fail('floorCode', 'EMPLOYEE_FLOOR_OR_CANTEEN', floorCode);
      if (canteenCode !== null) fail('canteenCode', 'EMPLOYEE_FLOOR_OR_CANTEEN', canteenCode);
    } else {
      if (floorCode !== null && !lookups.floorCodes.has(floorCode))
        fail('floorCode', 'FLOOR_UNKNOWN', floorCode);
      if (canteenCode !== null && !lookups.canteenCodes.has(canteenCode))
        fail('canteenCode', 'CANTEEN_UNKNOWN', canteenCode);
    }
    if (costCenterCode !== null && !lookups.costCenterCodes.has(costCenterCode))
      fail('costCenterCode', 'COST_CENTER_UNKNOWN', costCenterCode);

    const key = `${type}:${code}`;
    if (code !== '' && seen.has(key)) fail('code', 'DUPLICATE_TARGET', code);
    seen.add(key);

    if (errors.length === before) {
      rows.push({
        rowNumber: r.rowNumber,
        type: type as MappingTargetType,
        code,
        floorCode,
        canteenCode,
        costCenterCode,
      });
    }
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, rows };
}
