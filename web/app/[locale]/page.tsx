import { getTranslations, setRequestLocale } from 'next-intl/server';

const STORE_URL = 'https://chrome.google.com/webstore';

type MockupStep = { title: string; ai: string };

function NotionPageMockup({
  pageTitle, pageSlug, generated, addBlock, steps,
}: {
  pageTitle: string; pageSlug: string; generated: string; addBlock: string; steps: MockupStep[];
}) {
  return (
    <div className="w-full max-w-md bg-white border border-n-200 rounded-xl shadow-notion-lg overflow-hidden text-left">
      <div className="bg-n-50 border-b border-n-200 px-4 py-2.5 flex items-center gap-3">
        <div className="flex gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#FF5F56]" />
          <span className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
          <span className="w-3 h-3 rounded-full bg-[#27C93F]" />
        </div>
        <div className="flex-1 bg-white border border-n-200 rounded text-xs text-n-500 px-3 py-0.5 text-center truncate">
          {pageSlug}
        </div>
      </div>
      <div className="px-8 py-6">
        <div className="text-4xl mb-2">📋</div>
        <h3 className="text-2xl font-bold text-n-900 mb-1 leading-tight">{pageTitle}</h3>
        <p className="text-xs text-n-500 mb-5">{generated} · 2025/4/25</p>
        <div className="border-t border-n-200 mb-5" />
        <div className="space-y-4">
          {steps.map((s, i) => (
            <div key={i} className="flex gap-3">
              <div className="w-6 h-6 rounded bg-brand text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="h-10 bg-n-100 rounded-notion mb-1.5 flex items-center px-3 gap-2 overflow-hidden">
                  <div className="w-14 h-5 bg-n-300 rounded flex-shrink-0" />
                  <div className="flex-1 h-2.5 bg-n-200 rounded" />
                </div>
                <p className="text-xs font-semibold text-n-900 truncate">{s.title}</p>
                <p className="text-xs text-n-500 mt-0.5 flex items-center gap-1">
                  <span>🤖</span>{s.ai}
                </p>
              </div>
            </div>
          ))}
          <div className="flex items-center gap-1.5 text-xs text-n-300 hover:text-n-500 cursor-pointer pt-1">
            <span className="text-base leading-none">+</span>
            <span>{addBlock}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'landing' });
  const tMeta = await getTranslations({ locale, namespace: 'meta' });

  const stats          = t.raw('stats')           as Array<{ n: string; label: string }>;
  const pains          = t.raw('pain.items')       as Array<{ icon: string; text: string }>;
  const hiSteps        = t.raw('howItWorks.steps') as Array<{ icon: string; title: string; desc: string }>;
  const beforeItems    = t.raw('beforeAfter.before.items') as string[];
  const afterItems     = t.raw('beforeAfter.after.items')  as string[];
  const features       = t.raw('features.items')   as Array<{ icon: string; title: string; desc: string }>;
  const pricingPlans   = t.raw('pricing.plans')    as Array<{
    name: string; emoji: string; price: string; period: string;
    features: string[]; cta: string; highlight: boolean; external: boolean;
  }>;
  const faqs           = t.raw('faq.items')        as Array<{ q: string; a: string }>;
  const mockupSteps    = t.raw('mockup.steps')     as MockupStep[];

  return (
    <>
      {/* ═══ HERO ═══════════════════════════════════════════════════ */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-12 sm:pb-20">
        <div className="anim-fade-up anim-d1 flex justify-center mb-6">
          <span className="inline-flex items-center gap-1.5 bg-n-50 border border-n-200 text-n-700 text-xs font-medium px-3 py-1 rounded-full">
            <span>🔗</span>
            {t('badge')}
          </span>
        </div>

        <h1 className="anim-fade-up anim-d2 text-center text-4xl sm:text-5xl lg:text-6xl font-bold text-n-900 leading-tight tracking-tight mb-5">
          {t('hero.headline1')}<br className="hidden sm:block" />
          <span className="text-brand">{t('hero.headline2')}</span>{t('hero.headline3')}
        </h1>

        <p className="anim-fade-up anim-d3 text-center text-n-500 text-base sm:text-lg max-w-xl mx-auto leading-relaxed mb-8">
          {t('hero.sub')}<br className="hidden sm:block" />
          <span className="font-semibold text-n-900">{t('hero.subHighlight')}</span>
          {t('hero.subSuffix')}
        </p>

        <div className="anim-fade-up anim-d4 flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href={STORE_URL}
            className="inline-flex items-center justify-center gap-2 bg-brand text-white font-semibold text-sm px-6 py-3 rounded-notion shadow-notion hover:bg-red-600 transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 flex-shrink-0">
              <path d="M8 1.5a6.5 6.5 0 1 0 0 13A6.5 6.5 0 0 0 8 1.5zM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8z"/>
              <path d="M6.5 5.5v5l4-2.5-4-2.5z"/>
            </svg>
            {t('hero.ctaPrimary')}
          </a>
          <a
            href={`/${locale}/how-it-works`}
            className="inline-flex items-center justify-center gap-1 bg-white text-n-700 font-medium text-sm px-6 py-3 rounded-notion border border-n-200 hover:bg-n-50 hover:border-n-300 transition-colors"
          >
            {t('hero.ctaSecondary')}
            <span className="text-n-400">→</span>
          </a>
        </div>

        <p className="anim-fade-up anim-d5 text-center text-xs text-n-400 mt-4">
          {t('hero.freeNote')}
        </p>

        <div className="anim-fade-up anim-d5 flex justify-center mt-14 sm:mt-16">
          <NotionPageMockup
            pageTitle={t('mockup.pageTitle')}
            pageSlug={t('mockup.pageSlug')}
            generated={t('mockup.generated')}
            addBlock={t('mockup.addBlock')}
            steps={mockupSteps}
          />
        </div>
      </section>

      {/* ═══ STATS ══════════════════════════════════════════════════ */}
      <div className="border-y border-n-200 bg-n-50 py-6">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 grid grid-cols-3 divide-x divide-n-200">
          {stats.map((s) => (
            <div key={s.label} className="text-center px-4 py-2">
              <div className="text-2xl sm:text-3xl font-bold text-n-900 tracking-tight">{s.n}</div>
              <div className="text-xs text-n-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ PAIN ═══════════════════════════════════════════════════ */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-20 sm:py-24">
        <div className="reveal text-center mb-12">
          <p className="text-xs font-medium text-brand uppercase tracking-widest mb-3">{t('pain.eyebrow')}</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-n-900 mb-3">{t('pain.title')}</h2>
          <p className="text-n-500 text-sm sm:text-base">{t('pain.sub')}</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-3 reveal">
          {pains.map((p) => (
            <div key={p.text} className="flex items-start gap-4 bg-n-50 border border-n-200 rounded-xl p-5 hover:shadow-notion transition-shadow">
              <span className="text-2xl flex-shrink-0">{p.icon}</span>
              <p className="text-n-700 text-sm leading-relaxed">{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══════════════════════════════════════════ */}
      <section className="bg-n-50 border-y border-n-200 py-20 sm:py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="reveal text-center mb-14">
            <p className="text-xs font-medium text-brand uppercase tracking-widest mb-3">{t('howItWorks.eyebrow')}</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-n-900 mb-3">{t('howItWorks.title')}</h2>
            <p className="text-n-500 text-sm sm:text-base">{t('howItWorks.sub')}</p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6 sm:gap-8">
            {hiSteps.map((s, i) => (
              <div key={i} className="reveal relative">
                {i < hiSteps.length - 1 && (
                  <div className="hidden sm:block absolute top-6 left-[calc(50%+2.5rem)] w-[calc(100%-5rem)] h-px bg-n-200 z-0" />
                )}
                <div className="relative z-10 text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-white border border-n-200 shadow-notion text-2xl mb-4">
                    {s.icon}
                  </div>
                  <div className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand text-white text-[10px] font-bold ml-1 mb-4 -mt-4 align-top">
                    {i + 1}
                  </div>
                  <h3 className="font-semibold text-n-900 mb-2">{s.title}</h3>
                  <p className="text-sm text-n-500 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-10 reveal">
            <a href={`/${locale}/how-it-works`} className="text-sm text-brand font-medium hover:underline">
              {t('howItWorks.detailLink')}
            </a>
          </div>
        </div>
      </section>

      {/* ═══ BEFORE / AFTER ═════════════════════════════════════════ */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-20 sm:py-24">
        <div className="reveal text-center mb-12">
          <p className="text-xs font-medium text-brand uppercase tracking-widest mb-3">{t('beforeAfter.eyebrow')}</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-n-900">{t('beforeAfter.title')}</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-4 reveal">
          <div className="border border-n-200 rounded-xl p-6 sm:p-8">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-n-500 bg-n-100 px-2.5 py-1 rounded-full mb-6">
              <span>😩</span> {t('beforeAfter.before.label')}
            </div>
            <ul className="space-y-3">
              {beforeItems.map((text) => (
                <li key={text} className="flex items-start gap-2.5 text-sm text-n-700">
                  <span className="text-n-300 mt-0.5 flex-shrink-0">✕</span>
                  {text}
                </li>
              ))}
            </ul>
          </div>
          <div className="border-2 border-brand/30 bg-brand/[0.02] rounded-xl p-6 sm:p-8">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand bg-brand/10 px-2.5 py-1 rounded-full mb-6">
              <span>✨</span> {t('beforeAfter.after.label')}
            </div>
            <ul className="space-y-3">
              {afterItems.map((text) => (
                <li key={text} className="flex items-start gap-2.5 text-sm font-medium text-n-900">
                  <span className="text-brand mt-0.5 flex-shrink-0">✓</span>
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ═══ FEATURES ═══════════════════════════════════════════════ */}
      <section className="bg-n-50 border-y border-n-200 py-20 sm:py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="reveal text-center mb-14">
            <p className="text-xs font-medium text-brand uppercase tracking-widest mb-3">{t('features.eyebrow')}</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-n-900">{t('features.title')}</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {features.map((f) => (
              <div key={f.title} className="reveal bg-white border border-n-200 rounded-xl p-5 sm:p-6 hover:shadow-notion-md hover:border-n-300 transition-all">
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-semibold text-n-900 mb-1.5 text-sm">{f.title}</h3>
                <p className="text-xs text-n-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PRICING ════════════════════════════════════════════════ */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-20 sm:py-24">
        <div className="reveal text-center mb-14">
          <p className="text-xs font-medium text-brand uppercase tracking-widest mb-3">{t('pricing.eyebrow')}</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-n-900 mb-3">{t('pricing.title')}</h2>
          <p className="text-n-500 text-sm">{t('pricing.sub')}</p>
        </div>
        <div className="grid sm:grid-cols-3 gap-4 sm:gap-5">
          {pricingPlans.map((plan) => (
            <div
              key={plan.name}
              className={`reveal flex flex-col rounded-xl border p-6 sm:p-8 relative transition-shadow hover:shadow-notion-md ${
                plan.highlight ? 'border-brand/40 bg-brand/[0.02] shadow-notion' : 'border-n-200 bg-white'
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand text-white text-[10px] font-bold px-3 py-1 rounded-full tracking-wide">
                  {t('pricing.recommended')}
                </div>
              )}
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{plan.emoji}</span>
                  <span className="text-sm font-semibold text-n-700">{plan.name}</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-n-900 tracking-tight">{plan.price}</span>
                  <span className="text-sm text-n-500">{plan.period}</span>
                </div>
              </div>
              <ul className="space-y-2 mb-7 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-n-700">
                    <span className="text-brand flex-shrink-0">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href={plan.external ? STORE_URL : '/dashboard'}
                target={plan.external ? '_blank' : undefined}
                rel={plan.external ? 'noopener noreferrer' : undefined}
                className={`block text-center text-sm font-semibold py-2.5 rounded-notion transition-colors ${
                  plan.highlight
                    ? 'bg-brand text-white hover:bg-red-600 shadow-notion'
                    : 'bg-n-50 text-n-700 border border-n-200 hover:bg-n-100'
                }`}
              >
                {plan.cta}
              </a>
            </div>
          ))}
        </div>
        <div className="reveal text-center mt-6 space-y-1">
          <p className="text-xs text-n-400">{t('pricing.note')}</p>
          <a href={`/${locale}/pricing`} className="text-xs text-brand hover:underline">
            {t('pricing.compareLink')}
          </a>
        </div>
      </section>

      {/* ═══ FAQ ════════════════════════════════════════════════════ */}
      <section className="bg-n-50 border-y border-n-200 py-20 sm:py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="reveal text-center mb-12">
            <p className="text-xs font-medium text-brand uppercase tracking-widest mb-3">{t('faq.eyebrow')}</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-n-900">{t('faq.title')}</h2>
          </div>
          <div className="space-y-2 reveal">
            {faqs.map((faq) => (
              <details key={faq.q} className="group bg-white border border-n-200 rounded-xl overflow-hidden hover:border-n-300 transition-colors">
                <summary className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer font-medium text-sm text-n-900 select-none">
                  <span>{faq.q}</span>
                  <span className="text-n-400 group-open:rotate-45 transition-transform duration-200 flex-shrink-0 text-lg leading-none">+</span>
                </summary>
                <div className="px-5 pb-5 border-t border-n-100">
                  <p className="text-sm text-n-500 leading-relaxed pt-3">{faq.a}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA ════════════════════════════════════════════════════ */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-20 sm:py-28 text-center">
        <div className="reveal max-w-xl mx-auto">
          <div className="text-5xl mb-5">🚀</div>
          <h2 className="text-2xl sm:text-3xl font-bold text-n-900 mb-3">{t('cta.title')}</h2>
          <p className="text-n-500 mb-2">{t('cta.sub')}</p>
          <p className="text-xs text-n-400 mb-8">{t('cta.trial')}</p>
          <a
            href={STORE_URL}
            className="inline-flex items-center gap-2 bg-brand text-white font-semibold px-8 py-3.5 rounded-notion shadow-notion-md hover:bg-red-600 transition-colors text-sm"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 flex-shrink-0">
              <path d="M8 1.5a6.5 6.5 0 1 0 0 13A6.5 6.5 0 0 0 8 1.5zM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8z"/>
              <path d="M6.5 5.5v5l4-2.5-4-2.5z"/>
            </svg>
            {t('cta.btn')}
          </a>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'Chrome Manual Maker',
            applicationCategory: 'BrowserApplication',
            operatingSystem: 'Chrome',
            offers: [
              { '@type': 'Offer', price: '0',    priceCurrency: 'JPY', name: 'Free' },
              { '@type': 'Offer', price: '500',  priceCurrency: 'JPY', name: 'Standard' },
              { '@type': 'Offer', price: '1200', priceCurrency: 'JPY', name: 'Pro' },
            ],
            description: tMeta('description'),
          }),
        }}
      />
    </>
  );
}
