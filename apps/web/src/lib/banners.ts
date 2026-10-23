import type { BannerView, NotificationType } from '@meal/shared';
import type { Banner } from '@/components/app-shell/banner-area';
import { formatDate } from '@/lib/utils';
import { t, vi } from '@/messages';

const asDate = (v: unknown) =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? formatDate(v) : String(v ?? '');

/** Turns the API's banner data into Vietnamese messages for the shared layout. */
export function toBanners(views: readonly BannerView[]): Banner[] {
  return views.map((b) => {
    if (b.kind === 'MENU_NOT_PUBLISHED') {
      return {
        id: b.id,
        severity: b.severity,
        message: t('banners.menuNotPublished', {
          canteen: String(b.params.canteen ?? ''),
          weekStart: asDate(b.params.weekStart),
        }),
        // Only HC admins get this banner, and they can always open the menu builder.
        action: { href: '/admin/menu', label: t('banners.openMenu') },
      };
    }
    const type = b.notificationType as NotificationType;
    const template = vi.banners.notifications[type] ?? '';
    const params: Record<string, string> = {};
    for (const [k, v] of Object.entries(b.params)) params[k] = k === 'date' ? asDate(v) : String(v);
    // Notices written before lockTime joined the payload name the deadline generically.
    params.lockTime ??= t('banners.lockTimeFallback');
    return {
      id: b.id,
      severity: b.severity,
      message: template.replace(/\{(\w+)\}/g, (m, name: string) => params[name] ?? m),
      dismissId: b.notificationId,
      // BR-14: a removed dish has to be reselected on the week screen before the lock.
      ...(type === 'MENU_DISH_REMOVED'
        ? { action: { href: '/week', label: t('banners.reselect') } }
        : {}),
    };
  });
}
