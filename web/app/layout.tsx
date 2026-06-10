import type { Metadata } from 'next';
import './globals.css';
import { getLocale } from 'next-intl/server';

export const metadata: Metadata = {
  metadataBase: new URL('https://notion-manual-maker.vercel.app'),
  title: {
    default: 'Notion Manual Maker',
    template: '%s | Notion Manual Maker',
  },
  verification: {
    google: 'UQ7sjWq-9NYCZ0vriT2xwiD5ZFvfIW9ZkcbjRmZR9Yo',
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let locale = 'ja';
  try {
    locale = await getLocale();
  } catch (_) {}

  return (
    <html lang={locale}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Noto+Sans+JP:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans bg-white text-n-900 antialiased">
        {children}
      </body>
    </html>
  );
}
