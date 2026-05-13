import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

const STORE_URL = 'https://chromewebstore.google.com/detail/kapchgeffhkfffhflcpjjkiojneipicd';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'howItWorks' });
  return {
    title: t('metaTitle'),
    description: t('metaDesc'),
    alternates: { canonical: `/${locale}/how-it-works` },
  };
}

export default async function HowItWorksPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'howItWorks' });

  const steps = t.raw('steps') as Array<{
    title: string; desc: string; detail: string[];
  }>;

  return (
    <div className="lp-page">
      <section className="section" style={{ background: 'var(--bg-2)', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
        <div className="lp-container">
          <div className="eyebrow">
            <span className="dot" />
            {locale === 'ja' ? '使い方' : 'How It Works'}
          </div>
          <h2 className="h2">{t('title')}</h2>
          <p className="section-lede">{t('sub')}</p>

          <div className="steps">
            {steps.map((step, i) => (
              <div key={i} className="step">
                <div className="num-lg">STEP {String(i + 1).padStart(2, '0')}</div>
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
                <div className="visual">
                  <div className="svgrid" />
                  <div style={{ position: 'absolute', inset: 0, padding: '14px 16px', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {step.detail.map((d, j) => (
                      <div key={j} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <span style={{
                          fontFamily: 'var(--font-mono)', fontSize: 9.5,
                          color: 'var(--accent-ink)', fontWeight: 600,
                          background: 'var(--accent-soft)', borderRadius: 4,
                          padding: '1px 5px', flexShrink: 0, marginTop: 1,
                        }}>{j + 1}</span>
                        <span style={{ fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.45 }}>{d}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: 56 }}>
            <a
              href={STORE_URL}
              className="btn btn-lg btn-primary"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('cta')}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
