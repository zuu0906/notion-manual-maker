import { headers } from 'next/headers';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  metadataBase: new URL('https://chrome-manual-maker.s-tasklog.com'),
  title: {
    default: 'My Page | Chrome Manual Maker',
    template: '%s | Chrome Manual Maker',
  },
};

function detectLocale(): 'ja' | 'en' {
  const acceptLang = headers().get('accept-language') ?? '';
  return acceptLang.toLowerCase().includes('ja') ? 'ja' : 'en';
}

const NAV = {
  ja: { howItWorks: '使い方', pricing: '料金', myPage: 'マイページ', addForFree: '無料で追加' },
  en: { howItWorks: 'How It Works', pricing: 'Pricing', myPage: 'My Page', addForFree: 'Add for Free' },
} as const;

const FOOTER = {
  ja: { privacy: 'プライバシーポリシー', terms: '利用規約', contact: 'お問い合わせ' },
  en: { privacy: 'Privacy Policy', terms: 'Terms of Service', contact: 'Contact' },
} as const;

const STORE_URL = 'https://chrome.google.com/webstore';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const locale = detectLocale();
  const nav = NAV[locale];
  const footer = FOOTER[locale];

  return (
    <>
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b border-n-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-12 flex items-center justify-between gap-4">
          <a href={`/${locale}`} className="flex items-center gap-1.5 text-sm font-semibold text-n-900 flex-shrink-0">
            <img src="/icon.png" alt="Chrome Manual Maker" className="w-5 h-5 rounded" />
            Manual Maker
          </a>
          <div className="hidden sm:flex items-center gap-1 text-sm text-n-700">
            <a href={`/${locale}/how-it-works`} className="px-3 py-1.5 rounded-notion hover:bg-n-100 transition-colors">{nav.howItWorks}</a>
            <a href={`/${locale}/pricing`}       className="px-3 py-1.5 rounded-notion hover:bg-n-100 transition-colors">{nav.pricing}</a>
            <a href="/dashboard"                 className="px-3 py-1.5 rounded-notion hover:bg-n-100 transition-colors">{nav.myPage}</a>
          </div>
          <a
            href={STORE_URL}
            className="flex-shrink-0 inline-flex items-center gap-1.5 bg-brand text-white text-sm font-medium px-4 py-1.5 rounded-notion hover:bg-red-600 transition-colors shadow-notion"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M8 1.5a6.5 6.5 0 1 0 0 13A6.5 6.5 0 0 0 8 1.5zM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8z"/>
              <path d="M6.5 5.5v5l4-2.5-4-2.5z"/>
            </svg>
            {nav.addForFree}
          </a>
        </div>
      </nav>

      <main>{children}</main>

      <footer className="border-t border-n-200 mt-0 py-8 bg-n-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-n-500">
          <div className="flex items-center gap-1.5">
            <img src="/icon.png" alt="Chrome Manual Maker" className="w-4 h-4 rounded" />
            <span className="font-medium text-n-700">Chrome Manual Maker</span>
            <span>— © 2025</span>
          </div>
          <div className="flex gap-5">
            <a href={`/${locale}/privacy`} className="hover:text-n-900 transition-colors">{footer.privacy}</a>
            <a href={`/${locale}/terms`}   className="hover:text-n-900 transition-colors">{footer.terms}</a>
            <a href="mailto:support@s-tasklog.com" className="hover:text-n-900 transition-colors">{footer.contact}</a>
          </div>
        </div>
      </footer>
    </>
  );
}
