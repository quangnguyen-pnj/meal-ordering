import { describe, expect, it } from 'vitest';
import { resolveDrop } from './menu-screen';

describe('menu builder drops', () => {
  it('adds a dish dropped on a day', () => {
    expect(resolveDrop('dish:d1', 'day:2026-10-26')).toEqual({
      kind: 'addDish',
      date: '2026-10-26',
      id: 'd1',
    });
  });

  it('BR-14: a dish dropped on another dish replaces it', () => {
    expect(resolveDrop('dish:d2', 'item:2026-10-26:1')).toEqual({
      kind: 'replace',
      date: '2026-10-26',
      index: 1,
      id: 'd2',
    });
  });

  it('a dessert joins the day even when dropped on a dish', () => {
    expect(resolveDrop('dessert:x1', 'item:2026-10-26:0')).toEqual({
      kind: 'addDessert',
      date: '2026-10-26',
      id: 'x1',
    });
  });

  it('ignores a drop outside any day', () => {
    expect(resolveDrop('dish:d1', null)).toBeNull();
    expect(resolveDrop('dish:d1', 'library')).toBeNull();
  });
});
