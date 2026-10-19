import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell/app-shell';
import type { Banner } from '@/components/app-shell/banner-area';
import { getSession } from '@/lib/server-api';

export const dynamic = 'force-dynamic';

// Later phases fill this: menu not published (P1), attendance sync failed (P3), day not finalized (P4).
const BANNERS: Banner[] = [];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user) redirect('/login');
  if (user.pinMustChange) redirect('/change-pin');

  return (
    <AppShell user={user} banners={BANNERS}>
      {children}
    </AppShell>
  );
}
