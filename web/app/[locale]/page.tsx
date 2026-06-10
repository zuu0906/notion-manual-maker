import { setRequestLocale } from 'next-intl/server';
import HeroStage from './HeroStage';

const STORE_URL = 'https://chromewebstore.google.com/detail/kapchgeffhkfffhflcpjjkiojneipicd';

// ── Bilingual copy ──────────────────────────────────────────────
const COPY = {
  ja: {
    hero: {
      eyebrow: 'Notion × Chrome × AI',
      h1Pre: '手順書を作るなら、',
      h1Em: 'もう画像編集ツールは',
      h1Post: 'いらない。',
      lede: 'クリックするだけでスクリーンショット＋赤丸アノテーションを自動生成。AIで説明文を作成してNotionへ保存。1時間かかっていた手順書が、5分で完成します。',
      ctaPrimary: 'Chromeに無料で追加',
      ctaSecondary: '使い方を見る',
      ctaDesktop: 'デスクトップ版',
      trust: ['無料プランあり', 'クレジットカード不要', 'Chrome拡張 + Windowsアプリ対応'],
      stage: {
        urlHost: 'app.example.com', urlPath: '/dashboard', ext: 'Manual Maker',
        side: ['ホーム', 'ダッシュボード', 'メンバー', '請求', '設定'],
        sideSection: 'ワークスペース',
        statTitles: ['MRR', 'アクティブ', '解約率'],
        steps: ['ダッシュボードを開く', '設定アイコンをクリック', '「保存」ボタンを押す'],
        stepsAI: ['ブラウザで管理画面を開きます。', '右上の歯車アイコンをクリックします。', '「保存」ボタンを押して完了します。'],
        notionTitle: '操作マニュアル — 設定変更',
        notionMeta: 'notion.so / Manual Maker · 自動生成',
        replay: 'リプレイ', capturing: 'キャプチャ中...', saved: 'Notionに保存済み',
      },
      stats: [
        { v: '5', suf: 'min', l: '1本あたりの作成時間' },
        { v: '10', suf: '×', l: '従来比のスピード' },
        { v: '0', suf: '¥〜', l: '無料プランから' },
      ],
    },
    problem: {
      tag: 'Problem',
      h2: 'マニュアル作成の「当たり前」を、見直しませんか。',
      lede: 'スクショを撮って、マーキングして、Notionに貼って、番号を直して。本来の業務に戻れない、その時間。',
      cells: [
        { x: '01', t: 'スクショを撮るたび、画像編集ツールで矢印を手描きしている。' },
        { x: '02', t: '手順書1本に1時間以上かかっている。' },
        { x: '03', t: '手順が変わるたび、最初から作り直している。' },
        { x: '04', t: '保存場所がバラバラで、誰も見つけられない。' },
      ],
    },
    how: {
      tag: 'How it works',
      h2: '3ステップで、5分以内。',
      lede: '拡張機能を入れて、クリックして、保存する。それだけ。',
      steps: [
        { n: 'Step 01', t: '拡張機能を起動', d: 'Chromeツールバーのアイコンをクリック。Googleアカウントでサインインすれば、すぐ使えます。' },
        { n: 'Step 02', t: '手順をクリックするだけ', d: '「記録開始」を押して、説明したい箇所を順番にクリック。スクショと赤丸アノテーションが自動生成されます。' },
        { n: 'Step 03', t: 'Notionへワンクリック保存', d: '必要に応じてAIで説明文を生成してから「Notionへ保存」を押すだけ。画像ブロックがページに自動追加されます。' },
      ],
    },
    ba: {
      tag: 'Before / After',
      h2: '1時間の作業が、5分に。',
      before: {
        label: 'BEFORE', time: '60分以上',
        items: ['スクショ → 画像編集 → 矢印を手描き', '各ステップのテキストを手で入力', '画像をドラッグでNotionへ', '見出しと番号を手動で整える', '完成まで1時間以上'],
      },
      after: {
        label: 'AFTER', time: '5分以内',
        items: ['クリックでスクショ＋赤丸アノテーションを自動生成', 'AIで説明文をワンクリック生成', 'ワンクリックでNotionへ一括保存', 'レイアウトは自動で整列', '完成まで5分以内'],
      },
    },
    feat: {
      tag: 'Features',
      h2: '必要なものが、すべて揃っている。',
      lede: '撮る、書く、保存する。マニュアル作成のすべてを、ひとつの拡張機能で。',
      items: [
        { size: 'large', t: 'スクショ＋赤丸を自動付与', d: 'クリックした位置に赤丸が自動で付きます。手で矢印を描く手間が省けます。', visual: 'shot' },
        { size: 'med', t: 'AIが説明文の下書きを生成', d: 'Gemini AI が各ステップの操作内容から、説明文の下書きを作成します。必要に応じて編集できます。', visual: 'ai' },
        { size: 'sm', t: 'Notionへ直接保存', d: 'OAuth連携でワンクリック保存。', visual: 'notion' },
        { size: 'sm', t: 'PDFエクスポート', d: '社内共有・印刷にも対応。', visual: 'pdf' },
        { size: 'sm', t: 'PII自動マスキング', d: '個人情報を検出してぼかします。', visual: 'mask' },
        { size: 'med', t: 'データはあなたのNotionに', d: 'スクショはNotionページに保存されます。画像URLの発行に一時的にサーバーを経由しますが、サーバーへの永続保存はされません。', visual: 'lock' },
      ],
    },
    desktop: {
      tag: 'Desktop App',
      h2: 'Chrome不要。あらゆるアプリのマニュアルを作れる。',
      lede: 'Webブラウザだけでなく、WindowsアプリやデスクトップツールのマニュアルもNotion Manual Makerで。Windows専用デスクトップアプリが対応します。',
      items: [
        { t: 'どんなアプリも対象', d: 'Excel・PowerPoint・社内システムなど、Chromeで開けないアプリもOK。デスクトップ上で動くものすべてに対応。' },
        { t: 'OCRで個人情報を自動検出', d: 'Windows標準OCRエンジンがスクリーンショット内のメールアドレス・電話番号を自動検出し、ぼかして保護します。' },
        { t: 'PDF出力に対応', d: 'Notionへの保存に加えて、手順書をPDFとして出力。社内配布や印刷に対応します。（Standard以上）' },
        { t: '同じアカウントで連携', d: 'Googleアカウントでサインインすれば、拡張機能とデスクトップアプリのデータが自動同期されます。' },
      ],
      cta: 'デスクトップ版をダウンロード',
      note: 'Windows 10/11対応 · 無料',
    },
    pricing: {
      tag: 'Pricing',
      h2: 'シンプルな料金プラン。',
      lede: 'まずは無料で試して、必要に応じてアップグレード。日割り計算でいつでも変更できます。',
      plans: [
        { name: 'Free', price: '¥0', per: '永久無料', desc: '無料でお試しライトユーザー。', features: ['スクショ 20枚 / 月', 'Notion 連携', '赤丸アノテーション', 'ウォーターマーク付き'], cta: 'Chromeに追加する', featured: false },
        { name: 'Standard', price: '$3', per: '/ 月', desc: '本格的に使うヘビーユーザー向け。', features: ['スクショ 無制限', 'AI 生成 100回 / 月', 'PDF出力', 'ウォーターマークなし'], cta: '14日間無料で始める', featured: true, ribbon: 'おすすめ' },
        { name: 'Pro', price: '$8', per: '/ 月', desc: '複数ワークスペースを横断するチームユーザー向け。', features: ['スクショ 無制限', 'AI 生成 500回 / 月', 'Notion ワークスペース 3つ', 'ウォーターマークなし'], cta: 'アップグレード', featured: false },
      ],
      foot: '14日間無料トライアル · いつでもキャンセル可能',
    },
    faq: {
      tag: 'FAQ', h2: 'よくある質問',
      items: [
        { q: '無料プランでどこまで使えますか？', a: 'スクショ20枚/月・Notion保存・赤丸アノテーションが使えます。AI説明文の生成はStandard以上のプランに含まれます。' },
        { q: 'Notionのどのプランが必要ですか？', a: 'Notionの無料プランで連携できます。ページへの書き込み権限さえあれば、追加の費用はかかりません。' },
        { q: 'スクショはどこに保存されますか？', a: 'スクショはNotionページに外部リンクとして保存されます。画像URLの発行に一時的にサーバーを経由しますが、サーバーへの永続保存はされません。' },
        { q: 'プランはいつでも変更できますか？', a: 'はい。アップグレード・ダウングレードはいつでも可能で、日割り計算でお支払いいただきます。' },
      ],
    },
    final: {
      h2: '今すぐ無料で始める',
      lede: '月20スクショまで永久無料。クレジットカード不要。',
      ctaPrimary: 'Chromeに追加する（無料）',
      foot: 'STANDARD PLAN — 14 DAYS FREE TRIAL',
    },
  },
  en: {
    hero: {
      eyebrow: 'Notion × Chrome × AI',
      h1Pre: 'Building a how-to guide? ',
      h1Em: 'You don\'t need an image editor',
      h1Post: ' anymore.',
      lede: 'One click captures a screenshot with a red-circle annotation. Generate AI captions with one button, then save everything to Notion. A manual that used to take an hour — done in five minutes.',
      ctaPrimary: 'Add to Chrome — Free',
      ctaSecondary: 'See how it works',
      ctaDesktop: 'Desktop App',
      trust: ['Free plan', 'No credit card', 'Chrome extension + Windows app'],
      stage: {
        urlHost: 'app.example.com', urlPath: '/dashboard', ext: 'Manual Maker',
        side: ['Home', 'Dashboard', 'Members', 'Billing', 'Settings'],
        sideSection: 'Workspace',
        statTitles: ['MRR', 'Active', 'Churn'],
        steps: ['Open the dashboard', 'Click the settings icon', "Press 'Save'"],
        stepsAI: ['Open the admin page in your browser.', 'Click the gear icon at the top right.', "Press the 'Save' button to finish."],
        notionTitle: 'How-to — Update settings',
        notionMeta: 'notion.so / Manual Maker · auto-generated',
        replay: 'Replay', capturing: 'Capturing…', saved: 'Saved to Notion',
      },
      stats: [
        { v: '5', suf: 'min', l: 'Average time per manual' },
        { v: '10', suf: '×', l: 'Faster than the old way' },
        { v: '0', suf: '$+', l: 'Starts at free, forever' },
      ],
    },
    problem: {
      tag: 'Problem',
      h2: 'The everyday tax of writing manuals.',
      lede: 'Screenshot. Edit. Drop into Notion. Renumber. The interruptions add up faster than the document.',
      cells: [
        { x: '01', t: 'Hand-drawing arrows on every screenshot in an image editor.' },
        { x: '02', t: 'Spending an hour on a single how-to document.' },
        { x: '03', t: 'Rebuilding the whole thing every time the UI changes.' },
        { x: '04', t: 'Files scattered across folders — nobody can find them.' },
      ],
    },
    how: {
      tag: 'How it works',
      h2: 'Three steps. Five minutes.',
      lede: 'Install, click, save. That\'s the whole workflow.',
      steps: [
        { n: 'Step 01', t: 'Launch the extension', d: "Click the icon in Chrome's toolbar. Sign in with Google and you're set." },
        { n: 'Step 02', t: 'Click through your steps', d: "Hit 'Record', then click each thing you want to show. A screenshot with a red-circle annotation is captured automatically." },
        { n: 'Step 03', t: 'One-click to Notion', d: "Optionally generate AI captions, then press 'Save to Notion'. Image blocks are added to your page instantly." },
      ],
    },
    ba: {
      tag: 'Before / After',
      h2: 'An hour of work, in five minutes.',
      before: {
        label: 'BEFORE', time: '60+ min',
        items: ['Screenshot → image editor → hand-drawn arrows', 'Type out the description for every step', 'Drag images into Notion one by one', 'Manually fix headings and numbering', 'Over an hour to ship'],
      },
      after: {
        label: 'AFTER', time: 'Under 5 min',
        items: ['One click — screenshot and red-circle auto-generated', 'One-click AI caption generation', 'One click to push everything to Notion', 'Layout aligns itself', 'Done in under five minutes'],
      },
    },
    feat: {
      tag: 'Features',
      h2: 'Everything you need, in one extension.',
      lede: 'Capture, caption, save. Manual-making, end to end.',
      items: [
        { size: 'large', t: 'Auto screenshots with red circles', d: 'A numbered red circle is added at each click position, so you can skip drawing arrows by hand.', visual: 'shot' },
        { size: 'med', t: 'AI-drafted captions', d: 'Gemini drafts a short description for each step. Edit any line you want to refine.', visual: 'ai' },
        { size: 'sm', t: 'Direct to Notion', d: 'OAuth-connected, one-click save.', visual: 'notion' },
        { size: 'sm', t: 'PDF export', d: 'Share or print without re-formatting.', visual: 'pdf' },
        { size: 'sm', t: 'PII auto-masking', d: 'Detects and blurs personal info.', visual: 'mask' },
        { size: 'med', t: 'Your data, your Notion', d: 'Screenshots are saved to your Notion page. Our server handles the image URL briefly, but images are not permanently stored on our servers.', visual: 'lock' },
      ],
    },
    desktop: {
      tag: 'Desktop App',
      h2: 'No Chrome needed. Document any app.',
      lede: 'Beyond web pages — manual any Windows application with the Notion Manual Maker desktop app.',
      items: [
        { t: 'Any app, any screen', d: 'Excel, PowerPoint, internal tools — if it runs on Windows, you can document it.' },
        { t: 'OCR-powered PII masking', d: "Windows' built-in OCR engine automatically detects emails and phone numbers in screenshots and blurs them." },
        { t: 'PDF export', d: 'Export your guide as a PDF for distribution or printing. (Standard plan and above.)' },
        { t: 'Shared account', d: 'Sign in with the same Google account to sync data across the extension and the desktop app.' },
      ],
      cta: 'Download Desktop App',
      note: 'Windows 10/11 · Free',
    },
    pricing: {
      tag: 'Pricing',
      h2: 'Honest, simple pricing.',
      lede: 'Try it free, upgrade when you need to. Pro-rated, change anytime.',
      plans: [
        { name: 'Free', price: '$0', per: 'forever', desc: 'Plenty for solo experimentation.', features: ['20 screenshots / month', 'Notion connector', 'Red-circle annotations', 'Includes watermark'], cta: 'Add to Chrome', featured: false },
        { name: 'Standard', price: '$3', per: '/ month', desc: 'For teams that ship docs daily.', features: ['Unlimited screenshots', '100 AI captions / month', 'PDF export', 'No watermark'], cta: 'Start 14-day trial', featured: true, ribbon: 'Most popular' },
        { name: 'Pro', price: '$8', per: '/ month', desc: 'Multi-workspace organisations.', features: ['Unlimited screenshots', '500 AI captions / month', '3 Notion workspaces', 'No watermark'], cta: 'Upgrade', featured: false },
      ],
      foot: '14-day free trial · cancel anytime',
    },
    faq: {
      tag: 'FAQ', h2: 'Frequently asked',
      items: [
        { q: 'What does the free plan include?', a: '20 screenshots per month, Notion saving, and red-circle annotations. AI caption generation is part of Standard and above.' },
        { q: 'Which Notion plan do I need?', a: 'Any plan, including the free one. As long as the connected user can write to your page, you\'re good.' },
        { q: 'Where are my screenshots stored?', a: "Screenshots are embedded in your Notion page as external image links. Our server handles the URL briefly — images aren't permanently stored on our end." },
        { q: 'Can I change plans whenever?', a: 'Yes — upgrades and downgrades are pro-rated and take effect immediately.' },
      ],
    },
    final: {
      h2: 'Start for free today.',
      lede: 'Up to 20 screenshots a month, forever free. No credit card required.',
      ctaPrimary: 'Add to Chrome — Free',
      foot: 'STANDARD PLAN — 14 DAYS FREE TRIAL',
    },
  },
} as const;

type Lang = keyof typeof COPY;
type Copy = (typeof COPY)[Lang];

// ── Section helpers ─────────────────────────────────────────────

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="section-tag">{children}</div>;
}

const TRUST_ITEMS = [
  { icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="7.5" stroke="currentColor" strokeWidth="1.3" opacity="0.4"/><circle cx="9" cy="9" r="3" fill="currentColor"/></svg>, label: 'Google Chrome' },
  { icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="3" y="3" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><path d="M6 6V12M6 6L12 12V6" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round"/></svg>, label: 'Notion' },
  { icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 2L10.5 6.5L15 8L10.5 9.5L9 14L7.5 9.5L3 8L7.5 6.5L9 2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>, label: 'Gemini AI' },
  { icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="4" width="14" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><path d="M6 4V3M12 4V3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><path d="M2 8h14" stroke="currentColor" strokeWidth="1.4"/></svg>, label: 'Windows App' },
];

function TrustBar({ locale }: { locale: string }) {
  const label = locale === 'en' ? 'Works with' : '対応環境';
  return (
    <div className="trust-bar">
      <div className="lp-container">
        <div className="trust-bar-inner">
          <span className="trust-bar-label">{label}</span>
          {TRUST_ITEMS.map((it, i) => (
            <span key={i} className="trust-bar-item">
              {it.icon}
              {it.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function StepVisual({ idx }: { idx: number }) {
  if (idx === 0) return (
    <div className="visual">
      <div className="svgrid"></div>
      <div style={{ position: 'absolute', top: 14, right: 14, width: 170, padding: 12, borderRadius: 10, background: 'var(--paper)', border: '1px solid var(--line)', boxShadow: 'var(--shadow-md)', fontSize: 11 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ width: 18, height: 18, borderRadius: 5, background: 'linear-gradient(135deg, oklch(0.66 0.16 250), oklch(0.58 0.16 270))' }}></span>
          <span style={{ fontWeight: 600, color: 'var(--ink)' }}>Manual Maker</span>
        </div>
        <div style={{ height: 8, borderRadius: 3, background: 'var(--bg-3)', marginBottom: 6 }}></div>
        <div style={{ height: 8, width: '70%', borderRadius: 3, background: 'var(--bg-3)', marginBottom: 12 }}></div>
        <div style={{ display: 'block', width: '100%', background: 'var(--ink)', color: 'var(--paper)', padding: '7px 0', borderRadius: 6, fontSize: 11, fontWeight: 500, textAlign: 'center' }}>● 記録を開始</div>
      </div>
    </div>
  );
  if (idx === 1) return (
    <div className="visual">
      <div className="svgrid"></div>
      <svg viewBox="0 0 320 150" preserveAspectRatio="xMidYMid meet" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        {[{ x: 60, y: 40, n: 1 }, { x: 165, y: 75, n: 2 }, { x: 260, y: 110, n: 3 }].map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="15" fill="none" stroke="oklch(0.58 0.20 25)" strokeWidth="2"/>
            <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize="11" fontFamily="JetBrains Mono, monospace" fill="oklch(0.50 0.20 25)" fontWeight="600">{p.n}</text>
          </g>
        ))}
      </svg>
    </div>
  );
  return (
    <div className="visual" style={{ padding: 12 }}>
      <div className="svgrid"></div>
      <div style={{ position: 'absolute', inset: 16, background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 8, padding: 12, fontSize: 11, boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 12, marginBottom: 8 }}>📋 操作マニュアル</div>
        {[1, 2, 3].map((n) => (
          <div key={n} style={{ display: 'flex', gap: 8, padding: '4px 0', borderTop: n > 1 ? '1px dashed var(--line)' : undefined }}>
            <span style={{ width: 14, height: 14, borderRadius: '50%', background: 'transparent', color: 'oklch(0.50 0.20 25)', border: '1.5px solid oklch(0.58 0.20 25)', display: 'grid', placeItems: 'center', fontSize: 9, fontFamily: 'monospace', fontWeight: 600, flexShrink: 0, marginTop: 1 }}>{n}</span>
            <div style={{ flex: 1 }}>
              <div style={{ height: 6, borderRadius: 2, background: 'var(--bg-3)', width: `${[80, 65, 72][n - 1]}%` }}></div>
              <div style={{ height: 18, borderRadius: 3, background: 'linear-gradient(135deg, var(--bg-2), var(--bg-3))', marginTop: 4 }}></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FeatIcon({ kind }: { kind: string }) {
  const sw = 1.5, w = 18, h = 18;
  if (kind === 'shot') return <svg width={w} height={h} viewBox="0 0 18 18" fill="none"><rect x="2" y="4" width="14" height="10" rx="2" stroke="currentColor" strokeWidth={sw}/><circle cx="9" cy="9" r="2.5" stroke="currentColor" strokeWidth={sw}/></svg>;
  if (kind === 'ai') return <svg width={w} height={h} viewBox="0 0 18 18" fill="none"><path d="M9 2L10.5 6.5L15 8L10.5 9.5L9 14L7.5 9.5L3 8L7.5 6.5L9 2Z" stroke="currentColor" strokeWidth={sw} strokeLinejoin="round"/></svg>;
  if (kind === 'notion') return <svg width={w} height={h} viewBox="0 0 18 18" fill="none"><rect x="3" y="3" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth={sw}/><path d="M6 6V12M6 6L12 12V6" stroke="currentColor" strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round"/></svg>;
  if (kind === 'pdf') return <svg width={w} height={h} viewBox="0 0 18 18" fill="none"><path d="M4 2h7l3 3v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth={sw} strokeLinejoin="round"/><path d="M11 2v3h3" stroke="currentColor" strokeWidth={sw} strokeLinejoin="round"/></svg>;
  if (kind === 'mask') return <svg width={w} height={h} viewBox="0 0 18 18" fill="none"><path d="M2 9s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5Z" stroke="currentColor" strokeWidth={sw}/><circle cx="9" cy="9" r="2" stroke="currentColor" strokeWidth={sw}/><path d="M3 3l12 12" stroke="currentColor" strokeWidth={sw} strokeLinecap="round"/></svg>;
  if (kind === 'lock') return <svg width={w} height={h} viewBox="0 0 18 18" fill="none"><rect x="3.5" y="8" width="11" height="7.5" rx="1.5" stroke="currentColor" strokeWidth={sw}/><path d="M6 8V5.5a3 3 0 0 1 6 0V8" stroke="currentColor" strokeWidth={sw}/></svg>;
  return null;
}

function FeatVisual({ kind }: { kind: string }) {
  if (kind === 'shot') return (
    <div className="visual">
      <div style={{ position: 'absolute', left: 14, bottom: 14, right: 50, top: 14, background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ height: 16, background: 'var(--bg-2)', borderBottom: '1px solid var(--line)' }}></div>
        <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ height: 8, width: '70%', borderRadius: 3, background: 'var(--bg-3)' }}></div>
          <div style={{ height: 8, width: '50%', borderRadius: 3, background: 'var(--bg-3)' }}></div>
          <div style={{ height: 28, borderRadius: 4, background: 'linear-gradient(135deg, var(--bg-2), var(--bg-3))', marginTop: 4 }}></div>
        </div>
      </div>
      {[{ x: '70%', y: '30%', n: 1 }, { x: '82%', y: '62%', n: 2 }].map((p, i) => (
        <span key={i} style={{ position: 'absolute', left: p.x, top: p.y, transform: 'translate(-50%,-50%)', width: 26, height: 26, borderRadius: '50%', background: 'transparent', color: 'oklch(0.50 0.20 25)', border: '2px solid oklch(0.58 0.20 25)', display: 'grid', placeItems: 'center', fontSize: 11, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, boxShadow: '0 0 0 3px color-mix(in oklab, oklch(0.58 0.20 25) 14%, transparent)' }}>{p.n}</span>
      ))}
    </div>
  );
  if (kind === 'ai') return (
    <div className="visual" style={{ padding: 14 }}>
      <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 8, padding: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent-ink)', background: 'var(--accent-soft)', border: '1px solid color-mix(in oklab, var(--accent) 18%, transparent)', padding: '2px 6px', borderRadius: 4 }}>Gemini AI</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)' }}>step_02.png</span>
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          <span style={{ width: 16, height: 16, borderRadius: '50%', background: 'transparent', color: 'oklch(0.50 0.20 25)', border: '1.5px solid oklch(0.58 0.20 25)', display: 'grid', placeItems: 'center', fontSize: 9, fontFamily: 'monospace', fontWeight: 600 }}>2</span>
          <span style={{ color: 'var(--ink)', fontWeight: 500, fontSize: 12 }}>設定アイコンをクリック</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.55 }}>右上の歯車アイコンをクリックすると、設定パネルが開きます。</div>
      </div>
    </div>
  );
  if (kind === 'notion') return (
    <div className="visual" style={{ padding: 14 }}>
      <div style={{ position: 'absolute', inset: 14, background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 8, padding: 10 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--ink-4)', marginBottom: 8 }}>NOTION.SO</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ height: 8, borderRadius: 2, background: 'var(--bg-3)', width: '80%' }}></div>
          <div style={{ height: 6, borderRadius: 2, background: 'var(--bg-3)', width: '60%' }}></div>
          <div style={{ height: 22, borderRadius: 4, background: 'linear-gradient(135deg, var(--bg-2), var(--bg-3))', marginTop: 4 }}></div>
        </div>
      </div>
    </div>
  );
  if (kind === 'pdf') return (
    <div className="visual">
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%) rotate(-3deg)', width: 90, height: 110, background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 4, padding: 8, fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--ink-4)', boxShadow: 'var(--shadow-md)' }}>
        PDF
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 6 }}>
          {[80, 60, 70, 40, 75, 55].map((w, i) => (
            <div key={i} style={{ height: 4, background: 'var(--bg-3)', width: `${w}%` }}></div>
          ))}
        </div>
      </div>
    </div>
  );
  if (kind === 'mask') return (
    <div className="visual" style={{ padding: 14, display: 'grid', placeItems: 'center' }}>
      <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 6, padding: '8px 10px', fontFamily: 'var(--font-mono)', display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11 }}>
        <span>email: <span style={{ background: 'var(--ink)', color: 'var(--ink)', borderRadius: 2, padding: '0 16px', filter: 'blur(2px)' }}>·····</span></span>
        <span>card:&nbsp; <span style={{ background: 'var(--ink)', color: 'var(--ink)', borderRadius: 2, padding: '0 28px', filter: 'blur(2px)' }}>·····</span></span>
        <span>name:&nbsp; <span style={{ background: 'var(--ink)', color: 'var(--ink)', borderRadius: 2, padding: '0 22px', filter: 'blur(2px)' }}>·····</span></span>
      </div>
    </div>
  );
  if (kind === 'lock') return (
    <div className="visual" style={{ display: 'grid', placeItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>
        <span style={{ padding: '6px 10px', background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 6 }}>browser</span>
        <span>—</span>
        <span style={{ padding: '6px 10px', background: 'var(--paper)', border: '1px dashed var(--line-2)', borderRadius: 6, color: 'var(--ink-4)', textDecoration: 'line-through' }}>our&nbsp;server</span>
        <span>→</span>
        <span style={{ padding: '6px 10px', background: 'var(--ink)', color: 'var(--paper)', borderRadius: 6 }}>your Notion</span>
      </div>
    </div>
  );
  return <div className="visual"></div>;
}

// ── Page ────────────────────────────────────────────────────────

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const lang: Lang = locale === 'en' ? 'en' : 'ja';
  const c: Copy = COPY[lang];

  return (
    <div className="lp-page">

      {/* ═══ HERO ═══════════════════════════════════════════════ */}

      <section className="hero">
        <div className="lp-container">
          <div className="hero-grid">
            <div>
              <span className="eyebrow">
                <span className="dot"></span>
                {c.hero.eyebrow}
              </span>
              <h1 className="h1">
                <span className="accent">{c.hero.h1Pre}</span>
                <em>{c.hero.h1Em}</em>
                <span className="accent">{c.hero.h1Post}</span>
              </h1>
              <p className="lede">{c.hero.lede}</p>
              <div className="cta-row">
                <a href={STORE_URL} className="btn btn-primary btn-lg" target="_blank" rel="noopener noreferrer">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ marginRight: 2 }}>
                    <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.3" opacity="0.4"/>
                    <circle cx="7" cy="7" r="2.4" fill="currentColor"/>
                  </svg>
                  {c.hero.ctaPrimary}
                </a>
                <a href="https://github.com/zuu0906/notion-manual-maker/releases/latest" className="btn btn-ghost btn-lg" target="_blank" rel="noopener noreferrer">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <rect x="1" y="2" width="12" height="8" rx="1" stroke="currentColor" strokeWidth="1.3"/>
                    <path d="M4 12h6M7 10v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                  {c.hero.ctaDesktop} ↓
                </a>
              </div>
              <div className="trust">
                {c.hero.trust.map((t, i) => (
                  <span key={i}>
                    <span className="check">
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                        <path d="M2.5 7L5.5 10L10.5 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                    {t}
                  </span>
                ))}
              </div>
            </div>

            <HeroStage copy={c.hero.stage} />
          </div>

          <div className="hero-stats">
            {c.hero.stats.map((s, i) => (
              <div key={i} className="hero-stat">
                <span className="tag">{`0${i + 1}`}</span>
                <div className="v">{s.v}<sup>{s.suf}</sup></div>
                <div className="l">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ TRUST BAR ══════════════════════════════════════════ */}
      <TrustBar locale={locale} />

      {/* ═══ PROBLEM ════════════════════════════════════════════ */}
      <section className="section" id="problem">
        <div className="lp-container">
          <Eyebrow>{c.problem.tag}</Eyebrow>
          <h2 className="h2">{c.problem.h2}</h2>
          <p className="section-lede">{c.problem.lede}</p>
          <div className="problem-grid">
            {c.problem.cells.map((cell, i) => (
              <div key={i} className="problem-cell">
                <div className="x">{cell.x}</div>
                <div className="kanji"><span className="strike">{cell.t}</span></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══════════════════════════════════════ */}
      <section className="section" id="how" style={{ background: 'var(--bg-2)', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
        <div className="lp-container">
          <Eyebrow>{c.how.tag}</Eyebrow>
          <h2 className="h2">{c.how.h2}</h2>
          <p className="section-lede">{c.how.lede}</p>
          <div className="steps">
            {c.how.steps.map((s, i) => (
              <div key={i} className="step">
                <div className="num-lg">{s.n}</div>
                <h3>{s.t}</h3>
                <p>{s.d}</p>
                <StepVisual idx={i} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ DESKTOP APP ═══════════════════════════════════════ */}
      <section className="section" id="desktop" style={{ background: 'var(--bg-2)', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
        <div className="lp-container">
          <Eyebrow>{c.desktop.tag}</Eyebrow>
          <h2 className="h2">{c.desktop.h2}</h2>
          <p className="section-lede">{c.desktop.lede}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginTop: 32 }}>
            {c.desktop.items.map((it, i) => (
              <div key={i} className="desktop-item">
                <h3>{it.t}</h3>
                <p>{it.d}</p>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 32, display: 'flex', alignItems: 'center', gap: 16 }}>
            <a href="https://github.com/zuu0906/notion-manual-maker/releases/latest" target="_blank" rel="noopener noreferrer"
              className="btn btn-primary btn-lg">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="2" width="12" height="8" rx="1" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M4 12h6M7 10v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              {c.desktop.cta}
            </a>
            <span style={{ fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{c.desktop.note}</span>
          </div>
        </div>
      </section>

      {/* ═══ BEFORE / AFTER ══════════════════════════════════ */}
      <section className="section" id="ba">
        <div className="lp-container">
          <Eyebrow>{c.ba.tag}</Eyebrow>
          <h2 className="h2">{c.ba.h2}</h2>
          <div className="ba">
            <div className="ba-col">
              <div className="ba-head">
                <div className="ba-label">{c.ba.before.label}</div>
                <div className="ba-time">{c.ba.before.time}</div>
              </div>
              <ul className="ba-list">
                {c.ba.before.items.map((t, i) => (
                  <li key={i}><span className="mark x">×</span><span style={{ color: 'var(--ink-3)' }}>{t}</span></li>
                ))}
              </ul>
            </div>
            <div className="ba-col">
              <div className="ba-head">
                <div className="ba-label" style={{ color: 'var(--accent-ink)' }}>{c.ba.after.label}</div>
                <div className="ba-time">{c.ba.after.time}</div>
              </div>
              <ul className="ba-list">
                {c.ba.after.items.map((t, i) => (
                  <li key={i}><span className="mark o">✓</span><span>{t}</span></li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FEATURES ════════════════════════════════════════ */}
      <section className="section" id="features">
        <div className="lp-container">
          <Eyebrow>{c.feat.tag}</Eyebrow>
          <h2 className="h2">{c.feat.h2}</h2>
          <p className="section-lede">{c.feat.lede}</p>
          <div className="features">
            {c.feat.items.map((it, i) => (
              <article key={i} className={'feat ' + it.size}>
                <span className="ico"><FeatIcon kind={it.visual} /></span>
                <h3>{it.t}</h3>
                <p>{it.d}</p>
                <FeatVisual kind={it.visual} />
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PRICING ═════════════════════════════════════════ */}
      <section className="section" id="pricing" style={{ background: 'var(--bg-2)', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
        <div className="lp-container">
          <Eyebrow>{c.pricing.tag}</Eyebrow>
          <h2 className="h2">{c.pricing.h2}</h2>
          <p className="section-lede">{c.pricing.lede}</p>
          <div className="pricing">
            {c.pricing.plans.map((p, i) => (
              <div key={i} className={'plan ' + (p.featured ? 'featured' : '')}>
                {'ribbon' in p && p.ribbon && <span className="ribbon">{p.ribbon}</span>}
                <div className="name">{p.name}</div>
                <div className="price">{p.price}<small>{p.per}</small></div>
                <div className="desc">{p.desc}</div>
                <ul>
                  {p.features.map((f, j) => (
                    <li key={j}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M2.5 7.5L5.5 10.5L11.5 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <a href={p.featured ? '/dashboard' : STORE_URL}
                   className={'btn btn-lg ' + (p.featured ? 'btn-primary' : 'btn-ghost')}
                   target={p.featured ? undefined : '_blank'}
                   rel={p.featured ? undefined : 'noopener noreferrer'}>
                  {p.cta}
                </a>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 24, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-4)', letterSpacing: '.05em' }}>
            {c.pricing.foot}
          </div>
        </div>
      </section>

      {/* ═══ FAQ ══════════════════════════════════════════════ */}
      <section className="section" id="faq">
        <div className="lp-container faq-container">
          <Eyebrow>{c.faq.tag}</Eyebrow>
          <h2 className="h2">{c.faq.h2}</h2>
          <div className="faq">
            {c.faq.items.map((it, i) => (
              <details key={i}>
                <summary>
                  <span>{it.q}</span>
                  <span className="plus">+</span>
                </summary>
                <div className="ans">{it.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FINAL CTA ════════════════════════════════════════ */}
      <section className="lp-container" id="cta">
        <div className="final-cta">
          <div className="final-cta-inner">
            <div>
              <h2>{c.final.h2}</h2>
              <p>{c.final.lede}</p>
            </div>
            <div className="actions">
              <a href={STORE_URL} className="btn btn-primary btn-lg" target="_blank" rel="noopener noreferrer">
                {c.final.ctaPrimary}
              </a>
              <div className="small">{c.final.foot}</div>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
