import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import PlanVerifier from './PlanVerifier';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'success' });
  return {
    title: t('metaTitle'),
    alternates: { canonical: `/${locale}/success` },
  };
}

const STRIPE_PORTAL_URL = 'https://billing.stripe.com/p/login/28EbIT8sHfD0bk70vS5gc00';

export default async function SuccessPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'success' });

  return (
    <section className="max-w-xl mx-auto px-4 py-32 text-center">
      <div className="text-5xl mb-6">🎉</div>
      <h1 className="text-2xl font-bold mb-4">{t('title')}</h1>
      <Suspense>
        <PlanVerifier />
      </Suspense>
      <p className="text-gray-500 mb-8 leading-relaxed">{t('desc')}</p>

      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 mb-8 text-left">
        <p className="text-sm font-semibold text-gray-700 mb-4">{t('nextStepsTitle')}</p>
        <ol className="space-y-3 text-sm text-gray-600 list-none">
          {(['step1', 'step2', 'step3'] as const).map((key, i) => (
            <li key={key} className="flex items-start gap-3">
              <span className="bg-brand text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                {i + 1}
              </span>
              {t(key)}
            </li>
          ))}
        </ol>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <a
          href="/dashboard"
          className="inline-block bg-brand text-white px-8 py-3 rounded-full font-semibold text-sm hover:opacity-90 transition"
        >
          {t('goToDashboard')}
        </a>
        <a
          href={STRIPE_PORTAL_URL}
          className="inline-block bg-gray-100 text-gray-700 px-8 py-3 rounded-full font-semibold text-sm hover:bg-gray-200 transition"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('manageSubscription')}
        </a>
      </div>
    </section>
  );
}
