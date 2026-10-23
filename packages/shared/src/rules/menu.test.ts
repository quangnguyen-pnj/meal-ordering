import { describe, expect, it } from 'vitest';
import { defaultSettingValue } from '../settings';
import {
  checkMenuMix,
  isDefaultServingDay,
  mealDisplayName,
  menuWeekDates,
  planMenuDayEdit,
} from './menu';

describe('BR-12: meal display name', () => {
  it('BR-12: is the type in brackets, then the dish name', () => {
    expect(mealDisplayName('CHAY', 'Gạo lứt muối mè')).toBe('[Chay] Gạo lứt muối mè');
    expect(mealDisplayName('MAN', 'Cá kho tộ')).toBe('[Mặn] Cá kho tộ');
    expect(mealDisplayName('CHAO', ' Cháo gà ')).toBe('[Cháo] Cháo gà');
  });
});

describe('BR-13: usual menu mix', () => {
  it('BR-13: 1 Chay + 1 Cháo + 2 or 3 Mặn is the usual mix', () => {
    expect(checkMenuMix(['CHAY', 'CHAO', 'MAN', 'MAN']).usual).toBe(true);
    expect(checkMenuMix(['MAN', 'CHAY', 'MAN', 'CHAO', 'MAN']).usual).toBe(true);
  });

  it('BR-13: a different mix reports what is off', () => {
    const check = checkMenuMix(['MAN', 'MAN', 'MAN', 'MAN', 'CHAY']);
    expect(check.usual).toBe(false);
    expect(check.issues).toEqual([
      { type: 'CHAO', actual: 0, min: 1, max: 1 },
      { type: 'MAN', actual: 4, min: 2, max: 3 },
    ]);
  });

  it('BR-13: an empty day is unusual too', () => {
    expect(checkMenuMix([]).issues).toHaveLength(3);
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
