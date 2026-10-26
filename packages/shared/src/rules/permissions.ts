import type { Role } from '../enums';

/**
 * Permission matrix from plan section 3, checked as a (role, action, scope) triple.
 * The API guard calls `authorize`; the UI only uses it to hide buttons.
 */

export const ACTIONS = [
  'menu.registerOwn',
  'team.view',
  'registration.onBehalf',
  'registration.addExtra',
  'presence.confirm',
  'registration.notRegisteredList',
  'dishes.manage',
  'menu.manage',
  'reconciliation.view',
  'day.finalize',
  'export.finalAndForecast',
  'adjustment.manage',
  'delivery.confirmUnit',
  'delivery.confirmFinal',
  'reports.view',
  'pin.reset',
  'org.manage',
  'settings.manage',
  'sync.manage',
  'audit.view',
  'roles.assignPrivileged',
  'integration.configure',
] as const;
export type Action = (typeof ACTIONS)[number];

/**
 * How far a role's grant reaches.
 * SELF: the caller's own data.
 * OWN_UNIT: the caller's meal unit.
 * UNITS: assigned org nodes and their children.
 * FACTORY: the whole factory.
 * SYSTEM: everything.
 */
export type ScopeLevel = 'SELF' | 'OWN_UNIT' | 'UNITS' | 'FACTORY' | 'SYSTEM';

type Grants = Partial<Record<Role, ScopeLevel>>;

const ALL_SELF: Grants = {
  EMPLOYEE: 'SELF',
  DEPT_ADMIN: 'SELF',
  HC_ADMIN: 'SELF',
  SYS_ADMIN: 'SELF',
};
const UNITS_OR_FACTORY: Grants = { DEPT_ADMIN: 'UNITS', HC_ADMIN: 'FACTORY' };
const HC_ONLY: Grants = { HC_ADMIN: 'FACTORY' };
const HC_OR_SYSTEM: Grants = { HC_ADMIN: 'FACTORY', SYS_ADMIN: 'SYSTEM' };
const SYSTEM_ONLY: Grants = { SYS_ADMIN: 'SYSTEM' };

export const PERMISSION_MATRIX: Readonly<Record<Action, Grants>> = {
  'menu.registerOwn': ALL_SELF,
  'team.view': { EMPLOYEE: 'OWN_UNIT', DEPT_ADMIN: 'UNITS', HC_ADMIN: 'FACTORY' },
  'registration.onBehalf': UNITS_OR_FACTORY,
  'registration.addExtra': UNITS_OR_FACTORY,
  'presence.confirm': UNITS_OR_FACTORY,
  'registration.notRegisteredList': UNITS_OR_FACTORY,
  'dishes.manage': HC_ONLY,
  'menu.manage': HC_ONLY,
  'reconciliation.view': UNITS_OR_FACTORY,
  'day.finalize': HC_ONLY,
  'export.finalAndForecast': HC_ONLY,
  'adjustment.manage': HC_ONLY,
  'delivery.confirmUnit': UNITS_OR_FACTORY,
  'delivery.confirmFinal': HC_ONLY,
  'reports.view': UNITS_OR_FACTORY,
  'pin.reset': { DEPT_ADMIN: 'UNITS', HC_ADMIN: 'FACTORY', SYS_ADMIN: 'SYSTEM' },
  'org.manage': HC_OR_SYSTEM,
  'settings.manage': HC_OR_SYSTEM,
  'sync.manage': HC_OR_SYSTEM,
  'audit.view': HC_OR_SYSTEM,
  'roles.assignPrivileged': SYSTEM_ONLY,
  'integration.configure': SYSTEM_ONLY,
};

/**
 * Org-tree paths are materialized as `/<id>/<id>/.../` with a trailing slash, so
 * `child.startsWith(ancestor)` is a safe "is within" test (no `/1/2/` vs `/1/22/` confusion).
 */
export type OrgPath = string;

export type ResourceScope =
  | { kind: 'self'; employeeId: string }
  | { kind: 'org'; factoryId: string; orgUnitPath: OrgPath }
  | { kind: 'factory'; factoryId: string }
  | { kind: 'system' };

/** The signed-in user as the guard sees them. */
export interface Principal {
  employeeId: string;
  /** Always includes EMPLOYEE for an active employee. */
  roles: readonly Role[];
  /** Path of the caller's own meal unit, if any (for OWN_UNIT grants). */
  mealUnitPath: OrgPath | null;
  /** Paths of the org nodes a DEPT_ADMIN manages (for UNITS grants). */
  deptAdminPaths: readonly OrgPath[];
  /** Factories the caller is HC admin of (for FACTORY grants). */
  hcFactoryIds: readonly string[];
}

export function isWithinPath(path: OrgPath, ancestor: OrgPath): boolean {
  return path.startsWith(ancestor);
}

function levelAllows(level: ScopeLevel, principal: Principal, scope: ResourceScope): boolean {
  switch (level) {
    case 'SYSTEM':
      return true;
    case 'FACTORY':
      return (
        (scope.kind === 'org' || scope.kind === 'factory') &&
        principal.hcFactoryIds.includes(scope.factoryId)
      );
    case 'UNITS':
      return (
        scope.kind === 'org' &&
        principal.deptAdminPaths.some((assigned) => isWithinPath(scope.orgUnitPath, assigned))
      );
    case 'OWN_UNIT':
      return (
        scope.kind === 'org' &&
        principal.mealUnitPath !== null &&
        isWithinPath(scope.orgUnitPath, principal.mealUnitPath)
      );
    case 'SELF':
      return scope.kind === 'self' && scope.employeeId === principal.employeeId;
  }
}

/** True when any of the caller's roles grants `action` over `scope`. */
export function authorize(principal: Principal, action: Action, scope: ResourceScope): boolean {
  const grants = PERMISSION_MATRIX[action];
  return principal.roles.some((role) => {
    const level = grants[role];
    return level !== undefined && levelAllows(level, principal, scope);
  });
}

/** True when any role could grant `action` at all (before looking at a concrete scope). */
export function hasAnyGrant(principal: Principal, action: Action): boolean {
  const grants = PERMISSION_MATRIX[action];
  return principal.roles.some((role) => grants[role] !== undefined);
}

/**
 * Filter a list query must apply for `action` (plan section 3: every list query by a dept admin
 * is filtered by scope).
 */
export type ListScope =
  | { kind: 'none' }
  | { kind: 'all' }
  | { kind: 'factories'; factoryIds: string[] }
  | { kind: 'paths'; paths: OrgPath[] }
  | { kind: 'self'; employeeId: string };

export function resolveListScope(principal: Principal, action: Action): ListScope {
  const grants = PERMISSION_MATRIX[action];
  const levels = new Set<ScopeLevel>();
  for (const role of principal.roles) {
    const level = grants[role];
    if (level) levels.add(level);
  }
  if (levels.has('SYSTEM')) return { kind: 'all' };
  if (levels.has('FACTORY') && principal.hcFactoryIds.length > 0) {
    return { kind: 'factories', factoryIds: [...principal.hcFactoryIds] };
  }
  const paths: OrgPath[] = [];
  if (levels.has('UNITS')) paths.push(...principal.deptAdminPaths);
  if (levels.has('OWN_UNIT') && principal.mealUnitPath) paths.push(principal.mealUnitPath);
  if (paths.length > 0) return { kind: 'paths', paths };
  if (levels.has('SELF')) return { kind: 'self', employeeId: principal.employeeId };
  return { kind: 'none' };
}

/** Does a row at `orgUnitPath` of `factoryId` fall inside the list scope? */
export function listScopeIncludes(
  scope: ListScope,
  row: { factoryId: string; orgUnitPath: OrgPath; employeeId?: string },
): boolean {
  switch (scope.kind) {
    case 'none':
      return false;
    case 'all':
      return true;
    case 'factories':
      return scope.factoryIds.includes(row.factoryId);
    case 'paths':
      return scope.paths.some((p) => isWithinPath(row.orgUnitPath, p));
    case 'self':
      return row.employeeId === scope.employeeId;
  }
}
