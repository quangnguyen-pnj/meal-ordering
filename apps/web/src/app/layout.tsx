import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';
import { t } from '@/messages';
import { Inter } from 'next/font/google';

export const metadata: Metadata = {
  title: t('app.name'),
  description: t('app.tagline'),
};

// `subsets` picks what is preloaded; almost every line has ầ, ố, ệ… so preload Vietnamese too.
const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-inter',
});

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className={inter.variable}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
