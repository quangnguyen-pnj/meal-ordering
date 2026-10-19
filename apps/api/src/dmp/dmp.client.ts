/**
 * The only way the system talks to DMP (plan section 5, 7.1 rule 8). Read-only: it never writes
 * back and never calls POST /api/hr/attendance/generate-data.
 */
export const DMP_CLIENT = Symbol('DMP_CLIENT');

export interface DmpOrgNode {
  code: string;
  name: string;
  parentCode: string | null;
  /** Level name as DMP reports it; the 1..6 mapping (BR-61, A14) is applied by the org sync (P1). */
  levelName: string;
  /** Depth from the root, 1-based, as derived from the tree. */
  depth: number;
  costCenterCode: string | null;
}

export interface DmpEmployee {
  /** DMP employeeId, normalized to employeeCode. */
  employeeCode: string;
  name: string;
  email: string | null;
  orgUnitCode: string;
  costCenterCode: string | null;
  /** YYYY-MM-DD */
  startDate: string | null;
}

export interface DmpAttendanceRecord {
  employeeCode: string;
  /** Check-in as a UTC instant (DMP local time is treated as Vietnam time, assumption A7). */
  checkInAt: Date;
}

export type DmpLeaveDayType = 'FULL' | 'AM' | 'PM';

export interface DmpLeaveRecord {
  employeeCode: string;
  /** YYYY-MM-DD */
  date: string;
  dayType: DmpLeaveDayType;
  leaveTypeName: string;
}

export interface DmpClient {
  getOrgTree(): Promise<DmpOrgNode[]>;
  getEmployees(): Promise<DmpEmployee[]>;
  /** Whole-day attendance (DMP has no time filter); `date` is YYYY-MM-DD. */
  getAttendance(date: string): Promise<DmpAttendanceRecord[]>;
  /** Leave flags for the inclusive date range (YYYY-MM-DD). */
  getLeave(fromDate: string, toDate: string): Promise<DmpLeaveRecord[]>;
}

export type DmpErrorKind = 'API_ERROR' | 'AUTH' | 'TIMEOUT' | 'NOT_IMPLEMENTED';

export class DmpError extends Error {
  constructor(
    readonly kind: DmpErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'DmpError';
  }
}
