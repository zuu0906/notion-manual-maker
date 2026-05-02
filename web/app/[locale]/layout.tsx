import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '../../i18n/routing';

const STORE_URL = 'https://chrome.google.com/webstore';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });
  return {
    title: {
      default: t('title'),
      template: '%s | Chrome Manual Maker',
    },
    description: t('description'),
    keywords: locale === 'ja'
      ? ['Chrome拡張機能', 'Notion連携', 'マニュアル作成', '手順書', 'スクリーンショット', '操作マニュアル', 'Webマニュアル自動作成', '業務効率化']
      : ['Chrome extension', 'Notion integration', 'manual creation', 'SOPs', 'screenshots', 'operation manuals', 'workflow automation'],
    openGraph: {
      type: 'website',
      locale: t('ogLocale'),
      siteName: 'Chrome Manual Maker',
      images: [{ url: '/og.svg', width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image' },
    alternates: {
      canonical: `/${locale}`,
      languages: { ja: '/ja', en: '/en' },
    },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as 'ja' | 'en')) {
    notFound();
  }

  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'nav' });
  const tFooter = await getTranslations({ locale, namespace: 'footer' });
  const tLang = await getTranslations({ locale, namespace: 'langSwitch' });

  const otherLocale = locale === 'ja' ? 'en' : 'ja';

  return (
    <>
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b border-n-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-12 flex items-center justify-between gap-4">
          {/* Logo */}
          <a href={`/${locale}`} className="flex items-center gap-1.5 text-sm font-semibold text-n-900 flex-shrink-0">
            <img src="/icon.png" alt="Chrome Manual Maker" className="w-5 h-5 rounded" />
            Manual Maker
          </a>

          {/* Links */}
          <div className="hidden sm:flex items-center gap-1 text-sm text-n-700">
            <a href={`/${locale}/how-it-works`} className="px-3 py-1.5 rounded-notion hover:bg-n-100 transition-colors">{t('howItWorks')}</a>
            <a href={`/${locale}/pricing`}       className="px-3 py-1.5 rounded-notion hover:bg-n-100 transition-colors">{t('pricing')}</a>
            <a href="/dashboard"                 className="px-3 py-1.5 rounded-notion hover:bg-n-100 transition-colors">{t('myPage')}</a>
          </div>

          {/* Right: lang switcher + CTA */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="flex items-center gap-1 text-xs text-n-500">
              <a
                href={`/ja`}
                className={`px-1.5 py-0.5 rounded transition-colors ${locale === 'ja' ? 'font-bold text-n-900' : 'hover:text-n-700'}`}
              >
                {tLang('ja')}
              </a>
              <span>/</span>
              <a
                href={`/en`}
                className={`px-1.5 py-0.5 rounded transition-colors ${locale === 'en' ? 'font-bold text-n-900' : 'hover:text-n-700'}`}
              >
                {tLang('en')}
              </a>
            </div>
            <a
              href={STORE_URL}
              className="inline-flex items-center gap-1.5 bg-brand text-white text-sm font-medium px-4 py-1.5 rounded-notion hover:bg-red-600 transition-colors shadow-notion"
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                <path d="M8 1.5a6.5 6.5 0 1 0 0 13A6.5 6.5 0 0 0 8 1.5zM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8z"/>
                <path d="M6.5 5.5v5l4-2.5-4-2.5z"/>
              </svg>
              {t('addForFree')}
            </a>
          </div>
        </div>
      </nav>

      <main>{children}</main>

      {/* ── Footer ── */}
      <footer className="border-t border-n-200 mt-0 py-8 bg-n-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-n-500">
          <div className="flex items-center gap-1.5">
            <img src="/icon.png" alt="Chrome Manual Maker" className="w-4 h-4 rounded" />
            <span className="font-medium text-n-700">Chrome Manual Maker</span>
            <span>— © 2025</span>
          </div>
          <div className="flex gap-5">
            <a href="/privacy" className="hover:text-n-900 transition-colors">{tFooter('privacy')}</a>
            <a href="/terms"   className="hover:text-n-900 transition-colors">{tFooter('terms')}</a>
            <a href="mailto:support@s-tasklog.com" className="hover:text-n-900 transition-colors">{tFooter('contact')}</a>
          </div>
        </div>
      </footer>
    </>
  );
}
