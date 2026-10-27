import type { RegistrationUnitOption } from '@meal/shared';
import { describe, expect, it } from 'vitest';
import { unitRowCount } from './registration-admin-shared';

const unit: RegistrationUnitOption = {
  id: 'ou_KHT',
  name: 'Khối Hỗ trợ',
  pathName: 'Khối Hỗ trợ',
  level: 2,
  isMealUnit: false,
  employeeCount: 138,
  canteenCounts: { ct_a: 51, ct_b: 46, ct_c: 41 },
};

describe('unit picker count', () => {
  it('BR-63: a unit eating in several canteens shows the rows of the default canteen, not its total', () => {
    expect(unitRowCount(unit, null)).toBe(51);
  });

  it('BR-63: once a canteen is picked, the count is that canteen’s rows', () => {
    expect(unitRowCount(unit, 'ct_c')).toBe(41);
    expect(unitRowCount(unit, 'ct_other')).toBe(0);
  });

  it('a unit with one canteen shows all its employees', () => {
    expect(unitRowCount({ ...unit, employeeCount: 87, canteenCounts: { ct_gv: 87 } }, null)).toBe(
      87,
    );
  });
});
