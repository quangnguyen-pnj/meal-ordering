import { describe, expect, it } from 'vitest';
import {
  indexOrgNodes,
  resolveEmployeeCostCenter,
  resolveEmployeeMealAssignment,
  resolveMapping,
  resolveMealUnitId,
  resolveMealUnitMapping,
  type OrgNode,
} from './mapping';

const node = (id: string, parentId: string | null, extra: Partial<OrgNode> = {}): OrgNode => ({
  id,
  parentId,
  isMealUnit: false,
  floorId: null,
  canteenId: null,
  costCenterId: null,
  ...extra,
});

/**
 * A 6-level chain L1 > L2 > L3 > L4 > L5 > L6 with sparse mapping:
 *   L1: canteen C1
 *   L2: floor F1, cost center K1
 *   L4: floor F2 (overrides L2), meal unit
 *   L6: nothing
 * plus a sibling branch L3b with no floor, no meal unit.
 */
const nodes: OrgNode[] = [
  node('L1', null, { canteenId: 'C1' }),
  node('L2', 'L1', { floorId: 'F1', costCenterId: 'K1' }),
  node('L3', 'L2'),
  node('L4', 'L3', { floorId: 'F2', isMealUnit: true }),
  node('L5', 'L4'),
  node('L6', 'L5'),
  node('L3b', 'L2'),
  node('L4b', 'L3b'),
  node('L1x', null), // second root with nothing mapped
  node('L2x', 'L1x', { isMealUnit: true }),
];
const index = indexOrgNodes(nodes);

describe('BR-62: mapping inheritance', () => {
  it('BR-62: nearest ancestor wins over a farther one', () => {
    // L6 has no floor; the nearest ancestor with one is L4 (F2), not L2 (F1).
    expect(resolveMapping('L6', 'floorId', index)).toEqual({
      value: 'F2',
      sourceNodeId: 'L4',
      inherited: true,
    });
  });

  it('BR-62: a node with its own value is not inherited', () => {
    expect(resolveMapping('L4', 'floorId', index)).toEqual({
      value: 'F2',
      sourceNodeId: 'L4',
      inherited: false,
    });
  });

  it('BR-62: a branch without its own value inherits from the farther ancestor', () => {
    expect(resolveMapping('L4b', 'floorId', index).value).toBe('F1');
    expect(resolveMapping('L6', 'canteenId', index)).toMatchObject({
      value: 'C1',
      sourceNodeId: 'L1',
    });
  });

  it('BR-62: resolves to null when nothing up the tree is mapped', () => {
    expect(resolveMapping('L2x', 'floorId', index)).toEqual({
      value: null,
      sourceNodeId: null,
      inherited: false,
    });
  });

  it('BR-61: detects a cycle instead of looping forever', () => {
    const cyclic = indexOrgNodes([node('a', 'b'), node('b', 'a')]);
    expect(() => resolveMapping('a', 'floorId', cyclic)).toThrow(/cycle/);
  });

  it('rejects an unknown node id', () => {
    expect(() => resolveMapping('nope', 'floorId', index)).toThrow(/Unknown org node/);
  });
});

describe('BR-60: meal unit resolution', () => {
  it('BR-60: an employee belongs to the nearest flagged node at or above their own', () => {
    expect(resolveMealUnitId('L6', index)).toBe('L4');
    expect(resolveMealUnitId('L4', index)).toBe('L4');
  });

  it('BR-60: no flagged node at or above means no meal unit', () => {
    expect(resolveMealUnitId('L3b', index)).toBeNull();
    expect(resolveMealUnitId('L4b', index)).toBeNull();
  });
});

describe('BR-63: meal unit validity', () => {
  it('BR-63: floor and canteen come from the meal unit, resolved through inheritance', () => {
    expect(resolveMealUnitMapping('L4', index)).toEqual({
      valid: true,
      floorId: 'F2',
      canteenId: 'C1',
    });
  });

  it('BR-63: a meal unit that resolves no floor or no canteen is invalid', () => {
    expect(resolveMealUnitMapping('L2x', index)).toEqual({
      valid: false,
      missing: ['floor', 'canteen'],
    });
    const noFloor = indexOrgNodes([
      node('r', null, { canteenId: 'C1' }),
      node('mu', 'r', { isMealUnit: true }),
    ]);
    expect(resolveMealUnitMapping('mu', noFloor)).toEqual({ valid: false, missing: ['floor'] });
    const noCanteen = indexOrgNodes([
      node('r', null, { floorId: 'F1' }),
      node('mu', 'r', { isMealUnit: true }),
    ]);
    expect(resolveMealUnitMapping('mu', noCanteen)).toEqual({ valid: false, missing: ['canteen'] });
  });
});

describe('BR-63: employee cost center', () => {
  it('BR-63: the employee-level override wins over the inherited mapping', () => {
    expect(
      resolveEmployeeCostCenter({ orgUnitId: 'L6', overrideCostCenterId: 'K9', index }),
    ).toEqual({ costCenterId: 'K9', source: 'OVERRIDE' });
  });

  it('BR-63: without an override the inherited mapping applies', () => {
    expect(
      resolveEmployeeCostCenter({ orgUnitId: 'L6', overrideCostCenterId: null, index }),
    ).toEqual({
      costCenterId: 'K1',
      source: 'MAPPING',
    });
  });

  it('BR-62: an admin mapping overrides the cost center DMP supplied', () => {
    expect(
      resolveEmployeeCostCenter({
        orgUnitId: 'L6',
        overrideCostCenterId: null,
        dmpCostCenterId: 'K5',
        index,
      }),
    ).toMatchObject({ costCenterId: 'K1', source: 'MAPPING' });
  });

  it('BR-62: the DMP cost center is the default when no mapping exists', () => {
    expect(
      resolveEmployeeCostCenter({
        orgUnitId: 'L2x',
        overrideCostCenterId: null,
        dmpCostCenterId: 'K5',
        index,
      }),
    ).toEqual({ costCenterId: 'K5', source: 'DMP' });
  });

  it('BR-63: no override, mapping or DMP value leaves the cost center empty', () => {
    expect(
      resolveEmployeeCostCenter({ orgUnitId: 'L2x', overrideCostCenterId: null, index }),
    ).toEqual({
      costCenterId: null,
      source: null,
    });
  });
});

describe('BR-60/BR-63: employee meal assignment', () => {
  it('BR-60: a registrable employee gets meal unit, floor, canteen and cost center', () => {
    expect(
      resolveEmployeeMealAssignment({ orgUnitId: 'L6', costCenterOverrideId: null, index }),
    ).toMatchObject({
      mealUnitId: 'L4',
      status: 'OK',
      floorId: 'F2',
      canteenId: 'C1',
      costCenterId: 'K1',
      canRegister: true,
      missingCostCenter: false,
    });
  });

  it('BR-60: an employee with no meal unit above is unassigned and cannot register', () => {
    expect(
      resolveEmployeeMealAssignment({ orgUnitId: 'L4b', costCenterOverrideId: null, index }),
    ).toMatchObject({ mealUnitId: null, status: 'NO_MEAL_UNIT', canRegister: false });
  });

  it('BR-63: an employee under an invalid meal unit is unassigned and cannot register', () => {
    expect(
      resolveEmployeeMealAssignment({ orgUnitId: 'L2x', costCenterOverrideId: null, index }),
    ).toMatchObject({
      mealUnitId: 'L2x',
      status: 'INVALID_MEAL_UNIT',
      missing: ['floor', 'canteen'],
      canRegister: false,
      missingCostCenter: true,
    });
  });

  it('BR-63: an employee without a cost center can still register', () => {
    const noCost = indexOrgNodes([
      node('r', null, { canteenId: 'C1', floorId: 'F1', isMealUnit: true }),
      node('e', 'r'),
    ]);
    expect(
      resolveEmployeeMealAssignment({ orgUnitId: 'e', costCenterOverrideId: null, index: noCost }),
    ).toMatchObject({ canRegister: true, missingCostCenter: true, costCenterId: null });
  });
});
