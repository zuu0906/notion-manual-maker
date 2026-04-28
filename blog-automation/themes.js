// 記事テーマ一覧（SEOキーワード重視・Chrome Manual Maker導線付き）
const THEMES = [
  // ── Notion 基礎・入門 ──────────────────────────────
  { title: 'Notionとは？2026年版・初心者向け完全ガイド', keyword: 'Notion 使い方' },
  { title: 'Notionの始め方｜無料プランでできること・できないこと徹底解説', keyword: 'Notion 無料' },
  { title: 'Notionページの作り方｜基本操作から応用まで', keyword: 'Notionページ 作り方' },
  { title: 'Notionブロックとは？種類と使い方を全解説', keyword: 'Notionブロック' },
  { title: 'NotionのショートカットキーまとめTOP30', keyword: 'Notion ショートカット' },
  { title: 'Notionテンプレートの使い方・作り方・共有方法', keyword: 'Notionテンプレート' },
  { title: 'Notionのワークスペースとは？設定・管理方法を解説', keyword: 'Notionワークスペース' },

  // ── Notion データベース ────────────────────────────
  { title: 'Notionデータベースの作り方・活用事例6選', keyword: 'Notionデータベース 使い方' },
  { title: 'Notionフィルター・ソートの使い方｜データ管理を効率化', keyword: 'Notionフィルター' },
  { title: 'Notionリレーション機能とは？データ連携の設定方法', keyword: 'Notionリレーション' },
  { title: 'Notionロールアップで集計・分析する方法', keyword: 'Notionロールアップ' },
  { title: 'Notionカレンダービューで日程管理する方法', keyword: 'Notionカレンダー' },
  { title: 'NotionギャラリービューでポートフォリオやWikiを作る方法', keyword: 'Notionギャラリー' },
  { title: 'Notionボードビューでタスク管理する方法（カンバン式）', keyword: 'Notionボード タスク管理' },

  // ── マニュアル・手順書作成 ─────────────────────────
  { title: 'Notionでマニュアルを作る方法｜テンプレート付きで解説', keyword: 'Notion マニュアル 作り方' },
  { title: 'Notionで業務手順書を作る5つのコツ', keyword: 'Notion 手順書' },
  { title: 'Notionで操作マニュアルを作成する方法｜スクリーンショット活用術', keyword: 'Notion 操作マニュアル' },
  { title: 'Notionで社内Wikiを構築する方法｜情報共有を仕組み化', keyword: 'Notion 社内Wiki' },
  { title: 'Notionでシステム操作マニュアルを作る際の注意点', keyword: 'Notionシステムマニュアル' },
  { title: 'Notionマニュアルにスクリーンショットを効率よく貼る方法', keyword: 'Notion スクリーンショット 貼り付け' },
  { title: '業務マニュアル作成ツール比較｜Notion vs Word vs Confluence', keyword: '業務マニュアル ツール 比較' },
  { title: 'マニュアル作成を10倍速にする方法｜スクリーンショット自動化', keyword: 'マニュアル作成 効率化' },
  { title: 'スクリーンショットに矢印・注釈を入れる方法【Notion連携】', keyword: 'スクリーンショット 注釈 Notion' },
  { title: 'Notionでマニュアルをチームに共有する方法・権限設定', keyword: 'Notion マニュアル 共有' },

  // ── 業務効率化 ────────────────────────────────────
  { title: 'Notionで仕事を効率化する10の方法', keyword: 'Notion 業務効率化' },
  { title: 'NotionでTODO管理｜タスクが抜けない仕組みの作り方', keyword: 'Notion TODO 管理' },
  { title: 'Notionで議事録を管理・共有する方法', keyword: 'Notion 議事録' },
  { title: 'Notionでプロジェクト管理する方法｜ガントチャートも解説', keyword: 'Notion プロジェクト管理' },
  { title: 'Notionで日報・週報テンプレートを作る方法', keyword: 'Notion 日報 テンプレート' },
  { title: 'Notionで採用管理データベースを作る方法', keyword: 'Notion 採用管理' },
  { title: 'Notionで顧客管理（CRM）を構築する方法', keyword: 'Notion CRM 顧客管理' },
  { title: 'NotionでナレッジベースをAIで自動整理する方法', keyword: 'Notion ナレッジベース' },

  // ── チーム・法人活用 ──────────────────────────────
  { title: 'Notionのチームプランとは？法人向け機能を解説', keyword: 'Notion チームプラン 法人' },
  { title: 'Notionで新入社員の研修マニュアルを作る方法', keyword: 'Notion 研修マニュアル 新入社員' },
  { title: 'Notionでオンボーディング資料を作成・共有する方法', keyword: 'Notion オンボーディング' },
  { title: 'Notionのゲスト招待機能｜外部メンバーとの共有方法', keyword: 'Notion ゲスト 共有' },
  { title: 'Notionで部署ごとのナレッジ管理をする方法', keyword: 'Notion 部署 ナレッジ管理' },

  // ── Notion AI ─────────────────────────────────────
  { title: 'Notion AIとは？使い方・料金・活用事例まとめ', keyword: 'Notion AI 使い方' },
  { title: 'Notion AIで議事録・レポートを自動作成する方法', keyword: 'Notion AI 議事録 自動' },
  { title: 'Notion AIとChatGPTの違い｜どちらを使うべきか', keyword: 'Notion AI ChatGPT 比較' },

  // ── Notion 連携・自動化 ───────────────────────────
  { title: 'NotionとSlackを連携する方法｜通知・自動化を設定', keyword: 'Notion Slack 連携' },
  { title: 'NotionとGoogleカレンダーを連携する方法', keyword: 'Notion Googleカレンダー 連携' },
  { title: 'NotionのAPIで自動化する方法｜初心者向けガイド', keyword: 'Notion API 使い方' },
  { title: 'NotionとZapierで業務を自動化する方法', keyword: 'Notion Zapier 自動化' },
  { title: 'NotionとChrome拡張機能を組み合わせて効率化する方法', keyword: 'Notion Chrome拡張 効率化' },

  // ── 比較・選び方 ──────────────────────────────────
  { title: 'NotionとConfluenceどちらを選ぶ？用途別比較', keyword: 'Notion Confluence 比較' },
  { title: 'NotionとEvernoteの違い｜移行方法も解説', keyword: 'Notion Evernote 比較' },
  { title: 'NotionとGoogle Docsの違いと使い分け', keyword: 'Notion Google Docs 比較' },
  { title: 'NotionとClickUpの違い｜プロジェクト管理ツール比較', keyword: 'Notion ClickUp 比較' },

  // ── 問題解決・Tips ────────────────────────────────
  { title: 'Notionが重い・遅いときの対処法まとめ', keyword: 'Notion 重い 遅い 対処' },
  { title: 'Notionの便利な使い方25選｜知らないと損する機能', keyword: 'Notion 便利な使い方' },
  { title: 'Notionでスクリーンショット管理をスマートにする方法', keyword: 'Notion スクリーンショット 管理' },
  { title: 'Notionページが見づらい→デザインをキレイに整える方法', keyword: 'Notion デザイン 見やすい' },
  { title: 'Notionの埋め込み機能でリッチなページを作る方法', keyword: 'Notion 埋め込み' },
  { title: 'NotionのWebクリッパーでWebページを保存する方法', keyword: 'Notion Webクリッパー' },

  // ── SEO・ライティング ─────────────────────────────
  { title: 'NotionでSEOコンテンツ管理する方法｜キーワード一覧テンプレ付き', keyword: 'Notion SEO コンテンツ管理' },
  { title: 'NotionでブログのネタをAI管理する方法', keyword: 'Notion ブログ管理 AI' },
];

module.exports = THEMES;
