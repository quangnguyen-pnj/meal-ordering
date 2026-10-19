import { Alert } from '@/components/ui/alert';
import { t } from '@/messages';

export interface Banner {
  id: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
}

/**
 * Top-of-page warnings shared by every screen (plan section 4: menu not published, attendance sync
 * failed, day not finalized). Phase 0 only provides the area; later phases feed it banners.
 */
export function BannerArea({ banners }: { banners: readonly Banner[] }) {
  if (banners.length === 0) return null;
  return (
    <section aria-label={t('banners.label')} className="flex flex-col gap-2">
      {banners.map((b) => (
        <Alert key={b.id} variant={b.severity} role={b.severity === 'error' ? 'alert' : 'status'}>
          {b.message}
        </Alert>
      ))}
    </section>
  );
}
