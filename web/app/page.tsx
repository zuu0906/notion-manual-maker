import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Chrome Manual Maker — クリックだけでNotionにマニュアル自動保存',
  description:
    'クリックするだけでスクリーンショット＋矢印アノテーションをNotionへ自動保存。操作マニュアル・手順書作成を10倍速に。Chrome拡張機能で無料から始められます。',
  alternates: { canonical: '/' },
};

const STORE_URL = 'https://chrome.google.com/webstore';

/* ── Notion-page mockup ──────────────────────────────── */
function NotionPageMockup() {
  const steps = [
    { n: 1, title: 'ダッシュボードにアクセス',   ai: 'ブラウザで管理画面を開きます' },
    { n: 2, title: '設定アイコンをクリック',      ai: '右上の歯車アイコンをクリックします' },
    { n: 3, title: '変更を保存する',              ai: '「保存」ボタンをクリックして完了' },
  ];

  return (
    <div className="w-full max-w-md bg-white border border-n-200 rounded-xl shadow-notion-lg overflow-hidden text-left">
      {/* Browser chrome */}
      <div className="bg-n-50 border-b border-n-200 px-4 py-2.5 flex items-center gap-3">
        <div className="flex gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#FF5F56]" />
          <span className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
          <span className="w-3 h-3 rounded-full bg-[#27C93F]" />
        </div>
        <div className="flex-1 bg-white border border-n-200 rounded text-xs text-n-500 px-3 py-0.5 text-center truncate">
          notion.so / 操作マニュアル
        </div>
      </div>

      {/* Notion page */}
      <div className="px-8 py-6">
        {/* Page icon + title */}
        <div className="text-4xl mb-2">📋</div>
        <h3 className="text-2xl font-bold text-n-900 mb-1 leading-tight">操作マニュアル</h3>
        <p className="text-xs text-n-500 mb-5">Chrome Manual Maker で自動生成 · 2025/4/25</p>

        <div className="border-t border-n-200 mb-5" />

        {/* Step blocks */}
        <div className="space-y-4">
          {steps.map((s) => (
            <div key={s.n} className="flex gap-3">
              {/* Number badge */}
              <div className="w-6 h-6 rounded bg-brand text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                {s.n}
              </div>
              <div className="flex-1 min-w-0">
                {/* Screenshot placeholder */}
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

          {/* Add block hint */}
          <div className="flex items-center gap-1.5 text-xs text-n-300 hover:text-n-500 cursor-pointer pt-1">
            <span className="text-base leading-none">+</span>
            <span>新しいブロックを追加</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Data ────────────────────────────────────────────── */
const pains = [
  { icon: '🖊️', text: 'スクショを撮るたびに画像編集ツールで矢印を描いている' },
  { icon: '⏱️', text: '手順書1本作るのに1時間以上かかっている' },
  { icon: '🔄', text: '手順が変わるたびに全部作り直している' },
  { icon: '📁', text: 'バラバラな場所に保存されて誰も見つけられない' },
];

const steps = [
  {
    n: '1',
    icon: '🔌',
    title: '拡張機能を起動',
    desc: 'Chromeツールバーのアイコンをクリック。Googleアカウントでログインするだけで即使える。',
  },
  {
    n: '2',
    icon: '📸',
    title: '手順をクリックするだけ',
    desc: '「記録開始」を押して、説明したい箇所を順番にクリック。スクショ＋番号付き矢印が自動生成される。',
  },
  {
    n: '3',
    icon: '🚀',
    title: 'NotionにAIラベル付きで保存',
    desc: '「Notionへ保存」を1回押すだけ。AI説明文付きの画像ブロックがページに自動追加される。',
  },
];

const features = [
  { icon: '📸', title: 'スクショ＋矢印を自動生成',   desc: 'クリックした瞬間に番号付き矢印アノテーションを描画。手動加工ゼロ。' },
  { icon: '🤖', title: 'AIが説明文を自動生成',         desc: 'Gemini AIが各ステップの操作内容を日本語で自動生成。手入力の手間が消える。' },
  { icon: '📝', title: 'Notionへ直接保存',             desc: 'OAuth連携でワンクリック保存。画像ブロック＋テキストを指定ページへ自動追加。' },
  { icon: '📄', title: 'PDFエクスポート',              desc: '完成したマニュアルをPDFでも出力可能。社内共有・印刷にも対応。' },
  { icon: '🔒', title: 'データはあなたのNotionに',    desc: 'スクショは自分のNotionページに保存。外部サーバーに依存しません。' },
  { icon: '🎭', title: 'PII自動マスキング',            desc: '個人情報を検出して自動的にぼかし処理。情報漏洩リスクを軽減。' },
];

const plans = [
  {
    name: 'Free',
    emoji: '🌱',
    price: '¥0',
    period: '永久無料',
    features: ['スクショ 20枚/月', 'Notion連携', 'ウォーターマーク付き'],
    highlight: false,
    cta: 'Chromeに無料で追加',
    href: STORE_URL,
    external: true,
  },
  {
    name: 'Standard',
    emoji: '⚡',
    price: '¥500',
    period: '/月',
    features: ['スクショ 無制限', 'AI生成 100回/月', 'PDF出力', 'ウォーターマークなし'],
    highlight: false,
    cta: 'マイページからアップグレード',
    href: '/dashboard',
    external: false,
  },
  {
    name: 'Pro',
    emoji: '🚀',
    price: '¥1,200',
    period: '/月',
    features: ['スクショ 無制限', 'AI生成 500回/月', 'Notion 3WS', 'ウォーターマークなし'],
    highlight: true,
    cta: 'マイページからアップグレード',
    href: '/dashboard',
    external: false,
  },
];

const faqs = [
  {
    q: '無料プランでどこまで使えますか？',
    a: 'スクショ20枚/月・Notion保存・番号付き矢印アノテーションが使えます。AI説明文生成はStandard以上のプランに含まれます。',
  },
  {
    q: 'Notionのどのプランが必要ですか？',
    a: 'Notionの無料プランで連携できます。ページへの書き込み権限があれば問題ありません。',
  },
  {
    q: 'スクショはどこに保存されますか？',
    a: '画像は直接あなたのNotionページへ保存されます。弊社サーバーへのアップロードはなく、データはあなたのWorkspaceにのみ存在します。',
  },
  {
    q: 'プランはいつでも変更できますか？',
    a: 'はい。アップグレード・ダウングレードはいつでも可能です。日割り計算でお支払いいただきます。',
  },
  {
    q: '法人・チームでの利用はできますか？',
    a: 'Teamプラン（¥2,980/月・5席）をご用意しています。ご要望はお問い合わせください。',
  },
];

/* ── Page ────────────────────────────────────────────── */
export default function HomePage() {
  return (
    <>
      {/* ═══════════════════════════════ HERO ═══ */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-12 sm:pb-20">

        {/* Badge */}
        <div className="anim-fade-up anim-d1 flex justify-center mb-6">
          <span className="inline-flex items-center gap-1.5 bg-n-50 border border-n-200 text-n-700 text-xs font-medium px-3 py-1 rounded-full">
            <span>🔗</span>
            Chrome × Notion × Gemini AI
          </span>
        </div>

        {/* Headline */}
        <h1 className="anim-fade-up anim-d2 text-center text-4xl sm:text-5xl lg:text-6xl font-bold text-n-900 leading-tight tracking-tight mb-5">
          クリックするだけで<br className="hidden sm:block" />
          <span className="text-brand">操作マニュアル</span>が完成する
        </h1>

        {/* Sub */}
        <p className="anim-fade-up anim-d3 text-center text-n-500 text-base sm:text-lg max-w-xl mx-auto leading-relaxed mb-8">
          スクショ・矢印・AI説明文をまとめて自動生成してNotionへ保存。<br className="hidden sm:block" />
          1時間かかっていた手順書が<span className="font-semibold text-n-900">5分</span>で完成します。
        </p>

        {/* CTAs */}
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
            Chromeに無料で追加
          </a>
          <a
            href="/how-it-works"
            className="inline-flex items-center justify-center gap-1 bg-white text-n-700 font-medium text-sm px-6 py-3 rounded-notion border border-n-200 hover:bg-n-50 hover:border-n-300 transition-colors"
          >
            使い方を見る
            <span className="text-n-400">→</span>
          </a>
        </div>

        <p className="anim-fade-up anim-d5 text-center text-xs text-n-400 mt-4">
          無料プランあり · クレジットカード不要 · 14日間無料トライアル
        </p>

        {/* Product visual */}
        <div className="anim-fade-up anim-d5 flex justify-center mt-14 sm:mt-16">
          <NotionPageMockup />
        </div>
      </section>

      {/* ═══════════════════════════════ STATS ══ */}
      <div className="border-y border-n-200 bg-n-50 py-6">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 grid grid-cols-3 divide-x divide-n-200">
          {[
            { n: '10×',  label: 'マニュアル作成スピード' },
            { n: '3',    label: 'ステップで完成' },
            { n: '¥0',   label: 'から始められる' },
          ].map((s) => (
            <div key={s.label} className="text-center px-4 py-2">
              <div className="text-2xl sm:text-3xl font-bold text-n-900 tracking-tight">{s.n}</div>
              <div className="text-xs text-n-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════ PAIN ═══ */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-20 sm:py-24">
        <div className="reveal text-center mb-12">
          <p className="text-xs font-medium text-brand uppercase tracking-widest mb-3">Problem</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-n-900 mb-3">こんな経験、ありませんか？</h2>
          <p className="text-n-500 text-sm sm:text-base">マニュアル作成の「当たり前のムダ」を見直す時です</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 reveal">
          {pains.map((p) => (
            <div
              key={p.text}
              className="flex items-start gap-4 bg-n-50 border border-n-200 rounded-xl p-5 hover:shadow-notion transition-shadow"
            >
              <span className="text-2xl flex-shrink-0">{p.icon}</span>
              <p className="text-n-700 text-sm leading-relaxed">{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════ HOW IT WORKS ══ */}
      <section className="bg-n-50 border-y border-n-200 py-20 sm:py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="reveal text-center mb-14">
            <p className="text-xs font-medium text-brand uppercase tracking-widest mb-3">How it works</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-n-900 mb-3">3ステップで完成</h2>
            <p className="text-n-500 text-sm sm:text-base">インストールからNotion保存まで5分以内</p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6 sm:gap-8">
            {steps.map((s, i) => (
              <div key={s.n} className="reveal relative">
                {/* Connector line */}
                {i < steps.length - 1 && (
                  <div className="hidden sm:block absolute top-6 left-[calc(50%+2.5rem)] w-[calc(100%-5rem)] h-px bg-n-200 z-0" />
                )}
                <div className="relative z-10 text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-white border border-n-200 shadow-notion text-2xl mb-4">
                    {s.icon}
                  </div>
                  <div className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand text-white text-[10px] font-bold ml-1 mb-4 -mt-4 align-top">{s.n}</div>
                  <h3 className="font-semibold text-n-900 mb-2">{s.title}</h3>
                  <p className="text-sm text-n-500 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-10 reveal">
            <a href="/how-it-works" className="text-sm text-brand font-medium hover:underline">
              詳しい使い方を見る →
            </a>
          </div>
        </div>
      </section>

      {/* ══════════════════════════ BEFORE/AFTER ══ */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-20 sm:py-24">
        <div className="reveal text-center mb-12">
          <p className="text-xs font-medium text-brand uppercase tracking-widest mb-3">Before / After</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-n-900">導入前後の変化</h2>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 reveal">
          {/* Before */}
          <div className="border border-n-200 rounded-xl p-6 sm:p-8">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-n-500 bg-n-100 px-2.5 py-1 rounded-full mb-6">
              <span>😩</span> Before
            </div>
            <ul className="space-y-3">
              {[
                'スクショ → 画像編集ツール → 矢印を手描き',
                '各ステップのテキストを手で入力',
                '画像をドラッグ＆ドロップでNotionへ',
                '見出しや番号を手動で整える',
                '完成まで1時間以上',
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-sm text-n-700">
                  <span className="text-n-300 mt-0.5 flex-shrink-0">✕</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* After */}
          <div className="border-2 border-brand/30 bg-brand/[0.02] rounded-xl p-6 sm:p-8 relative">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand bg-brand/10 px-2.5 py-1 rounded-full mb-6">
              <span>✨</span> After
            </div>
            <ul className="space-y-3">
              {[
                'クリックするだけでスクショ＋矢印が自動生成',
                'AIが説明文を自動生成',
                'ワンクリックでNotionへ一括保存',
                'レイアウト・番号は自動で整列',
                '完成まで5分以内',
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-sm font-medium text-n-900">
                  <span className="text-brand mt-0.5 flex-shrink-0">✓</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ════════════════════════════ FEATURES ════ */}
      <section className="bg-n-50 border-y border-n-200 py-20 sm:py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="reveal text-center mb-14">
            <p className="text-xs font-medium text-brand uppercase tracking-widest mb-3">Features</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-n-900">主な機能</h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {features.map((f) => (
              <div
                key={f.title}
                className="reveal bg-white border border-n-200 rounded-xl p-5 sm:p-6 hover:shadow-notion-md hover:border-n-300 transition-all"
              >
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-semibold text-n-900 mb-1.5 text-sm">{f.title}</h3>
                <p className="text-xs text-n-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════ PRICING ═════ */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-20 sm:py-24">
        <div className="reveal text-center mb-14">
          <p className="text-xs font-medium text-brand uppercase tracking-widest mb-3">Pricing</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-n-900 mb-3">シンプルな料金プラン</h2>
          <p className="text-n-500 text-sm">まず無料で試して、必要に応じてアップグレード</p>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 sm:gap-5">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`reveal flex flex-col rounded-xl border p-6 sm:p-8 relative transition-shadow hover:shadow-notion-md ${
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
                href={plan.href}
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
          <p className="text-xs text-n-400">14日間無料トライアル · いつでもキャンセル可能</p>
          <a href="/pricing" className="text-xs text-brand hover:underline">すべてのプランを比較する →</a>
        </div>
      </section>

      {/* ══════════════════════════════ FAQ ════════ */}
      <section className="bg-n-50 border-y border-n-200 py-20 sm:py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="reveal text-center mb-12">
            <p className="text-xs font-medium text-brand uppercase tracking-widest mb-3">FAQ</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-n-900">よくある質問</h2>
          </div>

          <div className="space-y-2 reveal">
            {faqs.map((faq) => (
              <details
                key={faq.q}
                className="group bg-white border border-n-200 rounded-xl overflow-hidden hover:border-n-300 transition-colors"
              >
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

      {/* ═══════════════════════════════ CTA ═══════ */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-20 sm:py-28 text-center">
        <div className="reveal max-w-xl mx-auto">
          <div className="text-5xl mb-5">🚀</div>
          <h2 className="text-2xl sm:text-3xl font-bold text-n-900 mb-3">今すぐ無料で始める</h2>
          <p className="text-n-500 mb-2">月20スクショまで永久無料。クレジットカード不要。</p>
          <p className="text-xs text-n-400 mb-8">Standardプランは14日間無料トライアル付き</p>
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
            Chromeに追加する（無料）
          </a>
        </div>
      </section>

      {/* JSON-LD */}
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
            description:
              'クリックするだけでスクリーンショット+矢印アノテーションをNotionへ自動保存するChrome拡張機能。AI説明文自動生成付き。',
          }),
        }}
      />
    </>
  );
}
