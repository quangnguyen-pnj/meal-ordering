import type { MyDayView } from '@meal/shared';
import { describe, expect, it } from 'vitest';
import { changedDates, draftFromDays, saveBody, setQuantity } from './registration-draft';

const day = (
  date: string,
  items: Array<[string, 'CHAY' | 'CHAO' | 'MAN', number]>,
  window: MyDayView['window'] = 'OPEN',
): MyDayView => ({
  date,
  window,
  lockAt: '',
  items: items.map(([menuItemId, type, quantity]) => ({
    menuItemId,
    type,
    quantity,
    forecast: 0,
    displayName: menuItemId,
  })),
  needsReselect: [],
  desserts: [],
  actualTotal: 0,
  forecastTotal: null,
  changed: false,
  extra: false,
});

const week = [
  day('2026-11-02', [
    ['mon-chay', 'CHAY', 0],
    ['mon-ca', 'MAN', 1],
  ]),
  day('2026-11-03', [
    ['tue-chao', 'CHAO', 0],
    ['tue-ga', 'MAN', 0],
  ]),
  day('2026-11-04', [['wed-thit', 'MAN', 2]], 'LOCKED'),
];

describe('week registration draft', () => {
  it('saves only the editable days that changed, with positive lines only', () => {
    let draft = draftFromDays(week);
    expect(changedDates(week, draft)).toEqual([]);
    draft = setQuantity(draft, '2026-11-03', 'tue-ga', 3);
    draft = setQuantity(draft, '2026-11-02', 'mon-ca', 0);
    // A locked day is never sent (BR-24), whatever the draft says.
    draft = setQuantity(draft, '2026-11-04', 'wed-thit', 5);
    expect(saveBody('2026-11-02', week, draft)).toEqual({
      weekStart: '2026-11-02',
      days: [
        { date: '2026-11-02', lines: [] },
        { date: '2026-11-03', lines: [{ menuItemId: 'tue-ga', quantity: 3 }] },
      ],
    });
  });

  it('BR-20: quantities never go below zero and stay integers', () => {
    const draft = setQuantity(draftFromDays(week), '2026-11-02', 'mon-ca', -2);
    expect(draft['2026-11-02']!['mon-ca']).toBe(0);
    expect(setQuantity(draft, '2026-11-02', 'mon-ca', 2.7)['2026-11-02']!['mon-ca']).toBe(2);
  });
});
