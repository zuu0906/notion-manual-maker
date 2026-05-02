import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

const STORE_URL = 'https://chrome.google.com/webstore';

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
    <section className="max-w-3xl mx-auto px-4 py-20">
      <div className="text-center mb-14">
        <h1 className="text-3xl font-bold text-n-900 mb-4">{t('title')}</h1>
        <p className="text-n-500">{t('sub')}</p>
      </div>

      <div className="flex flex-col gap-14">
        {steps.map((step, i) => (
          <div key={i} className="flex gap-8">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-brand text-white font-bold text-lg flex items-center justify-center">
                {i + 1}
              </div>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-n-900 mb-2">{step.title}</h2>
              <p className="text-n-500 mb-4 leading-relaxed">{step.desc}</p>
              <ul className="flex flex-col gap-2">
                {step.detail.map((d, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm text-n-600">
                    <span className="text-brand font-bold mt-0.5">{j + 1}.</span>
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-16 text-center">
        <a
          href={STORE_URL}
          className="inline-flex items-center gap-2 bg-brand text-white font-semibold px-8 py-3.5 rounded-notion shadow-notion hover:bg-red-600 transition-colors text-sm"
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 flex-shrink-0">
            <path d="M8 1.5a6.5 6.5 0 1 0 0 13A6.5 6.5 0 0 0 8 1.5zM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8z"/>
            <path d="M6.5 5.5v5l4-2.5-4-2.5z"/>
          </svg>
          {t('cta')}
        </a>
      </div>
    </section>
  );
}
