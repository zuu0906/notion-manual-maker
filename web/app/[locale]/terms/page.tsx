import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === 'ja' ? '利用規約' : 'Terms of Service',
    description: locale === 'ja'
      ? 'Notion Manual Makerの利用規約。サービスの利用条件・課金・免責事項について説明します。'
      : 'Terms of Service for Notion Manual Maker. Usage conditions, billing, and disclaimers.',
    alternates: { canonical: `/${locale}/terms` },
  };
}

function TermsJa() {
  return (
    <section className="max-w-3xl mx-auto px-4 py-20">
      <h1 className="text-2xl font-bold mb-2">利用規約</h1>
      <p className="text-sm text-gray-400 mb-12">最終更新日：2026年4月26日</p>
      <div className="flex flex-col gap-10 text-sm text-gray-700 leading-relaxed">
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">第1条（適用）</h2>
          <p>本利用規約（以下「本規約」）は、Notion Manual Maker（以下「本サービス」）の運営者（以下「運営者」）と、本サービスを利用するユーザー（以下「ユーザー」）との間の権利義務関係を定めるものです。本サービスを利用した時点で、本規約に同意したものとみなします。</p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">第2条（サービスの内容）</h2>
          <p>本サービスは、Webブラウザ上の操作をスクリーンショット・アノテーション付きでNotionへ自動保存するChrome拡張機能です。個人・法人を問わずご利用いただけます。</p>
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
            <li>有料プラン（Standard $3/月・Pro $8/月）はStripeを通じて月次請求されます。</li>
            <li>いつでもキャンセル可能です。キャンセル後は当月末まで有料プランをご利用いただけます。翌月以降はFreeプランに移行します。</li>
            <li>購入後7日以内であれば返金対応いたします。support@s-tasklog.com までご連絡ください。</li>
            <li>プランの変更（アップグレード・ダウングレード）は即時反映され、差額は日割りで精算されます。</li>
          </ul>
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">第5条（知的財産権）</h2>
          <p>本サービスのコード・デザイン・ロゴ等の知的財産権は運営者に帰属します。ユーザーが作成したスクリーンショット・マニュアルの権利はユーザー自身に帰属します。</p>
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
          <p>運営者は、ユーザーへの事前通知なく本サービスの内容を変更・停止することがあります。これによってユーザーに生じた損害について運営者は責任を負いません。</p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">第8条（規約の変更）</h2>
          <p>本規約は必要に応じて変更することがあります。重要な変更がある場合はサービス内またはメールでお知らせします。変更後も継続して利用する場合は変更に同意したものとみなします。</p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">第9条（準拠法・管轄）</h2>
          <p>本規約は日本法に準拠します。本サービスに関する紛争は、運営者の所在地を管轄する裁判所を専属的合意管轄とします。</p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">第10条（お問い合わせ）</h2>
          <p>本規約に関するお問い合わせは{' '}
            <a href="mailto:support@s-tasklog.com" className="text-brand underline hover:opacity-80">support@s-tasklog.com</a>{' '}
            までご連絡ください。</p>
        </div>
      </div>
    </section>
  );
}

function TermsEn() {
  return (
    <section className="max-w-3xl mx-auto px-4 py-20">
      <h1 className="text-2xl font-bold mb-2">Terms of Service</h1>
      <p className="text-sm text-gray-400 mb-12">Last updated: April 26, 2026</p>
      <div className="flex flex-col gap-10 text-sm text-gray-700 leading-relaxed">
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">Article 1 (Scope)</h2>
          <p>These Terms of Service ("Terms") govern the relationship between the operator of Notion Manual Maker ("the Service") and users of the Service. By using the Service, you agree to these Terms.</p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">Article 2 (Service Description)</h2>
          <p>The Service is a Chrome extension that automatically saves browser operation screenshots with annotations to Notion. It is available to both individuals and businesses.</p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">Article 3 (Prohibited Conduct)</h2>
          <p>Users must not engage in the following:</p>
          <ul className="mt-2 flex flex-col gap-2 list-disc list-inside text-gray-600">
            <li>Acts that violate laws or public order</li>
            <li>Infringement of third-party intellectual property, privacy, or reputation</li>
            <li>Reverse engineering, modification, or unauthorized use of the Service</li>
            <li>Spam, phishing, or other nuisance activities</li>
            <li>Placing excessive load on the operator's or third-party servers or networks</li>
          </ul>
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">Article 4 (Plans and Billing)</h2>
          <ul className="flex flex-col gap-2 list-disc list-inside text-gray-600">
            <li>Paid plans (Standard $3/month · Pro $8/month) are billed monthly via Stripe.</li>
            <li>You may cancel at any time. After cancellation, you retain access until end of the current billing month, then move to Free.</li>
            <li>Refunds are available within 7 days of purchase. Contact support@s-tasklog.com.</li>
            <li>Plan changes (upgrade/downgrade) take effect immediately and are prorated daily.</li>
          </ul>
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">Article 5 (Intellectual Property)</h2>
          <p>All intellectual property rights in the Service's code, design, and logos belong to the operator. Screenshots and manuals created by users belong to the respective users.</p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">Article 6 (Disclaimer)</h2>
          <ul className="flex flex-col gap-2 list-disc list-inside text-gray-600">
            <li>The operator is not liable for any damages arising from use of the Service.</li>
            <li>The Service may be affected by changes or outages in third-party APIs (Notion, Stripe, Google, etc.).</li>
            <li>Continuous availability of the Service is not guaranteed.</li>
            <li>Accuracy of AI-generated descriptions is not guaranteed.</li>
          </ul>
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">Article 7 (Service Changes and Suspension)</h2>
          <p>The operator may modify or suspend the Service without prior notice. The operator is not liable for any damages resulting from such changes.</p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">Article 8 (Terms Updates)</h2>
          <p>These Terms may be updated as needed. We will notify you of significant changes within the Service or by email. Continued use after updates constitutes acceptance.</p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">Article 9 (Governing Law and Jurisdiction)</h2>
          <p>These Terms are governed by Japanese law. Any disputes relating to the Service shall be subject to the exclusive jurisdiction of the court having jurisdiction over the operator's location.</p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">Article 10 (Contact)</h2>
          <p>For inquiries about these Terms, please contact{' '}
            <a href="mailto:support@s-tasklog.com" className="text-brand underline hover:opacity-80">support@s-tasklog.com</a>.
          </p>
        </div>
      </div>
    </section>
  );
}

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return locale === 'en' ? <TermsEn /> : <TermsJa />;
}
