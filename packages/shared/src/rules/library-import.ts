import { libraryNameKey, normalizeLibraryName } from './menu';

/**
 * Excel import of one canteen's dish library (product owner, 2026-10-23). A row is a main dish
 * (with a dish-type code) or a dessert (no type). Every row is validated; one invalid row rejects
 * the file. Rows already in the library are skipped, so importing the same file twice adds
 * nothing (the "added twice" bug).
 */

export const LIBRARY_KINDS = ['MAIN', 'DESSERT'] as const;
export type LibraryKind = (typeof LIBRARY_KINDS)[number];

/** Accepted spellings of the "Nhóm" column, compared without case. */
const KIND_ALIASES: Record<string, LibraryKind> = {
  'món chính': 'MAIN',
  main: 'MAIN',
  'tráng miệng': 'DESSERT',
  dessert: 'DESSERT',
};

export interface RawLibraryRow {
  /** 1-based spreadsheet row number, for error messages. */
  rowNumber: number;
  kind: string;
  typeCode: string;
  name: string;
}

export interface LibraryRow {
  rowNumber: number;
  kind: LibraryKind;
  /** Main dishes only. */
  typeCode: string | null;
  name: string;
}

export const LIBRARY_ROW_ERROR_CODES = [
  'KIND_INVALID',
  'NAME_REQUIRED',
  'NAME_TOO_LONG',
  'TYPE_REQUIRED',
  'TYPE_UNKNOWN',
  'DUPLICATE_IN_FILE',
] as const;
export type LibraryRowErrorCode = (typeof LIBRARY_ROW_ERROR_CODES)[number];

export interface LibraryRowError {
  rowNumber: number;
  field: 'kind' | 'typeCode' | 'name';
  code: LibraryRowErrorCode;
  value: string;
}

export interface LibraryImportLookups {
  /** Codes of active dish types. */
  typeCodes: ReadonlySet<string>;
  /** `libraryNameKey` of every main dish already in the canteen's library, by type code. */
  existingDishes: ReadonlySet<string>;
  /** `libraryNameKey` of every dessert already in the canteen's library. */
  existingDesserts: ReadonlySet<string>;
}

export const libraryDishKey = (typeCode: string, name: string) =>
  `${typeCode}|${libraryNameKey(name)}`;

export type LibraryImportResult =
  | { ok: true; toCreate: LibraryRow[]; alreadyInLibrary: LibraryRow[] }
  | { ok: false; errors: LibraryRowError[] };

export function validateLibraryRows(
  raw: readonly RawLibraryRow[],
  lookups: LibraryImportLookups,
): LibraryImportResult {
  const errors: LibraryRowError[] = [];
  const rows: LibraryRow[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    const kind = KIND_ALIASES[r.kind.trim().toLocaleLowerCase('vi')];
    const name = normalizeLibraryName(r.name);
    const typeCode = r.typeCode.trim().toUpperCase();
    const before = errors.length;
    if (!kind)
      errors.push({ rowNumber: r.rowNumber, field: 'kind', code: 'KIND_INVALID', value: r.kind });
    if (name === '')
      errors.push({ rowNumber: r.rowNumber, field: 'name', code: 'NAME_REQUIRED', value: r.name });
    else if (name.length > 120)
      errors.push({ rowNumber: r.rowNumber, field: 'name', code: 'NAME_TOO_LONG', value: r.name });
    if (kind === 'MAIN') {
      if (typeCode === '')
        errors.push({
          rowNumber: r.rowNumber,
          field: 'typeCode',
          code: 'TYPE_REQUIRED',
          value: '',
        });
      else if (!lookups.typeCodes.has(typeCode))
        errors.push({
          rowNumber: r.rowNumber,
          field: 'typeCode',
          code: 'TYPE_UNKNOWN',
          value: r.typeCode,
        });
    }
    if (errors.length > before || !kind) continue;
    const key =
      kind === 'MAIN' ? `M:${libraryDishKey(typeCode, name)}` : `D:${libraryNameKey(name)}`;
    if (seen.has(key)) {
      errors.push({
        rowNumber: r.rowNumber,
        field: 'name',
        code: 'DUPLICATE_IN_FILE',
        value: r.name,
      });
      continue;
    }
    seen.add(key);
    rows.push({ rowNumber: r.rowNumber, kind, typeCode: kind === 'MAIN' ? typeCode : null, name });
  }
  if (errors.length > 0) return { ok: false, errors };
  const exists = (row: LibraryRow) =>
    row.kind === 'MAIN'
      ? lookups.existingDishes.has(libraryDishKey(row.typeCode!, row.name))
      : lookups.existingDesserts.has(libraryNameKey(row.name));
  return {
    ok: true,
    toCreate: rows.filter((r) => !exists(r)),
    alreadyInLibrary: rows.filter(exists),
  };
}
