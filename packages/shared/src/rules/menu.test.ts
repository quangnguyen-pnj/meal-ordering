import { describe, expect, it } from 'vitest';
import { defaultSettingValue } from '../settings';
import {
  checkMenuMix,
  isDefaultServingDay,
  libraryNameKey,
  mealDisplayName,
  menuDayGaps,
  menuWeekDates,
  menuWeekGaps,
  normalizeLibraryName,
  planMenuDayEdit,
  type MenuMixRule,
} from './menu';

describe('BR-12: meal display name', () => {
  it('BR-12: is the type in brackets, then the dish name', () => {
    expect(mealDisplayName('Chay', 'Gạo lứt muối mè')).toBe('[Chay] Gạo lứt muối mè');
    expect(mealDisplayName('Mặn', 'Cá kho tộ')).toBe('[Mặn] Cá kho tộ');
    expect(mealDisplayName('Eat clean', ' Ức gà áp chảo ')).toBe('[Eat clean] Ức gà áp chảo');
  });
});

describe('BR-10: library names', () => {
  it('BR-10: names are trimmed with single spaces and compared without case', () => {
    expect(normalizeLibraryName('  Cá   kho  tộ ')).toBe('Cá kho tộ');
    expect(libraryNameKey('CÁ KHO TỘ')).toBe(libraryNameKey(' cá kho  tộ'));
    expect(libraryNameKey('Cá kho')).not.toBe(libraryNameKey('Cá kho tộ'));
  });
});

describe('BR-13: usual menu mix', () => {
  const rules: MenuMixRule[] = [
    { typeId: 'chay', typeName: 'Chay', minPerDay: 1, maxPerDay: 1 },
    { typeId: 'chao', typeName: 'Cháo', minPerDay: 1, maxPerDay: 1 },
    { typeId: 'man', typeName: 'Mặn', minPerDay: 2, maxPerDay: 3 },
    { typeId: 'clean', typeName: 'Eat clean', minPerDay: null, maxPerDay: null },
  ];

  it('BR-13: 1 Chay + 1 Cháo + 2 or 3 Mặn is the usual mix', () => {
    expect(checkMenuMix(['chay', 'chao', 'man', 'man'], rules).usual).toBe(true);
    expect(checkMenuMix(['man', 'chay', 'man', 'chao', 'man'], rules).usual).toBe(true);
  });

  it('BR-13: a different mix reports what is off', () => {
    const check = checkMenuMix(['man', 'man', 'man', 'man', 'chay'], rules);
    expect(check.usual).toBe(false);
    expect(check.issues).toEqual([
      { typeId: 'chao', typeName: 'Cháo', actual: 0, min: 1, max: 1 },
      { typeId: 'man', typeName: 'Mặn', actual: 4, min: 2, max: 3 },
    ]);
  });

  it('BR-13: a type without bounds is never an issue, and an empty day is unusual', () => {
    expect(checkMenuMix(['chay', 'chao', 'man', 'man', 'clean', 'clean'], rules).usual).toBe(true);
    expect(checkMenuMix([], rules).issues).toHaveLength(3);
  });

  it('BR-13: only one bound can be set', () => {
    const atMostOne = [{ typeId: 'clean', typeName: 'Eat clean', minPerDay: null, maxPerDay: 1 }];
    expect(checkMenuMix([], atMostOne).usual).toBe(true);
    expect(checkMenuMix(['clean', 'clean'], atMostOne).issues[0]).toMatchObject({ actual: 2 });
  });
});

describe('publishing needs a main dish and a dessert on every serving day', () => {
  it('a serving day lacking either is reported; a day off never is', () => {
    expect(menuDayGaps({ isServing: true, mainCount: 2, dessertCount: 1 })).toEqual([]);
    expect(menuDayGaps({ isServing: true, mainCount: 0, dessertCount: 0 })).toEqual([
      'MAIN',
      'DESSERT',
    ]);
    expect(menuDayGaps({ isServing: true, mainCount: 3, dessertCount: 0 })).toEqual(['DESSERT']);
    expect(menuDayGaps({ isServing: false, mainCount: 0, dessertCount: 0 })).toEqual([]);
  });

  it('lists only the days that block publishing', () => {
    expect(
      menuWeekGaps([
        { date: '2026-11-02', isServing: true, mainCount: 4, dessertCount: 1 },
        { date: '2026-11-03', isServing: true, mainCount: 0, dessertCount: 1 },
        { date: '2026-11-07', isServing: false, mainCount: 0, dessertCount: 0 },
      ]),
    ).toEqual([{ date: '2026-11-03', gaps: ['MAIN'] }]);
  });
});

describe('BR-08: serving days', () => {
  const servingDays = defaultSettingValue('servingDays');

  it('BR-08: a week offers Monday to Sunday, serving Monday to Friday by default', () => {
    const dates = menuWeekDates('2026-11-02');
    expect(dates).toEqual([
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
      '2026-11-08',
    ]);
    expect(dates.map((d) => isDefaultServingDay(d, servingDays))).toEqual([
      true,
      true,
      true,
      true,
      true,
      false,
      false,
    ]);
  });

  it('BR-08: Sunday is offered even when the servingDays setting leaves it out', () => {
    expect(menuWeekDates('2026-11-02').at(-1)).toBe('2026-11-08');
    expect(isDefaultServingDay('2026-11-08', [1, 2, 3, 4, 5, 6, 7])).toBe(true);
  });

  it('BR-08: weekStart must be a Monday', () => {
    expect(() => menuWeekDates('2026-11-03')).toThrow(RangeError);
  });
});

describe('BR-11 / BR-14: planning a day edit', () => {
  const existing = [
    { id: 'i1', dishId: 'd1' },
    { id: 'i2', dishId: 'd2' },
    { id: 'i3', dishId: 'd3' },
  ];

  it('BR-11: keeps items, reorders them and adds new dishes', () => {
    const r = planMenuDayEdit(existing, [
      { id: 'i2', dishId: 'd2' },
      { id: 'i1', dishId: 'd1' },
      { id: 'i3', dishId: 'd3' },
      { dishId: 'd4' },
    ]);
    expect(r).toEqual({
      ok: true,
      plan: {
        keep: [
          { id: 'i2', sortOrder: 0 },
          { id: 'i1', sortOrder: 1 },
          { id: 'i3', sortOrder: 2 },
        ],
        replace: [],
        remove: [],
        add: [{ dishId: 'd4', sortOrder: 3 }],
      },
    });
  });

  it('BR-14: an existing item with another dish is a replacement; a missing item is a removal', () => {
    const r = planMenuDayEdit(existing, [
      { id: 'i1', dishId: 'd9' },
      { id: 'i2', dishId: 'd2' },
    ]);
    expect(r.ok && r.plan.replace).toEqual([
      { fromId: 'i1', fromDishId: 'd1', toDishId: 'd9', sortOrder: 0 },
    ]);
    expect(r.ok && r.plan.remove).toEqual([{ id: 'i3', dishId: 'd3' }]);
  });

  it('BR-14: rejects unknown items and the same dish twice on a day', () => {
    expect(planMenuDayEdit(existing, [{ id: 'nope', dishId: 'd1' }])).toEqual({
      ok: false,
      errors: [{ code: 'UNKNOWN_ITEM', itemId: 'nope' }],
    });
    const dup = planMenuDayEdit(existing, [
      { id: 'i1', dishId: 'd2' },
      { id: 'i2', dishId: 'd2' },
    ]);
    expect(dup).toEqual({ ok: false, errors: [{ code: 'DUPLICATE_DISH', dishId: 'd2' }] });
  });
});
