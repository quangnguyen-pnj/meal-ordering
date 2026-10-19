import { API_ERROR_CODES, ROLES } from '@meal/shared';
import { describe, expect, it } from 'vitest';
import { NAV_ITEMS } from '@/lib/nav';
import { errorMessage, t } from './index';

describe('Vietnamese messages', () => {
  it('has copy for every API error code', () => {
    for (const code of API_ERROR_CODES) {
      expect(errorMessage(code), code).toMatch(/\S/);
    }
  });

  it('has a label for every role and every navigation item', () => {
    for (const role of ROLES) expect(t(`roles.${role}`)).not.toBe(`roles.${role}`);
    for (const item of NAV_ITEMS) expect(t(item.labelKey)).not.toBe(item.labelKey);
  });

  it('fills placeholders and leaves unknown ones visible', () => {
    expect(t('placeholder.body', { phase: 'P2' })).toBe('Màn hình này sẽ có ở giai đoạn P2.');
    expect(t('placeholder.body')).toContain('{phase}');
  });

  it('is written in Vietnamese with diacritics', () => {
    expect(t('login.title')).toBe('Đăng nhập');
    expect(t('changePin.title')).toBe('Đổi mã PIN');
  });
});
