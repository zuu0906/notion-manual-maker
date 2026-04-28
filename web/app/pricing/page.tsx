import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '料金プラン',
  description: 'Chrome Manual Makerの料金プラン。無料プランから始めて、必要に応じてProにアップグレード。',
  alternates: { canonical: '/pricing' },
};

const plans = [
  {
    name: 'Free',
    emoji: '🌱',
    price: '¥0',
    period: '永久無料',
    features: [
      'スクショ 20枚/月',
      'Notionワークスペース 1つ',
      'ステップ番号・矢印アノテーション',
      'ウォーターマーク付き',
    ],
    cta: '無料で始める',
    href: 'https://chrome.google.com/webstore',
    highlight: false,
    external: true,
  },
  {
    name: 'Standard',
    emoji: '⚡',
    price: '¥500',
    period: '/月',
    features: [
      'スクショ 無制限',
      'Notionワークスペース 1つ',
      'AI説明文自動生成 100回/月',
      'PDFエクスポート',
      'ウォーターマークなし',
    ],
    cta: 'マイページからアップグレード',
    href: '/dashboard',
    highlight: false,
    external: false,
  },
  {
    name: 'Pro',
    emoji: '🚀',
    price: '¥1,200',
    period: '/月',
    features: [
      'スクショ 無制限',
      'Notionワークスペース 3つ',
      'AI説明文自動生成 500回/月',
      'PDFエクスポート',
      'ウォーターマークなし',
    ],
    cta: 'マイページからアップグレード',
    href: '/dashboard',
    highlight: true,
    external: false,
  },
];

export default function PricingPage({ searchParams }: { searchParams: { upgraded?: string } }) {
  const upgraded = searchParams.upgraded === '1';

  return (
    <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-20">

      {upgraded && (
        <div className="mb-10 flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl p-5">
          <span className="text-2xl flex-shrink-0">🎉</span>
          <div>
            <p className="font-semibold text-green-800 mb-0.5">アップグレードが完了しました</p>
            <p className="text-sm text-green-700">
              拡張機能のポップアップを一度閉じて再度開くと、新しいプランが反映されます。
            </p>
          </div>
        </div>
      )}

      <div className="text-center mb-14">
        <p className="text-xs font-medium text-brand uppercase tracking-widest mb-3">Pricing</p>
        <h1 className="text-2xl sm:text-3xl font-bold text-n-900 mb-3">シンプルな料金プラン</h1>
        <p className="text-n-500 text-sm">まず無料で試して、チームの規模に合わせてアップグレード</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`flex flex-col rounded-xl border p-6 relative transition-shadow hover:shadow-notion-md ${
              plan.highlight
                ? 'border-brand/40 bg-brand/[0.02] shadow-notion'
                : 'border-n-200 bg-white'
            }`}
          >
            {plan.highlight && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand text-white text-[10px] font-bold px-3 py-1 rounded-full tracking-wide">
                おすすめ
              </div>
            )}

            <div className="mb-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{plan.emoji}</span>
                <span className="text-sm font-semibold text-n-700">{plan.name}</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-n-900 tracking-tight">{plan.price}</span>
                <span className="text-xs text-n-500">{plan.period}</span>
              </div>
            </div>

            <ul className="space-y-2 flex-1 mb-6">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-xs text-n-700">
                  <span className="text-brand mt-0.5 flex-shrink-0">✓</span>
                  {f}
                </li>
              ))}
            </ul>

            <div>
              <a
                href={plan.href}
                className={`block text-center text-sm font-semibold py-2.5 rounded-notion transition-colors ${
                  plan.highlight
                    ? 'bg-brand text-white hover:bg-red-600 shadow-notion'
                    : 'bg-n-50 text-n-700 border border-n-200 hover:bg-n-100'
                }`}
                target={plan.external ? '_blank' : undefined}
                rel={plan.external ? 'noopener noreferrer' : undefined}
              >
                {plan.cta}
              </a>
            </div>
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-n-400 mt-8">
        14日間無料トライアル · いつでもキャンセル可能 · 日割り計算
      </p>
    </section>
  );
}
