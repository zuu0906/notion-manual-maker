import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '../../i18n/routing';
import '../lp.css';

const STORE_URL = 'https://chromewebstore.google.com/detail/notion-manual-maker/kapchgeffhkfffhflcpjjkiojneipicd';

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
      template: '%s | Notion Manual Maker',
    },
    description: t('description'),
    keywords: locale === 'ja'
      ? ['Chrome拡張機能', 'Notion連携', 'マニュアル作成', '手順書', 'スクリーンショット', '操作マニュアル', 'Webマニュアル自動作成', '業務効率化']
      : ['Chrome extension', 'Notion integration', 'manual creation', 'SOPs', 'screenshots', 'operation manuals', 'workflow automation'],
    openGraph: {
      type: 'website',
      locale: t('ogLocale'),
      siteName: 'Notion Manual Maker',
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

  const otherLocale = locale === 'ja' ? 'en' : 'ja';

  return (
    <>
      {/* ── Nav ── */}
      <nav className="lp-nav">
        <div className="lp-container nav-inner">
          <a href={`/${locale}`} className="brand">
            <img src="/icon.png" alt="" width={26} height={26} style={{ borderRadius: 7 }} />
            <span>Notion Manual Maker</span>
          </a>

          <div className="nav-links">
            <a href={`/${locale}/how-it-works`}>{t('howItWorks')}</a>
            <a href={`/${locale}/pricing`}>{t('pricing')}</a>
            <a href="/dashboard">{t('myPage')}</a>
          </div>

          <div className="nav-right">
            <div className="lang">
              <a href={`/ja`} className={locale === 'ja' ? 'active' : ''}>JP</a>
              <a href={`/en`} className={locale === 'en' ? 'active' : ''}>EN</a>
            </div>
            <a href={STORE_URL} className="btn btn-primary" target="_blank" rel="noopener noreferrer">
              {t('addForFree')}
            </a>
          </div>
        </div>
      </nav>

      <main>{children}</main>

      {/* ── Footer ── */}
      <footer className="lp-footer">
        <div className="lp-container footer-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/icon.png" alt="" width={32} height={32} style={{ borderRadius: 8 }} />
            <div>
              <div style={{ color: 'var(--ink)', fontWeight: 600, fontSize: 14 }}>Notion Manual Maker</div>
              <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 2 }}>
                {locale === 'ja' ? 'クリックするだけで、操作マニュアルを自動生成。' : 'Click your way to a finished manual.'}
              </div>
            </div>
          </div>
          <div className="footer-links">
            <a href={`/${locale}/privacy`}>{tFooter('privacy')}</a>
            <a href={`/${locale}/terms`}>{tFooter('terms')}</a>
            <a href="mailto:support@s-tasklog.com">{tFooter('contact')}</a>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-4)' }}>© 2026 Notion Manual Maker</div>
        </div>
      </footer>
    </>
  );
}
