import { describe, expect, it } from 'vitest';
import {
  ACTIONS,
  PERMISSION_MATRIX,
  authorize,
  hasAnyGrant,
  listScopeIncludes,
  resolveListScope,
  type Principal,
} from './permissions';

const FACTORY = 'f1';
const PROD = '/ou_1/ou_2/'; // production block
const PROD_LINE = '/ou_1/ou_2/ou_3/'; // child of PROD
const OFFICE = '/ou_1/ou_20/'; // sibling block
const OFFICE_LIKE = '/ou_1/ou_200/'; // prefix-lookalike of ou_20

const employee: Principal = {
  employeeId: 'e1',
  roles: ['EMPLOYEE'],
  mealUnitPath: PROD_LINE,
  deptAdminPaths: [],
  hcFactoryIds: [],
};
const deptAdmin: Principal = {
  employeeId: 'e2',
  roles: ['EMPLOYEE', 'DEPT_ADMIN'],
  mealUnitPath: OFFICE,
  deptAdminPaths: [PROD],
  hcFactoryIds: [],
};
const hcAdmin: Principal = {
  employeeId: 'e3',
  roles: ['EMPLOYEE', 'HC_ADMIN'],
  mealUnitPath: OFFICE,
  deptAdminPaths: [],
  hcFactoryIds: [FACTORY],
};
const sysAdmin: Principal = {
  employeeId: 'e4',
  roles: ['EMPLOYEE', 'SYS_ADMIN'],
  mealUnitPath: null,
  deptAdminPaths: [],
  hcFactoryIds: [],
};

const org = (orgUnitPath: string, factoryId = FACTORY) => ({
  kind: 'org' as const,
  factoryId,
  orgUnitPath,
});

describe('permission matrix (plan section 3)', () => {
  it('every action has at least one granting role', () => {
    for (const action of ACTIONS) {
      expect(Object.keys(PERMISSION_MATRIX[action]).length, action).toBeGreaterThan(0);
    }
  });

  it('employee can only act on their own data', () => {
    expect(authorize(employee, 'menu.registerOwn', { kind: 'self', employeeId: 'e1' })).toBe(true);
    expect(authorize(employee, 'menu.registerOwn', { kind: 'self', employeeId: 'other' })).toBe(
      false,
    );
  });

  it('employee sees colleagues only in their own meal unit (team.view)', () => {
    expect(authorize(employee, 'team.view', org(PROD_LINE))).toBe(true);
    expect(authorize(employee, 'team.view', org(OFFICE))).toBe(false);
  });

  it('dept admin acts inside assigned nodes including children', () => {
    expect(authorize(deptAdmin, 'pin.reset', org(PROD))).toBe(true);
    expect(authorize(deptAdmin, 'pin.reset', org(PROD_LINE))).toBe(true);
  });

  it('dept admin is denied outside assigned nodes, including prefix look-alikes', () => {
    expect(authorize(deptAdmin, 'pin.reset', org(OFFICE))).toBe(false);
    expect(authorize(deptAdmin, 'pin.reset', org(OFFICE_LIKE))).toBe(false);
    expect(authorize(deptAdmin, 'pin.reset', { kind: 'factory', factoryId: FACTORY })).toBe(false);
  });

  it('dept admin has no HC-only action', () => {
    expect(authorize(deptAdmin, 'day.finalize', org(PROD))).toBe(false);
    expect(authorize(deptAdmin, 'settings.manage', org(PROD))).toBe(false);
    expect(hasAnyGrant(deptAdmin, 'menu.manage')).toBe(false);
  });

  it('HC admin reaches the whole of their own factory only', () => {
    expect(authorize(hcAdmin, 'pin.reset', org(OFFICE))).toBe(true);
    expect(authorize(hcAdmin, 'day.finalize', { kind: 'factory', factoryId: FACTORY })).toBe(true);
    expect(authorize(hcAdmin, 'pin.reset', org(OFFICE, 'other-factory'))).toBe(false);
  });

  it('HC admin cannot assign privileged roles or configure integrations (system admin only)', () => {
    expect(authorize(hcAdmin, 'roles.assignPrivileged', { kind: 'system' })).toBe(false);
    expect(authorize(hcAdmin, 'integration.configure', { kind: 'system' })).toBe(false);
    expect(authorize(sysAdmin, 'roles.assignPrivileged', { kind: 'system' })).toBe(true);
  });

  it('system admin resets PINs everywhere but has no meal-operations actions', () => {
    expect(authorize(sysAdmin, 'pin.reset', org(OFFICE))).toBe(true);
    expect(authorize(sysAdmin, 'day.finalize', { kind: 'factory', factoryId: FACTORY })).toBe(
      false,
    );
    expect(authorize(sysAdmin, 'team.view', org(OFFICE))).toBe(false);
  });

  it('roles stack: a dept admin is still an employee for their own meals', () => {
    expect(authorize(deptAdmin, 'menu.registerOwn', { kind: 'self', employeeId: 'e2' })).toBe(true);
  });
});

describe('list scopes', () => {
  it('dept admin lists are filtered to assigned paths', () => {
    const scope = resolveListScope(deptAdmin, 'pin.reset');
    expect(scope).toEqual({ kind: 'paths', paths: [PROD] });
    expect(listScopeIncludes(scope, { factoryId: FACTORY, orgUnitPath: PROD_LINE })).toBe(true);
    expect(listScopeIncludes(scope, { factoryId: FACTORY, orgUnitPath: OFFICE_LIKE })).toBe(false);
  });

  it('HC admin lists cover their factories; system admin lists cover everything', () => {
    expect(resolveListScope(hcAdmin, 'pin.reset')).toEqual({
      kind: 'factories',
      factoryIds: [FACTORY],
    });
    expect(resolveListScope(sysAdmin, 'pin.reset')).toEqual({ kind: 'all' });
  });

  it('a role with no grant gets an empty list scope', () => {
    expect(resolveListScope(employee, 'pin.reset')).toEqual({ kind: 'none' });
    expect(listScopeIncludes({ kind: 'none' }, { factoryId: FACTORY, orgUnitPath: PROD })).toBe(
      false,
    );
  });

  it('employee team list is limited to their own meal unit', () => {
    expect(resolveListScope(employee, 'team.view')).toEqual({ kind: 'paths', paths: [PROD_LINE] });
  });
});
