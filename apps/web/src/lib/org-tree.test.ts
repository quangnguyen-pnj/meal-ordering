import type { OrgUnitView } from '@meal/shared';
import { describe, expect, it } from 'vitest';
import {
  headcountByMealUnit,
  indexTree,
  mealUnitsInheriting,
  nodePath,
  unassignedBelow,
} from './org-tree';

const unset = { id: null, sourceNodeId: null, inherited: false };

function node(
  id: string,
  parentId: string | null,
  opts: Partial<Pick<OrgUnitView, 'isMealUnit' | 'mealUnitId' | 'directHeadcount'>> & {
    floorId?: string;
  } = {},
): OrgUnitView {
  return {
    id,
    dmpCode: id,
    name: id.toUpperCase(),
    level: 1,
    dmpLevelName: '',
    parentId,
    active: true,
    isMealUnit: opts.isMealUnit ?? false,
    own: { floorId: opts.floorId ?? null, canteenId: null, costCenterId: null },
    resolved: { floor: unset, canteen: unset, costCenter: unset },
    mealUnitId: opts.mealUnitId ?? null,
    mealUnitValid: null,
    directHeadcount: opts.directHeadcount ?? 0,
    deptAdmins: [],
  };
}

// root (no flag, 5 people)
// ├─ prod (meal unit, 10)
// │   ├─ cut (follows prod, 20)
// │   └─ sew (own meal unit, 30, own floor)
// │       └─ sew1 (follows sew, 40)
// └─ store (no meal unit, 7)
const nodes = [
  node('root', null, { directHeadcount: 5 }),
  node('prod', 'root', { isMealUnit: true, mealUnitId: 'prod', directHeadcount: 10 }),
  node('cut', 'prod', { mealUnitId: 'prod', directHeadcount: 20 }),
  node('sew', 'prod', {
    isMealUnit: true,
    mealUnitId: 'sew',
    directHeadcount: 30,
    floorId: 'fl_3',
  }),
  node('sew1', 'sew', { mealUnitId: 'sew', directHeadcount: 40 }),
  node('store', 'root', { directHeadcount: 7 }),
];
const idx = indexTree(nodes);

describe('org tree views', () => {
  it('BR-60: counts each employee once, under the nearest meal unit', () => {
    expect(headcountByMealUnit(nodes)).toEqual(
      new Map([
        [null, 12],
        ['prod', 30],
        ['sew', 70],
      ]),
    );
  });

  it('BR-60: warns on every ancestor of employees with no meal unit', () => {
    const counts = unassignedBelow(idx);
    expect(counts.get('root')).toBe(12);
    expect(counts.get('store')).toBe(7);
    expect(counts.has('prod')).toBe(false);
  });

  it('BR-62 / BR-63: a floor reaches only meal units that do not set their own', () => {
    expect(mealUnitsInheriting('root', 'floorId', idx).map((n) => n.id)).toEqual(['prod']);
    expect(mealUnitsInheriting('prod', 'floorId', idx).map((n) => n.id)).toEqual(['prod']);
    expect(mealUnitsInheriting('root', 'canteenId', idx).map((n) => n.id)).toEqual(['prod', 'sew']);
    // Below a meal unit with no flag further down, a value has no effect.
    expect(mealUnitsInheriting('cut', 'floorId', idx)).toEqual([]);
    expect(mealUnitsInheriting('store', 'floorId', idx)).toEqual([]);
  });

  it('BR-61: shows the full path', () => {
    expect(nodePath('sew1', idx)).toBe('ROOT / PROD / SEW / SEW1');
  });
});
