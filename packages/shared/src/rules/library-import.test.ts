import { describe, expect, it } from 'vitest';
import { libraryDishKey, validateLibraryRows } from './library-import';
import { libraryNameKey } from './menu';

const lookups = {
  typeCodes: new Set(['MAN', 'CHAY']),
  existingDishes: new Set([libraryDishKey('MAN', 'Cá kho tộ')]),
  existingDesserts: new Set([libraryNameKey('Chuối')]),
};
const row = (rowNumber: number, kind: string, typeCode: string, name: string) => ({
  rowNumber,
  kind,
  typeCode,
  name,
});

describe('BR-10: dish library import', () => {
  it('BR-10: adds new dishes and desserts and skips what the library already has', () => {
    const res = validateLibraryRows(
      [
        row(2, 'Món chính', 'man', ' Cá   kho tộ '),
        row(3, 'MÓN CHÍNH', 'CHAY', 'Đậu hũ sốt cà'),
        row(4, 'Tráng miệng', '', 'chuối'),
        row(5, 'Tráng miệng', 'MAN', 'Rau câu'),
      ],
      lookups,
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.toCreate.map((r) => [r.kind, r.typeCode, r.name])).toEqual([
      ['MAIN', 'CHAY', 'Đậu hũ sốt cà'],
      ['DESSERT', null, 'Rau câu'],
    ]);
    expect(res.alreadyInLibrary.map((r) => r.rowNumber)).toEqual([2, 4]);
  });

  it('BR-10: one bad row rejects the file, with every error listed', () => {
    const res = validateLibraryRows(
      [
        row(2, 'Món phụ', 'MAN', 'X'),
        row(3, 'Món chính', '', 'Gà'),
        row(4, 'Món chính', 'BBQ', 'Bò'),
        row(5, 'Món chính', 'MAN', ''),
        row(6, 'Món chính', 'MAN', 'Gà chiên'),
        row(7, 'Món chính', 'MAN', 'gà  chiên'),
      ],
      lookups,
    );
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors.map((e) => [e.rowNumber, e.code])).toEqual([
      [2, 'KIND_INVALID'],
      [3, 'TYPE_REQUIRED'],
      [4, 'TYPE_UNKNOWN'],
      [5, 'NAME_REQUIRED'],
      [7, 'DUPLICATE_IN_FILE'],
    ]);
  });

  it('BR-10: the same name with another type is another dish', () => {
    const res = validateLibraryRows([row(2, 'Món chính', 'CHAY', 'Cá kho tộ')], lookups);
    expect(res.ok && res.toCreate).toHaveLength(1);
  });
});
