import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'アップグレード完了',
  alternates: { canonical: '/success' },
};

export default function SuccessPage() {
  return (
    <section className="max-w-xl mx-auto px-4 py-32 text-center">
      <div className="text-5xl mb-6">🎉</div>
      <h1 className="text-2xl font-bold mb-4">ご購入ありがとうございます！</h1>
      <p className="text-gray-500 mb-8 leading-relaxed">14日間の無料トライアルが開始されました。</p>

      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 mb-8 text-left">
        <p className="text-sm font-semibold text-gray-700 mb-4">次のステップ</p>
        <ol className="space-y-3 text-sm text-gray-600 list-none">
          <li className="flex items-start gap-3">
            <span className="bg-brand text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">1</span>
            Chrome の拡張機能アイコンをクリックしてポップアップを開く
          </li>
          <li className="flex items-start gap-3">
            <span className="bg-brand text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">2</span>
            Google アカウントでログイン
          </li>
          <li className="flex items-start gap-3">
            <span className="bg-brand text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">3</span>
            プランが自動で反映されます
          </li>
        </ol>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <a
          href="/dashboard"
          className="inline-block bg-brand text-white px-8 py-3 rounded-full font-semibold text-sm hover:opacity-90 transition"
        >
          マイページで確認する
        </a>
        <a
          href="https://billing.stripe.com/p/login/28EbIT8sHfD0bk70vS5gc00"
          className="inline-block bg-gray-100 text-gray-700 px-8 py-3 rounded-full font-semibold text-sm hover:bg-gray-200 transition"
          target="_blank"
          rel="noopener noreferrer"
        >
          プラン管理・解約
        </a>
      </div>
    </section>
  );
}
