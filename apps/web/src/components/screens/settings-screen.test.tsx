import { SETTING_KEYS, defaultSettingValue } from '@meal/shared';
import { describe, expect, it } from 'vitest';
import { vi } from '@/messages';
import { describeSetting } from './settings-screen';

describe('settings screen', () => {
  it('has a Vietnamese label for every plan 6.4 key', () => {
    for (const key of SETTING_KEYS) expect(vi.settings.keys[key]).toMatch(/\S/);
  });

  it('describes weekday-time and serving-day values in Vietnamese', () => {
    expect(describeSetting('registration.close', defaultSettingValue('registration.close'))).toBe(
      'Thứ Năm lúc 23:59',
    );
    expect(describeSetting('servingDays', [1, 2, 3, 4, 5])).toBe(
      'Thứ Hai, Thứ Ba, Thứ Tư, Thứ Năm, Thứ Sáu',
    );
    expect(describeSetting('day.lockTime', '08:00')).toBe('08:00');
  });
});
