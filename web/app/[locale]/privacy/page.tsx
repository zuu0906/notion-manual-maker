import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === 'ja' ? 'プライバシーポリシー' : 'Privacy Policy',
    description: locale === 'ja'
      ? 'Chrome Manual Makerのプライバシーポリシー。収集する情報・利用目的・データの取り扱いについて説明します。'
      : 'Privacy Policy for Chrome Manual Maker. How we collect, use, and protect your information.',
    alternates: { canonical: `/${locale}/privacy` },
  };
}

function PrivacyJa() {
  return (
    <section className="max-w-3xl mx-auto px-4 py-20">
      <h1 className="text-2xl font-bold mb-2">プライバシーポリシー</h1>
      <p className="text-sm text-gray-400 mb-12">最終更新日：2026年4月26日</p>
      <div className="flex flex-col gap-10 text-sm text-gray-700 leading-relaxed">
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">1. 事業者情報</h2>
          <p>本プライバシーポリシーは、Chrome Manual Maker（以下「本サービス」）の運営者（お問い合わせ先：support@s-tasklog.com）が、ユーザーの個人情報をどのように取り扱うかを定めたものです。</p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">2. 収集する情報</h2>
          <ul className="flex flex-col gap-2 list-disc list-inside text-gray-600">
            <li><span className="font-medium text-gray-800">Googleアカウント情報：</span>メールアドレス・Google ID（認証およびプラン管理のため）</li>
            <li><span className="font-medium text-gray-800">Notionアクセストークン：</span>お使いのデバイス上のローカルストレージにのみ保存します。サーバーには送信しません。</li>
            <li><span className="font-medium text-gray-800">利用統計：</span>月間スクリーンショット枚数・AI機能利用回数（プラン制限管理のため）</li>
            <li><span className="font-medium text-gray-800">スクリーンショット画像：</span>ユーザーが操作記録を行ったWebページのスクリーンショット</li>
            <li><span className="font-medium text-gray-800">Stripe決済情報：</span>有料プランをご利用の場合、Stripe社がカード情報を管理します。当サービスはカード番号を保持しません。</li>
          </ul>
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">3. 情報の利用目的</h2>
          <ul className="flex flex-col gap-2 list-disc list-inside text-gray-600">
            <li>サービスの提供・運営（認証、マニュアル保存、Notion連携）</li>
            <li>プラン管理・請求処理（Free / Standard / Pro）</li>
            <li>サービスの品質改善・不具合対応</li>
            <li>サポート対応</li>
          </ul>
          <p className="mt-3 text-gray-600">収集した情報を第三者に販売・提供することはありません。</p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">4. スクリーンショットの取り扱い</h2>
          <p>記録されたスクリーンショットはSupabaseのストレージを経由してNotionページに保存されます。アップロード完了後はNotionページから参照される公開URLとして扱われます。</p>
          <p className="mt-2">個人情報の自動ぼかし機能（メールアドレス・電話番号・クレジットカード番号・パスワード欄など）は、お使いのデバイス上のみで処理され、サーバーには送信されません。</p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">5. Chrome拡張機能が使用する権限</h2>
          <ul className="flex flex-col gap-2 list-disc list-inside text-gray-600">
            <li><span className="font-medium text-gray-800">activeTab / tabs：</span>クリックしたタブのスクリーンショット撮影のため</li>
            <li><span className="font-medium text-gray-800">scripting：</span>PII（個人情報）検出のためコンテンツスクリプトを注入するため</li>
            <li><span className="font-medium text-gray-800">storage：</span>プラン情報・Notionトークンのローカル保存のため</li>
            <li><span className="font-medium text-gray-800">offscreen：</span>赤丸アノテーション画像の生成をService Worker内で行うため</li>
            <li><span className="font-medium text-gray-800">identity：</span>Google OAuthによるユーザー認証のため</li>
          </ul>
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">6. データの保存期間</h2>
          <p>ユーザーデータはアカウント削除まで保持されます。アカウントを削除した場合、メールアドレス・利用統計・ストレージ上のスクリーンショットは速やかに削除されます。Notionに保存されたページはNotionアカウント上に残りますので、必要に応じてNotion側で削除してください。</p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">7. 第三者サービス</h2>
          <p>本サービスは以下の第三者サービスを利用しています。各サービスのプライバシーポリシーもご確認ください。</p>
          <ul className="mt-2 flex flex-col gap-1 list-disc list-inside text-gray-600">
            <li>Google OAuth（認証）</li>
            <li>Notion API（マニュアル保存先）</li>
            <li>Stripe（決済処理）</li>
            <li>Supabase（データベース・ストレージ）</li>
            <li>Google Gemini API（AI説明文生成）</li>
          </ul>
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">8. Cookieの使用</h2>
          <p>本サービスはセッション管理のためにCookieおよびlocalStorageを使用します。トラッキング目的のCookieは使用しません。</p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">9. ポリシーの変更</h2>
          <p>本ポリシーは必要に応じて変更することがあります。重要な変更がある場合はサービス内でお知らせします。変更後も継続して利用する場合は変更に同意したものとみなします。</p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">10. お問い合わせ</h2>
          <p>個人情報の取り扱いに関するお問い合わせは{' '}
            <a href="mailto:support@s-tasklog.com" className="text-brand underline hover:opacity-80">support@s-tasklog.com</a>{' '}
            までご連絡ください。</p>
        </div>
      </div>
    </section>
  );
}

function PrivacyEn() {
  return (
    <section className="max-w-3xl mx-auto px-4 py-20">
      <h1 className="text-2xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-400 mb-12">Last updated: April 26, 2026</p>
      <div className="flex flex-col gap-10 text-sm text-gray-700 leading-relaxed">
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">1. About Us</h2>
          <p>This Privacy Policy describes how the operator of Chrome Manual Maker ("the Service") (contact: support@s-tasklog.com) collects, uses, and protects your personal information.</p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">2. Information We Collect</h2>
          <ul className="flex flex-col gap-2 list-disc list-inside text-gray-600">
            <li><span className="font-medium text-gray-800">Google account info:</span> Email address and Google ID (for authentication and plan management)</li>
            <li><span className="font-medium text-gray-800">Notion access token:</span> Stored only in local storage on your device. Never sent to our servers.</li>
            <li><span className="font-medium text-gray-800">Usage statistics:</span> Monthly screenshot count and AI usage count (for plan limit enforcement)</li>
            <li><span className="font-medium text-gray-800">Screenshots:</span> Screenshots of web pages captured during your recording sessions</li>
            <li><span className="font-medium text-gray-800">Stripe payment info:</span> For paid plans, Stripe manages card data. We never store card numbers.</li>
          </ul>
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">3. How We Use Your Information</h2>
          <ul className="flex flex-col gap-2 list-disc list-inside text-gray-600">
            <li>Providing and operating the service (authentication, manual saving, Notion integration)</li>
            <li>Plan management and billing (Free / Standard / Pro)</li>
            <li>Service improvement and bug fixes</li>
            <li>Customer support</li>
          </ul>
          <p className="mt-3 text-gray-600">We never sell or share your information with third parties.</p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">4. Screenshots</h2>
          <p>Recorded screenshots are saved to your Notion page via Supabase storage. Once uploaded, they are treated as public URLs referenced from your Notion page.</p>
          <p className="mt-2">The automatic PII masking feature (email addresses, phone numbers, credit card numbers, password fields, etc.) is processed entirely on your device and never sent to our servers.</p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">5. Chrome Extension Permissions</h2>
          <ul className="flex flex-col gap-2 list-disc list-inside text-gray-600">
            <li><span className="font-medium text-gray-800">activeTab / tabs:</span> To capture screenshots of the active tab</li>
            <li><span className="font-medium text-gray-800">scripting:</span> To inject content scripts for PII detection</li>
            <li><span className="font-medium text-gray-800">storage:</span> To locally store plan info and Notion tokens</li>
            <li><span className="font-medium text-gray-800">offscreen:</span> To generate annotation images in the Service Worker</li>
            <li><span className="font-medium text-gray-800">identity:</span> For user authentication via Google OAuth</li>
          </ul>
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">6. Data Retention</h2>
          <p>User data is retained until account deletion. When you delete your account, your email address, usage statistics, and stored screenshots are promptly deleted. Pages saved to Notion remain in your Notion account — please delete them there if needed.</p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">7. Third-Party Services</h2>
          <p>The Service uses the following third-party services. Please review their respective privacy policies.</p>
          <ul className="mt-2 flex flex-col gap-1 list-disc list-inside text-gray-600">
            <li>Google OAuth (authentication)</li>
            <li>Notion API (manual storage)</li>
            <li>Stripe (payment processing)</li>
            <li>Supabase (database and storage)</li>
            <li>Google Gemini API (AI description generation)</li>
          </ul>
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">8. Cookies</h2>
          <p>The Service uses cookies and localStorage for session management. We do not use tracking cookies.</p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">9. Policy Updates</h2>
          <p>This policy may be updated as needed. We will notify you of significant changes within the service. Continued use after changes constitutes acceptance.</p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">10. Contact</h2>
          <p>For questions about this Privacy Policy, please contact us at{' '}
            <a href="mailto:support@s-tasklog.com" className="text-brand underline hover:opacity-80">support@s-tasklog.com</a>.
          </p>
        </div>
      </div>
    </section>
  );
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return locale === 'en' ? <PrivacyEn /> : <PrivacyJa />;
}
