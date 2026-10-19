import { toVnDateTime } from '@meal/shared';
import { SEED_EMPLOYEE_COUNT } from '../../seed-data';
import { DmpError } from '../dmp.client';
import { HttpDmpClient } from '../http-dmp.client';
import { loadEnv } from '../../config/env';
import { MOCK_SCENARIO_NAMES, MockDmpClient } from './mock-dmp.client';

const DAY = '2026-10-19';
const hhmm = (d: Date) => {
  const vn = toVnDateTime(d);
  return `${String(vn.hour).padStart(2, '0')}:${String(vn.minute).padStart(2, '0')}`;
};

describe('MockDmpClient', () => {
  it('ships every scenario the plan lists', () => {
    expect(MOCK_SCENARIO_NAMES).toEqual(
      expect.arrayContaining([
        'on-time',
        'late',
        'forgot-to-check-in',
        'morning-leave',
        'afternoon-leave',
        'api-error',
        'too-little-data',
      ]),
    );
  });

  it('rejects an unknown scenario with the list of valid ones', () => {
    expect(() => new MockDmpClient('nope')).toThrow(/Available: on-time/);
  });

  it('serves the seed org tree and 1,700 employees', async () => {
    const dmp = new MockDmpClient('on-time');
    const [tree, employees] = await Promise.all([dmp.getOrgTree(), dmp.getEmployees()]);
    expect(tree.filter((n) => n.parentCode === null)).toHaveLength(1);
    expect(Math.max(...tree.map((n) => n.depth))).toBe(6);
    expect(employees).toHaveLength(SEED_EMPLOYEE_COUNT);
  });

  it('on-time: everyone checks in at 07:45 Vietnam time', async () => {
    const records = await new MockDmpClient('on-time').getAttendance(DAY);
    expect(records).toHaveLength(SEED_EMPLOYEE_COUNT);
    expect(new Set(records.map((r) => hhmm(r.checkInAt)))).toEqual(new Set(['07:45']));
  });

  it('late: the affected range checks in after the 08:10 cutoff', async () => {
    const records = await new MockDmpClient('late').getAttendance(DAY);
    const byCode = new Map(records.map((r) => [r.employeeCode, hhmm(r.checkInAt)]));
    expect(byCode.get('PNJP000008')).toBe('08:15');
    expect(byCode.get('PNJP000007')).toBe('07:45');
  });

  it('forgot-to-check-in: the affected range has no record', async () => {
    const records = await new MockDmpClient('forgot-to-check-in').getAttendance(DAY);
    expect(records).toHaveLength(SEED_EMPLOYEE_COUNT - 13);
    expect(records.some((r) => r.employeeCode === 'PNJP000010')).toBe(false);
  });

  it('too-little-data: only 30% of employees have attendance', async () => {
    const records = await new MockDmpClient('too-little-data').getAttendance(DAY);
    expect(records).toHaveLength(Math.floor(SEED_EMPLOYEE_COUNT * 0.3));
  });

  it('morning and afternoon leave produce AM and PM flags for every day in range', async () => {
    const am = await new MockDmpClient('morning-leave').getLeave('2026-10-19', '2026-10-20');
    const pm = await new MockDmpClient('afternoon-leave').getLeave('2026-10-19', '2026-10-19');
    expect(am).toHaveLength(13 * 2);
    expect(new Set(am.map((l) => l.dayType))).toEqual(new Set(['AM']));
    expect(new Set(pm.map((l) => l.dayType))).toEqual(new Set(['PM']));
  });

  it('api-error: attendance and leave calls fail with a DmpError', async () => {
    const dmp = new MockDmpClient('api-error');
    await expect(dmp.getAttendance(DAY)).rejects.toBeInstanceOf(DmpError);
    await expect(dmp.getLeave(DAY, DAY)).rejects.toBeInstanceOf(DmpError);
  });
});

describe('HttpDmpClient skeleton', () => {
  it('exposes the same interface but leaves the endpoints to P1 and P3', async () => {
    const env = loadEnv({
      DATABASE_URL: 'postgresql://x:x@localhost:5432/x',
      SESSION_SECRET: 'test-secret-test-secret-test-secret-1234',
      DMP_MODE: 'http',
      DMP_BASE_URL: 'http://dmp.invalid',
      DMP_SERVICE_EMAIL: 'svc@example.test',
      DMP_SERVICE_PASSWORD: 'x',
      DMP_COMPANY_CODE: 'PNJP',
    });
    const http = new HttpDmpClient(env);
    await expect(http.getEmployees()).rejects.toThrow(/P1/);
    await expect(http.getAttendance(DAY)).rejects.toThrow(/P3/);
  });
});
