import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';
import { t } from '@/messages';
import { Inter } from 'next/font/google';

export const metadata: Metadata = {
  title: t('app.name'),
  description: t('app.tagline'),
};

const inter = Inter({
  subsets: ['latin'],
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
