/** Roles stack on one employee account (plan section 3). EMPLOYEE is implicit for every active employee. */
export const ROLES = ['EMPLOYEE', 'DEPT_ADMIN', 'HC_ADMIN', 'SYS_ADMIN'] as const;
export type Role = (typeof ROLES)[number];

/** Roles that are stored as RoleAssignment rows (EMPLOYEE is automatic on sync). */
export const ASSIGNABLE_ROLES = ['DEPT_ADMIN', 'HC_ADMIN', 'SYS_ADMIN'] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export const ORG_LEVELS = [1, 2, 3, 4, 5, 6] as const;
export type OrgLevel = (typeof ORG_LEVELS)[number];
export const MAX_ORG_LEVEL = 6;

export const EMPLOYEE_STATUSES = ['ACTIVE', 'LEFT'] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

export const COST_CENTER_SOURCES = ['DMP', 'MANUAL'] as const;
export type CostCenterSource = (typeof COST_CENTER_SOURCES)[number];

export const SYNC_TYPES = ['ORG_EMPLOYEES', 'ATTENDANCE', 'LEAVE'] as const;
export type SyncType = (typeof SYNC_TYPES)[number];

export const SYNC_STATUSES = ['RUNNING', 'SUCCESS', 'FAILED'] as const;
export type SyncStatus = (typeof SYNC_STATUSES)[number];

/** Machine-readable error codes the API returns; the web maps them to Vietnamese copy. */
export const API_ERROR_CODES = [
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'VALIDATION_FAILED',
  'INVALID_CREDENTIALS',
  'PIN_LOCKED',
  'PIN_CHANGE_REQUIRED',
  'PIN_UNCHANGED',
  'SSO_NOT_LINKED',
  'SSO_FAILED',
  'INTERNAL',
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];
