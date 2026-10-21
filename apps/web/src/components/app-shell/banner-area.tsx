'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { t } from '@/messages';

export interface Banner {
  id: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  /** In-app notice (BR-14) the user can mark as read. */
  dismissId?: string;
  /** Where to fix it, e.g. the menu builder for "menu not published". */
  action?: { href: string; label: string };
}

const VARIANT = { info: 'default', warning: 'warning', error: 'destructive' } as const;

/**
 * Top-of-page warnings shared by every screen (plan section 4): menu not published (BR-06) and
 * in-app notices (BR-14); attendance sync and finalization warnings join in P3 and P4.
 */
export function BannerArea({ banners }: { banners: readonly Banner[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const visible = banners.filter((b) => !hidden.has(b.id));
  if (visible.length === 0) return null;

  async function dismiss(b: Banner) {
    setHidden((prev) => new Set(prev).add(b.id));
    await api.post(`/me/notifications/${b.dismissId}/read`).catch(() => undefined);
    router.refresh();
  }

  return (
    <section aria-label={t('banners.label')} className="flex flex-col gap-2">
      {visible.map((b) => (
        <Alert
          key={b.id}
          variant={VARIANT[b.severity]}
          role={b.severity === 'error' ? 'alert' : 'status'}
          className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
        >
          <span>{b.message}</span>
          <div className="flex shrink-0 gap-1">
            {b.action && !pathname.startsWith(b.action.href) ? (
              <Button asChild variant="outline" size="sm">
                <Link href={b.action.href}>{b.action.label}</Link>
              </Button>
            ) : null}
            {b.dismissId ? (
              <Button variant="ghost" size="sm" onClick={() => dismiss(b)}>
                {t('banners.dismiss')}
              </Button>
            ) : null}
          </div>
        </Alert>
      ))}
    </section>
  );
}
