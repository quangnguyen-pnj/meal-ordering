import { notFound } from 'next/navigation';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { findNavItem, isNavItemVisible } from '@/lib/nav';
import { getSession } from '@/lib/server-api';
import { t } from '@/messages';

/**
 * Phase 0 stand-in for every screen that later phases deliver. It only exists for routes in the
 * navigation registry; anything else is a 404.
 */
export default async function PlaceholderPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const item = findNavItem(`/${slug.join('/')}`);
  if (!item) notFound();

  const user = await getSession();
  if (!user || !isNavItemVisible(item, user.roles)) {
    return <Alert variant="error">{t('placeholder.forbidden')}</Alert>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t(item.labelKey)}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="font-medium">{t('placeholder.title')}</p>
        <p className="text-sm text-muted-foreground">
          {t('placeholder.body', { phase: item.phase })}
        </p>
      </CardContent>
    </Card>
  );
}
