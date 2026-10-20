'use client';

import { useRouter } from 'next/navigation';
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
}

/**
 * Top-of-page warnings shared by every screen (plan section 4): menu not published (BR-06) and
 * in-app notices (BR-14); attendance sync and finalization warnings join in P3 and P4.
 */
export function BannerArea({ banners }: { banners: readonly Banner[] }) {
  const router = useRouter();
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
          variant={b.severity}
          role={b.severity === 'error' ? 'alert' : 'status'}
          className="flex items-start justify-between gap-3"
        >
          <span>{b.message}</span>
          {b.dismissId ? (
            <Button variant="ghost" size="sm" onClick={() => dismiss(b)}>
              {t('banners.dismiss')}
            </Button>
          ) : null}
        </Alert>
      ))}
    </section>
  );
}
