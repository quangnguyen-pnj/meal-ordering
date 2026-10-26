import type { Metadata, Viewport } from 'next';
// Be Vietnam Pro: drawn for Vietnamese diacritics, self-hosted from node_modules (intranet only).
import '@fontsource/be-vietnam-pro/400.css';
import '@fontsource/be-vietnam-pro/500.css';
import '@fontsource/be-vietnam-pro/600.css';
import '@fontsource/be-vietnam-pro/700.css';
import './globals.css';
import { Providers } from './providers';
import { t } from '@/messages';

export const metadata: Metadata = {
  title: t('app.name'),
  description: t('app.tagline'),
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
