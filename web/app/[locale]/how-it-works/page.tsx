import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

const STORE_URL = 'https://chromewebstore.google.com/detail/kapchgeffhkfffhflcpjjkiojneipicd';
const DESKTOP_URL = 'https://github.com/zuu0906/notion-manual-maker/releases/latest/download/Notion-Manual-Maker-Setup-1.0.0.exe';

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

function StepList({ steps }: { steps: Array<{ title: string; desc: string; detail: string[] }> }) {
  return (
    <div className="steps">
      {steps.map((step, i) => (
        <div key={i} className="step">
          <div className="num-lg">STEP {String(i + 1).padStart(2, '0')}</div>
          <h3>{step.title}</h3>
          <p>{step.desc}</p>
          <div className="visual" style={{ height: 'auto', overflow: 'visible', minHeight: 80 }}>
            <div className="svgrid" />
            <div style={{ position: 'relative', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 7 }}>
              {step.detail.map((d, j) => (
                <div key={j} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 9.5,
                    color: 'var(--accent-ink)', fontWeight: 600,
                    background: 'var(--accent-soft)', borderRadius: 4,
                    padding: '1px 5px', flexShrink: 0, marginTop: 1,
                  }}>{j + 1}</span>
                  <span style={{ fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.5 }}>{d}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function HowItWorksPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'howItWorks' });

  const steps = t.raw('steps') as Array<{ title: string; desc: string; detail: string[] }>;
  const desktopApp = t.raw('desktopApp') as {
    tag: string; title: string; sub: string;
    steps: Array<{ title: string; desc: string; detail: string[] }>;
    cta: string;
  };

  return (
    <div className="lp-page">

      {/* Chrome Extension */}
      <section className="section" style={{ background: 'var(--bg-2)', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
        <div className="lp-container">
          <div className="eyebrow">
            <span className="dot" />
            {locale === 'ja' ? 'Chrome拡張機能' : 'Chrome Extension'}
          </div>
          <h2 className="h2">{t('title')}</h2>
          <p className="section-lede">{t('sub')}</p>

          <StepList steps={steps} />

          <div style={{ textAlign: 'center', marginTop: 56 }}>
            <a href={STORE_URL} className="btn btn-lg btn-primary" target="_blank" rel="noopener noreferrer">
              {t('cta')}
            </a>
          </div>
        </div>
      </section>

      {/* Desktop App */}
      <section className="section" id="desktop-how" style={{ borderTop: '1px solid var(--line)' }}>
        <div className="lp-container">
          <div className="eyebrow">
            <span className="dot" />
            {desktopApp.tag}
          </div>
          <h2 className="h2">{desktopApp.title}</h2>
          <p className="section-lede">{desktopApp.sub}</p>

          <StepList steps={desktopApp.steps} />

          <div style={{ textAlign: 'center', marginTop: 56 }}>
            <a href={DESKTOP_URL} className="btn btn-lg btn-primary" target="_blank" rel="noopener noreferrer">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ marginRight: 2 }}>
                <rect x="1" y="2" width="12" height="8" rx="1" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M4 12h6M7 10v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              {desktopApp.cta}
            </a>
          </div>
        </div>
      </section>

    </div>
  );
}
