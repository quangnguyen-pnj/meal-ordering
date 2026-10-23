import type { MyDayView } from '@meal/shared';
import { describe, expect, it } from 'vitest';
import {
  applyDayToWeek,
  applySameAsLastWeek,
  changedDates,
  draftFromDays,
  saveBody,
  setQuantity,
} from './registration-draft';

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

  it('BR-26: "Same as last week" fills editable days by type and reports gaps', () => {
    const lastWeek = [
      day('2026-10-26', [
        ['l-chay', 'CHAY', 1],
        ['l-suon', 'MAN', 2],
      ]),
      day('2026-10-27', [['l-chay2', 'CHAY', 1]]),
      day('2026-10-28', [['l-ca', 'MAN', 1]]),
    ];
    const res = applySameAsLastWeek(draftFromDays(week), week, lastWeek);
    expect(res.draft['2026-11-02']).toEqual({ 'mon-chay': 1, 'mon-ca': 2 });
    expect(res.draft['2026-11-03']).toEqual({ 'tue-chao': 0, 'tue-ga': 0 });
    // Wednesday is locked and keeps its stored value.
    expect(res.draft['2026-11-04']).toEqual({ 'wed-thit': 2 });
    expect(res.skipped).toEqual([{ date: '2026-11-03', type: 'CHAY', quantity: 1 }]);
    expect(res.copied).toBe(5);
  });

  it('BR-26: "Apply to whole week" copies one day to the other editable days by type', () => {
    const draft = setQuantity(draftFromDays(week), '2026-11-02', 'mon-chay', 1);
    const res = applyDayToWeek(draft, week, week[0]!);
    expect(res.draft['2026-11-03']).toEqual({ 'tue-chao': 0, 'tue-ga': 1 });
    expect(res.draft['2026-11-02']).toEqual({ 'mon-chay': 1, 'mon-ca': 1 });
    expect(res.skipped).toEqual([{ date: '2026-11-03', type: 'CHAY', quantity: 1 }]);
  });
});
