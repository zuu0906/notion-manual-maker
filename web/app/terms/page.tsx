import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '利用規約',
  description: 'Chrome Manual Makerの利用規約。サービスの利用条件・課金・免責事項について説明します。',
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return (
    <section className="max-w-3xl mx-auto px-4 py-20">
      <h1 className="text-2xl font-bold mb-2">利用規約</h1>
      <p className="text-sm text-gray-400 mb-12">最終更新日：2026年4月26日</p>

      <div className="flex flex-col gap-10 text-sm text-gray-700 leading-relaxed">

        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">第1条（適用）</h2>
          <p>
            本利用規約（以下「本規約」）は、Chrome Manual Maker（以下「本サービス」）の運営者（以下「運営者」）と、
            本サービスを利用するユーザー（以下「ユーザー」）との間の権利義務関係を定めるものです。
            本サービスを利用した時点で、本規約に同意したものとみなします。
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">第2条（サービスの内容）</h2>
          <p>
            本サービスは、Webブラウザ上の操作をスクリーンショット・アノテーション付きでNotionへ自動保存するChrome拡張機能です。
            個人・法人を問わずご利用いただけます。
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">第3条（禁止事項）</h2>
          <p>ユーザーは以下の行為を行ってはなりません。</p>
          <ul className="mt-2 flex flex-col gap-2 list-disc list-inside text-gray-600">
            <li>法令または公序良俗に違反する行為</li>
            <li>第三者の知的財産権・プライバシー・名誉を侵害する行為</li>
            <li>本サービスのリバースエンジニアリング・改ざん・不正利用</li>
            <li>スパム・フィッシング等の迷惑行為</li>
            <li>運営者または第三者のサーバー・ネットワークに過度な負荷をかける行為</li>
          </ul>
        </div>

        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">第4条（プランと課金）</h2>
          <ul className="flex flex-col gap-2 list-disc list-inside text-gray-600">
            <li>有料プラン（Standard ¥500/月・Pro ¥1,200/月）はStripeを通じて月次請求されます。</li>
            <li>いつでもキャンセル可能です。キャンセル後は当月末まで有料プランをご利用いただけます。翌月以降はFreeプランに移行します。</li>
            <li>購入後7日以内であれば返金対応いたします。support@s-tasklog.com までご連絡ください。</li>
            <li>プランの変更（アップグレード・ダウングレード）は即時反映され、差額は日割りで精算されます。</li>
          </ul>
        </div>

        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">第5条（知的財産権）</h2>
          <p>
            本サービスのコード・デザイン・ロゴ等の知的財産権は運営者に帰属します。
            ユーザーが作成したスクリーンショット・マニュアルの権利はユーザー自身に帰属します。
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">第6条（免責事項）</h2>
          <ul className="flex flex-col gap-2 list-disc list-inside text-gray-600">
            <li>本サービスの利用によって生じた損害について、運営者は一切の責任を負いません。</li>
            <li>Notion API・Stripe API・Google APIなど外部サービスの仕様変更・障害によりサービスが影響を受ける場合があります。</li>
            <li>サービスの継続的な提供を保証するものではありません。</li>
            <li>本サービスが生成するAI説明文の正確性を保証するものではありません。</li>
          </ul>
        </div>

        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">第7条（サービスの変更・停止）</h2>
          <p>
            運営者は、ユーザーへの事前通知なく本サービスの内容を変更・停止することがあります。
            これによってユーザーに生じた損害について運営者は責任を負いません。
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">第8条（規約の変更）</h2>
          <p>
            本規約は必要に応じて変更することがあります。
            重要な変更がある場合はサービス内またはメールでお知らせします。
            変更後も継続して利用する場合は変更に同意したものとみなします。
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">第9条（準拠法・管轄）</h2>
          <p>
            本規約は日本法に準拠します。本サービスに関する紛争は、運営者の所在地を管轄する裁判所を専属的合意管轄とします。
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">第10条（お問い合わせ）</h2>
          <p>
            本規約に関するお問い合わせは{' '}
            <a href="mailto:support@s-tasklog.com" className="text-brand underline hover:opacity-80">
              support@s-tasklog.com
            </a>{' '}
            までご連絡ください。
          </p>
        </div>

      </div>
    </section>
  );
}
