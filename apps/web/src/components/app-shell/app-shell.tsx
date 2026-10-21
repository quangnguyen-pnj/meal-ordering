'use client';

import type { SessionUser } from '@meal/shared';
import { LogOut, Menu, X } from 'lucide-react';
import Link, { useLinkStatus } from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { visibleNav, type NavItem } from '@/lib/nav';
import { cn } from '@/lib/utils';
import { t, vi } from '@/messages';
import { BannerArea, type Banner } from './banner-area';

const itemClass = 'flex min-h-11 items-center gap-2 rounded-md px-3 text-sm';

/** Spinner next to the link the user just clicked, until the new page has rendered. */
function PendingMark() {
  const { pending } = useLinkStatus();
  return pending ? <Spinner className="ml-auto text-muted-foreground" /> : null;
}

function NavLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate: () => void;
}) {
  if (!item.available) {
    // Placeholder screens stay listed so people know they are coming, but are not links.
    return (
      <span
        aria-disabled="true"
        title={t('nav.comingSoonHint', { phase: item.phase })}
        className={cn(itemClass, 'cursor-default text-muted-foreground/70')}
      >
        {t(item.labelKey)}
        <Badge variant="outline" className="ml-auto text-[0.65rem] font-normal">
          {t('nav.comingSoon')}
        </Badge>
      </span>
    );
  }
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        itemClass,
        'transition-colors hover:bg-accent',
        active && 'bg-accent font-medium text-accent-foreground',
      )}
    >
      {t(item.labelKey)}
      <PendingMark />
    </Link>
  );
}

function UserBlock({ user, onSignOut }: { user: SessionUser; onSignOut: () => void }) {
  const roleLabels = user.roles
    .filter((r) => r !== 'EMPLOYEE')
    .map((r) => vi.roles[r])
    .join(', ');
  return (
    <>
      <div className="min-w-0 text-sm leading-tight md:text-right">
        <p className="truncate font-medium">{user.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {user.employeeCode}
          {roleLabels ? ` · ${roleLabels}` : ''}
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onSignOut} className="shrink-0">
        <LogOut className="h-4 w-4" aria-hidden />
        {t('common.signOut')}
      </Button>
    </>
  );
}

export function AppShell({
  user,
  banners,
  children,
}: {
  user: SessionUser;
  banners: readonly Banner[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const nav = visibleNav(user.roles);
  const groups = [
    { key: 'mine', title: t('nav.groups.mine'), items: nav.mine },
    { key: 'admin', title: t('nav.groups.admin'), items: nav.admin },
  ].filter((g) => g.items.length > 0);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  async function signOut() {
    await api.post('/auth/logout').catch(() => undefined);
    router.replace('/login');
    router.refresh();
  }

  return (
    <div className="min-h-screen md:flex">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-card px-4 md:hidden">
        <span className="font-semibold">{t('app.name')}</span>
        <Button
          variant="ghost"
          size="icon"
          aria-expanded={open}
          aria-controls="main-nav"
          aria-label={open ? t('common.closeMenu') : t('common.menu')}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </header>

      {open ? (
        <div
          className="fixed inset-0 top-14 z-20 bg-foreground/30 md:hidden"
          aria-hidden
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside
        id="main-nav"
        className={cn(
          'fixed inset-x-0 bottom-0 top-14 z-20 flex-col overflow-y-auto border-b bg-card md:sticky md:top-0 md:flex md:h-screen md:w-64 md:shrink-0 md:border-b-0 md:border-r',
          open ? 'flex' : 'hidden',
        )}
      >
        <div className="hidden px-4 py-5 md:block">
          <p className="text-lg font-semibold">{t('app.name')}</p>
          <p className="text-sm text-muted-foreground">{t('app.factory')}</p>
        </div>
        <nav aria-label={t('nav.label')} className="flex flex-col gap-4 px-2 py-4 md:pt-0">
          {groups.map((group) => (
            <div key={group.key}>
              <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group.title}
              </p>
              <ul className="flex flex-col gap-0.5">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <NavLink
                      item={item}
                      active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
                      onNavigate={() => setOpen(false)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        {/* On phones the account block lives in the menu so the header stays one row. */}
        <div className="mt-auto flex items-center justify-between gap-3 border-t p-4 md:hidden">
          <UserBlock user={user} onSignOut={signOut} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="hidden items-center justify-end gap-3 border-b px-4 py-2 md:flex">
          <UserBlock user={user} onSignOut={signOut} />
        </div>
        <main className="flex flex-1 flex-col gap-4 p-4 md:p-6">
          <BannerArea banners={banners} />
          {children}
        </main>
      </div>
    </div>
  );
}
