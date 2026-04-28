import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://chrome-manual-maker.s-tasklog.com'),
  title: {
    default: 'Chrome Manual Maker — Notionに自動保存するマニュアル作成ツール',
    template: '%s | Chrome Manual Maker',
  },
  description:
    'クリックするだけでスクリーンショット+矢印アノテーションをNotionへ自動保存。操作マニュアル・手順書作成を10倍速に。Chrome拡張機能で無料から始められます。',
  keywords: [
    'Chrome拡張機能', 'Notion連携', 'マニュアル作成', '手順書', 'スクリーンショット',
    '操作マニュアル', 'Webマニュアル自動作成', '業務効率化',
  ],
  openGraph: {
    type: 'website',
    locale: 'ja_JP',
    siteName: 'Chrome Manual Maker',
    images: [{ url: '/og.svg', width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image' },
  alternates: { canonical: '/' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+JP:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans bg-white text-n-900 antialiased">

        {/* ── Nav ──────────────────────────────────── */}
        <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b border-n-200">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 h-12 flex items-center justify-between gap-4">

            {/* Logo */}
            <a href="/" className="flex items-center gap-1.5 text-sm font-semibold text-n-900 flex-shrink-0">
              <img src="/icon.png" alt="Chrome Manual Maker" className="w-5 h-5 rounded" />
              Manual Maker
            </a>

            {/* Links — hidden on mobile */}
            <div className="hidden sm:flex items-center gap-1 text-sm text-n-700">
              <a href="/how-it-works" className="px-3 py-1.5 rounded-notion hover:bg-n-100 transition-colors">使い方</a>
              <a href="/pricing"       className="px-3 py-1.5 rounded-notion hover:bg-n-100 transition-colors">料金</a>
              <a href="/dashboard"     className="px-3 py-1.5 rounded-notion hover:bg-n-100 transition-colors">マイページ</a>
            </div>

            {/* CTA */}
            <a
              href="https://chrome.google.com/webstore"
              className="flex-shrink-0 inline-flex items-center gap-1.5 bg-brand text-white text-sm font-medium px-4 py-1.5 rounded-notion hover:bg-red-600 transition-colors shadow-notion"
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                <path d="M8 1.5a6.5 6.5 0 1 0 0 13A6.5 6.5 0 0 0 8 1.5zM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8z"/>
                <path d="M6.5 5.5v5l4-2.5-4-2.5z"/>
              </svg>
              無料で追加
            </a>
          </div>
        </nav>

        <main>{children}</main>

        {/* ── Footer ──────────────────────────────── */}
        <footer className="border-t border-n-200 mt-0 py-8 bg-n-50">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-n-500">
            <div className="flex items-center gap-1.5">
              <img src="/icon.png" alt="Chrome Manual Maker" className="w-4 h-4 rounded" />
              <span className="font-medium text-n-700">Chrome Manual Maker</span>
              <span>— © 2025</span>
            </div>
            <div className="flex gap-5">
              <a href="/privacy" className="hover:text-n-900 transition-colors">プライバシーポリシー</a>
              <a href="/terms"   className="hover:text-n-900 transition-colors">利用規約</a>
              <a href="mailto:support@s-tasklog.com" className="hover:text-n-900 transition-colors">お問い合わせ</a>
            </div>
          </div>
        </footer>

      </body>
    </html>
  );
}
