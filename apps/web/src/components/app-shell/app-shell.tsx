'use client';

import type { SessionUser } from '@meal/shared';
import { LogOut, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { visibleNav, type NavItem } from '@/lib/nav';
import { cn } from '@/lib/utils';
import { t, vi } from '@/messages';
import { BannerArea, type Banner } from './banner-area';

function NavLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex min-h-11 items-center rounded-md px-3 text-sm transition-colors hover:bg-accent',
        active && 'bg-accent font-medium text-accent-foreground',
      )}
    >
      {t(item.labelKey)}
    </Link>
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

  async function signOut() {
    await api.post('/auth/logout').catch(() => undefined);
    router.replace('/login');
    router.refresh();
  }

  const roleLabels = user.roles
    .filter((r) => r !== 'EMPLOYEE')
    .map((r) => vi.roles[r])
    .join(', ');

  return (
    <div className="min-h-screen lg:flex">
      <header className="flex items-center justify-between border-b px-4 py-2 lg:hidden print:hidden">
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

      <aside
        id="main-nav"
        className={cn(
          'w-full shrink-0 border-b bg-card lg:block lg:w-64 lg:border-b-0 lg:border-r print:hidden',
          open ? 'block' : 'hidden',
        )}
      >
        <div className="hidden px-4 py-5 lg:block">
          <p className="text-lg font-semibold">{t('app.name')}</p>
          <p className="text-sm text-muted-foreground">{t('app.factory')}</p>
        </div>
        <nav aria-label={t('nav.label')} className="flex flex-col gap-4 px-2 pb-4">
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
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-end gap-3 border-b px-4 py-2 print:hidden">
          <div className="text-right text-sm leading-tight">
            <p className="font-medium">{user.name}</p>
            <p className="text-xs text-muted-foreground">
              {user.employeeCode}
              {roleLabels ? ` · ${roleLabels}` : ''}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={signOut}>
            <LogOut className="h-4 w-4" aria-hidden />
            {t('common.signOut')}
          </Button>
        </div>
        <main className="flex flex-1 flex-col gap-4 p-4 md:p-6 print:p-0">
          <div className="print:hidden">
            <BannerArea banners={banners} />
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
