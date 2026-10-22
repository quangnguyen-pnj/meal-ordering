import { Alert } from '@/components/ui/alert';
import { findNavItem, isNavItemVisible } from '@/lib/nav';
import { getSession } from '@/lib/server-api';
import { t } from '@/messages';

/**
 * Hides a screen from roles the navigation would not show it to. Only a convenience: the API
 * checks (role, action, scope) on every call (plan section 3).
 */
export async function ScreenGuard({ href, children }: { href: string; children: React.ReactNode }) {
  const item = findNavItem(href);
  const user = await getSession();
  if (!item || !user || !isNavItemVisible(item, user.roles)) {
    return <Alert variant="destructive">{t('placeholder.forbidden')}</Alert>;
  }
  return <>{children}</>;
}
