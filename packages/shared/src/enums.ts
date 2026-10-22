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

/** BR-10: main-dish types. Display labels live in rules/menu (BR-12). */
export const DISH_TYPES = ['CHAY', 'CHAO', 'MAN'] as const;
export type DishType = (typeof DISH_TYPES)[number];

/** Meal sessions; the MVP serves lunch only (plan section 1). */
export const MEAL_SESSIONS = ['LUNCH'] as const;
export type MealSession = (typeof MEAL_SESSIONS)[number];

export const MENU_WEEK_STATUSES = ['DRAFT', 'PUBLISHED', 'CLOSED'] as const;
export type MenuWeekStatus = (typeof MENU_WEEK_STATUSES)[number];

export const REGISTRATION_STATUSES = ['ACTIVE', 'NEEDS_RESELECT', 'CANCELLED'] as const;
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];

/** In-app notices (BR-14). */
export const NOTIFICATION_TYPES = ['MENU_DISH_REPLACED', 'MENU_DISH_REMOVED'] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** BR-64: an upload is validated into PREVIEW (or REJECTED), then APPLIED all at once. */
export const MAPPING_IMPORT_STATUSES = ['PREVIEW', 'REJECTED', 'APPLIED'] as const;
export type MappingImportStatus = (typeof MAPPING_IMPORT_STATUSES)[number];

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
  /** A unique code or name is already taken. */
  'CONFLICT',
  /** Master data still mapped somewhere cannot be deactivated. */
  'IN_USE',
  /** The resource is in a state that does not allow this action (e.g. already published). */
  'INVALID_STATE',
  /** BR-24: the day has locked (day.lockTime) for this kind of change. */
  'DAY_LOCKED',
  /** A DMP call failed; nothing was written. */
  'DMP_UNAVAILABLE',
  'INTERNAL',
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];
