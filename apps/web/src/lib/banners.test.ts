import { describe, expect, it } from 'vitest';
import { toBanners } from './banners';

describe('banners', () => {
  it('BR-06: the "menu not published" warning names the canteen and week in Vietnamese', () => {
    const [b] = toBanners([
      {
        id: 'menu-not-published:ct_gv:2027-03-01',
        severity: 'warning',
        kind: 'MENU_NOT_PUBLISHED',
        params: { canteen: 'Nhà ăn Gò Vấp', weekStart: '2027-03-01' },
      },
    ]);
    expect(b).toEqual({
      id: 'menu-not-published:ct_gv:2027-03-01',
      severity: 'warning',
      message:
        'Thực đơn tuần bắt đầu 01/03/2027 của Nhà ăn Gò Vấp chưa được công bố. Nhân viên chưa thể đăng ký.',
    });
  });

  it('BR-14: notices carry their id so the employee can dismiss them', () => {
    const [b] = toBanners([
      {
        id: 'notification:n1',
        severity: 'info',
        kind: 'NOTIFICATION',
        notificationId: 'n1',
        notificationType: 'MENU_DISH_REPLACED',
        params: { date: '2027-03-01', from: 'Mặn Cá kho tộ', to: 'Mặn Sườn ram' },
      },
    ]);
    expect(b!.dismissId).toBe('n1');
    expect(b!.message).toBe(
      'Thực đơn ngày 01/03/2027: món Mặn Cá kho tộ được đổi thành Mặn Sườn ram. Suất bạn đã đăng ký đã chuyển sang món mới.',
    );
  });
});
