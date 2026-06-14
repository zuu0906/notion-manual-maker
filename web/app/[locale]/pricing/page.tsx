import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

const STORE_URL = 'https://chromewebstore.google.com/detail/notion-manual-maker/kapchgeffhkfffhflcpjjkiojneipicd';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pricing' });
  return {
    title: t('metaTitle'),
    description: t('metaDesc'),
    alternates: { canonical: `/${locale}/pricing` },
  };
}

export default async function PricingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: { upgraded?: string };
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'pricing' });

  const plans = t.raw('plans') as Array<{
    name: string; emoji: string; price: string; period: string;
    features: string[]; cta: string; highlight: boolean; external: boolean;
  }>;

  const upgraded = searchParams.upgraded === '1';

  return (
    <div className="lp-page">
      <section className="section" style={{ background: 'var(--bg-2)', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
        <div className="lp-container">

          {upgraded && (
            <div style={{
              marginBottom: 40, display: 'flex', alignItems: 'flex-start', gap: 14,
              background: 'color-mix(in oklab, var(--green) 12%, var(--paper))',
              border: '1px solid color-mix(in oklab, var(--green) 25%, transparent)',
              borderRadius: 'var(--radius-lg)', padding: '16px 20px',
            }}>
              <span style={{ fontSize: 24, flexShrink: 0 }}>🎉</span>
              <div>
                <p style={{ fontWeight: 600, color: 'oklch(0.35 0.10 155)', marginBottom: 4, fontSize: 14 }}>{t('upgraded.title')}</p>
                <p style={{ fontSize: 13, color: 'oklch(0.45 0.08 155)', margin: 0 }}>{t('upgraded.desc')}</p>
              </div>
            </div>
          )}

          <div className="eyebrow">
            <span className="dot" />
            {t('eyebrow')}
          </div>
          <h2 className="h2">{t('title')}</h2>
          <p className="section-lede">{t('sub')}</p>

          <div className="pricing">
            {plans.map((plan, i) => (
              <div key={i} className={`plan ${plan.highlight ? 'featured' : ''}`}>
                {plan.highlight && <span className="ribbon">{t('recommended')}</span>}
                <div className="name">{plan.emoji} {plan.name}</div>
                <div className="price">{plan.price}<small>{plan.period}</small></div>
                <ul>
                  {plan.features.map((f, j) => (
                    <li key={j}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M2.5 7.5L5.5 10.5L11.5 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  href={plan.external ? STORE_URL : '/dashboard'}
                  className={`btn btn-lg ${plan.highlight ? 'btn-primary' : 'btn-ghost'}`}
                  target={plan.external ? '_blank' : undefined}
                  rel={plan.external ? 'noopener noreferrer' : undefined}
                >
                  {plan.cta}
                </a>
              </div>
            ))}
          </div>

          <div style={{
            textAlign: 'center', marginTop: 24,
            fontFamily: 'var(--font-mono)', fontSize: 12,
            color: 'var(--ink-4)', letterSpacing: '.05em',
          }}>
            {t('note')}
          </div>
        </div>
      </section>
    </div>
  );
}
