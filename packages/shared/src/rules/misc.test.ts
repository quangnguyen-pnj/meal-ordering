import { describe, expect, it } from 'vitest';
import { ChangePinSchema, PinLoginSchema } from '../schemas/auth';
import { SETTING_KEYS, defaultSettingValue, isSettingKey, parseSettingValue } from '../settings';
import { isPinLocked, registerPinFailure } from './pin';
import { extractEntraEmail } from './sso';

describe('PIN lock rules', () => {
  const now = new Date('2026-10-19T01:00:00.000Z');

  it('locks for lockMinutes on the 5th wrong PIN and restarts the counter', () => {
    const state = registerPinFailure({ failedCount: 4, maxAttempts: 5, lockMinutes: 15, now });
    expect(state.failedCount).toBe(0);
    expect(state.lockedUntil?.toISOString()).toBe('2026-10-19T01:15:00.000Z');
  });

  it('only counts while below the limit', () => {
    expect(registerPinFailure({ failedCount: 2, maxAttempts: 5, lockMinutes: 15, now })).toEqual({
      failedCount: 3,
      lockedUntil: null,
    });
  });

  it('is locked strictly before lockedUntil', () => {
    const until = new Date('2026-10-19T01:15:00.000Z');
    expect(isPinLocked(until, new Date('2026-10-19T01:14:59.000Z'))).toBe(true);
    expect(isPinLocked(until, until)).toBe(false);
    expect(isPinLocked(null, now)).toBe(false);
  });
});

describe('Entra email mapping', () => {
  it('uses the email claim, lowercased and trimmed', () => {
    expect(extractEntraEmail({ email: '  An.Nguyen@PNJP.test ' })).toBe('an.nguyen@pnjp.test');
  });

  it('falls back to preferred_username when email is missing or not an address', () => {
    expect(extractEntraEmail({ preferred_username: 'Binh@pnjp.test' })).toBe('binh@pnjp.test');
    expect(extractEntraEmail({ email: 'not-an-email', preferred_username: 'c@pnjp.test' })).toBe(
      'c@pnjp.test',
    );
  });

  it('returns null when no claim holds an email', () => {
    expect(extractEntraEmail({})).toBeNull();
    expect(extractEntraEmail({ email: 42 })).toBeNull();
  });
});

describe('auth schemas', () => {
  it('accepts exactly six digits', () => {
    expect(PinLoginSchema.safeParse({ employeeCode: 'A1', pin: '123456' }).success).toBe(true);
    expect(PinLoginSchema.safeParse({ employeeCode: 'A1', pin: '12345' }).success).toBe(false);
    expect(PinLoginSchema.safeParse({ employeeCode: 'A1', pin: '12a456' }).success).toBe(false);
  });

  it('requires the new PIN to differ from the current one', () => {
    expect(ChangePinSchema.safeParse({ currentPin: '111111', newPin: '111111' }).success).toBe(
      false,
    );
    expect(ChangePinSchema.safeParse({ currentPin: '111111', newPin: '222222' }).success).toBe(
      true,
    );
  });
});

describe('settings (plan 6.4)', () => {
  it('every default validates against its own schema', () => {
    for (const key of SETTING_KEYS) {
      expect(() => parseSettingValue(key, defaultSettingValue(key)), key).not.toThrow();
    }
  });

  it('BR-03: registration.close defaults to Thursday 23:59', () => {
    expect(defaultSettingValue('registration.close')).toEqual({ weekday: 4, time: '23:59' });
  });

  it('holds the 17 documented keys', () => {
    expect(SETTING_KEYS).toHaveLength(17);
    expect(isSettingKey('pin.maxAttempts')).toBe(true);
    expect(isSettingKey('nope')).toBe(false);
  });

  it('rejects malformed values', () => {
    expect(() => parseSettingValue('day.lockTime', '8:00')).toThrow();
    expect(() => parseSettingValue('delivery.tolerancePct', 150)).toThrow();
  });
});
