import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '使い方',
  description: 'Chrome Manual Makerの使い方。インストールからNotionへの保存まで3ステップで完了。スクリーンショットと矢印で操作マニュアルを自動作成。',
  alternates: { canonical: '/how-it-works' },
};

const steps = [
  {
    n: 1,
    title: 'インストールとNotion接続',
    desc: 'Chrome ウェブストアから拡張機能を追加。ポップアップの「接続」ボタンでNotionのワークスペースを連携します。',
    detail: [
      'Chromeウェブストアで「Chrome Manual Maker」を検索',
      '「Chromeに追加」をクリック',
      'ツールバーのアイコン → 「接続」→ Notionにログイン',
      'ワークスペース連携を許可して完了',
    ],
  },
  {
    n: 2,
    title: '記録したい画面でクリック',
    desc: 'ポップアップの「記録開始」を押すと画面が記録モードに。説明したい箇所を順番にクリックするだけ。',
    detail: [
      '「記録開始」を押すと画面がやや暗くなる',
      '手順①の操作箇所をクリック → スクショ+矢印が自動生成',
      '手順②③…と続けてクリック',
      'Escキーまたは「記録停止」で終了',
    ],
  },
  {
    n: 3,
    title: 'Notionへ保存',
    desc: '各ステップにラベルを追加して「Notionへ保存」。画像ブロック＋テキストが指定ページに自動追加されます。',
    detail: [
      'ポップアップのステップ一覧でラベルを入力（省略可）',
      'ページタイトルを入力（省略すると日付が自動入力）',
      '「Notionへ保存」をクリック',
      'Notionページに画像+テキストブロックが追加',
    ],
  },
];

export default function HowItWorksPage() {
  return (
    <section className="max-w-3xl mx-auto px-4 py-20">
      <div className="text-center mb-14">
        <h1 className="text-3xl font-bold mb-4">3ステップで操作マニュアルを作成</h1>
        <p className="text-gray-500">インストールからNotion保存まで5分以内に完了します</p>
      </div>

      <div className="flex flex-col gap-14">
        {steps.map((step) => (
          <div key={step.n} className="flex gap-8">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-brand text-white font-bold text-lg flex items-center justify-center">
                {step.n}
              </div>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold mb-2">{step.title}</h2>
              <p className="text-gray-600 mb-4 leading-relaxed">{step.desc}</p>
              <ul className="flex flex-col gap-2">
                {step.detail.map((d, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="text-brand font-bold mt-0.5">{i + 1}.</span>
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
          href="https://chrome.google.com/webstore"
          className="bg-brand text-white px-8 py-3.5 rounded-full font-semibold text-base hover:opacity-90 transition"
          target="_blank"
          rel="noopener noreferrer"
        >
          無料でインストール
        </a>
      </div>
    </section>
  );
}
