// 記事テーマ一覧（SEOキーワード重視・Notion Manual Maker導線付き）
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

  // ── マニュアル作成全般（Notionなし・幅広い流入） ────────────────
  { title: '業務マニュアルの作り方｜ゼロから整備する6ステップ', keyword: '業務マニュアル 作り方' },
  { title: '操作マニュアルのテンプレート｜すぐ使える無料フォーマット', keyword: '操作マニュアル テンプレート 無料' },
  { title: '引き継ぎ資料の作り方｜後任が迷わないドキュメント術', keyword: '引き継ぎ資料 作り方' },
  { title: 'SOPとは？標準作業手順書の作り方・テンプレート', keyword: 'SOP 作成 テンプレート' },
  { title: 'マニュアル作成ツール8選｜目的別おすすめを比較', keyword: 'マニュアル作成 ツール おすすめ' },
  { title: 'ITシステムの操作マニュアルを作る方法と注意点', keyword: 'ITシステム 操作マニュアル 作り方' },
  { title: 'マニュアルが読まれない理由と改善策｜わかりやすい構成のコツ', keyword: 'マニュアル わかりやすい 作り方' },
  { title: 'Word・Excel vs ツール｜マニュアル作成に適した選び方', keyword: 'マニュアル Word Excel どちら' },

  // ── スクリーンショット・画像注釈ツール ───────────────────────────
  { title: 'スクリーンショットに矢印・テキストを入れる方法まとめ', keyword: 'スクリーンショット 矢印 テキスト 入れる' },
  { title: '無料で使えるスクリーンショットツール5選【Windows・Mac】', keyword: 'スクリーンショット ツール 無料 おすすめ' },
  { title: '画面キャプチャを自動化する方法｜手順書作成を10倍速に', keyword: '画面キャプチャ 自動化 方法' },
  { title: 'スクリーンショットをクラウド保存・共有する方法', keyword: 'スクリーンショット クラウド 保存 共有' },
  { title: 'Snagitの代替になる無料ツール5選', keyword: 'Snagit 代替 無料' },
  { title: 'Gyazoとは？使い方・料金・ビジネス活用まとめ', keyword: 'Gyazo 使い方 ビジネス' },
  { title: '画像に注釈・コメントを入れるツール比較', keyword: '画像 注釈 ツール 比較' },
  { title: '手順書にスクリーンショットを貼る最速ワークフロー', keyword: '手順書 スクリーンショット 貼り付け 効率' },

  // ── 社内ドキュメント・ナレッジ管理 ──────────────────────────────
  { title: '社内ナレッジ管理ツール比較｜Notion・Confluence・esa', keyword: '社内ナレッジ 管理 ツール 比較' },
  { title: '社内Wikiを整備する方法｜情報が属人化しない仕組み', keyword: '社内Wiki 作り方 整備' },
  { title: 'ドキュメント管理ツールの選び方｜中小企業向けガイド', keyword: 'ドキュメント管理 ツール 中小企業' },
  { title: '暗黙知を形式知化する方法｜マニュアル化のステップ', keyword: '暗黙知 形式知 マニュアル化' },
  { title: '社内情報共有が上手くいかない原因と解決策', keyword: '社内情報共有 うまくいかない 解決' },
  { title: 'ナレッジベースを構築するメリットと手順', keyword: 'ナレッジベース 構築 方法' },

  // ── 業務効率化・DX ──────────────────────────────────────────────
  { title: 'バックオフィス業務を効率化するツール7選', keyword: 'バックオフィス 効率化 ツール' },
  { title: 'テレワーク対応の業務マニュアル整備方法', keyword: 'テレワーク マニュアル 整備' },
  { title: 'ペーパーレス化を進める社内ドキュメント管理術', keyword: 'ペーパーレス ドキュメント管理 方法' },
  { title: '中小企業のDX推進｜まず着手すべきドキュメント整備', keyword: '中小企業 DX ドキュメント' },

  // ── Chrome拡張機能 ────────────────────────────────────────────────
  { title: 'ビジネスに役立つChrome拡張機能おすすめ15選', keyword: 'Chrome拡張 ビジネス おすすめ' },
  { title: 'Notionと連携できるChrome拡張機能まとめ', keyword: 'Notion Chrome拡張 連携 おすすめ' },
  { title: 'Chrome拡張機能でスクリーンショット業務を自動化する方法', keyword: 'Chrome拡張 スクリーンショット 自動化' },

  // ── 競合ツール比較（比較記事経由で流入） ──────────────────────────
  { title: 'Confluenceとは？Notionとの違い・移行方法を解説', keyword: 'Confluence Notion 移行 比較' },
  { title: 'esaとNotionの違い｜チームに合ったWikiツールの選び方', keyword: 'esa Notion 比較' },
  { title: 'Backlog WikiとNotionの違い｜エンジニアチームの選び方', keyword: 'Backlog Wiki Notion 比較' },
  { title: 'Scribeとは？自動手順書作成ツールの使い方と料金', keyword: 'Scribe 使い方 料金 日本語' },
  { title: 'Loomとは？動画マニュアル作成ツールの使い方', keyword: 'Loom 使い方 日本語' },

  // ── 新人教育・OJT（広い流入・CTA挿入しやすい） ───────────────────
  { title: 'OJTの進め方｜新入社員が即戦力になる教育計画テンプレ', keyword: 'OJT 進め方 新入社員' },
  { title: '新人教育マニュアルの作り方｜1から整備する6ステップ', keyword: '新人教育 マニュアル 作り方' },
  { title: '社員教育を効率化する方法｜担当者の負担を半減させるコツ', keyword: '社員教育 効率化 方法' },
  { title: 'オンボーディングを仕組み化する方法｜即戦力育成の手順', keyword: 'オンボーディング 仕組み 作り方' },
  { title: '新人が覚えられない原因とは？伝わるマニュアルの作り方', keyword: '新人 覚えられない マニュアル' },

  // ── 引き継ぎ・属人化解消 ────────────────────────────────────────
  { title: '業務の属人化を解消する方法｜マニュアル化の進め方', keyword: '属人化 解消 マニュアル化' },
  { title: '退職前の引き継ぎを完璧にする資料作成チェックリスト', keyword: '退職 引き継ぎ 資料 作り方' },
  { title: '業務標準化の進め方｜誰でも同じ品質でできる仕組みを作る', keyword: '業務標準化 進め方' },
  { title: 'スキル継承を仕組み化する方法｜ベテランの技術を残す', keyword: 'スキル継承 仕組み化 方法' },

  // ── 資料・説明をわかりやすくする ──────────────────────────────────
  { title: 'わかりやすい説明資料の作り方｜伝わる構成と表現のコツ', keyword: 'わかりやすい資料 作り方 ビジネス' },
  { title: '図解でわかりやすく説明する方法｜ビジネス資料に使えるテクニック', keyword: '図解 説明 わかりやすい 作り方' },
  { title: '口頭説明より伝わる！画像・スクリーンショットを使った手順書', keyword: '手順書 画像 わかりやすい 作り方' },
  { title: 'ビジュアルマニュアルの作り方｜テキストだけでは伝わらない業務説明', keyword: 'ビジュアルマニュアル 作り方' },

  // ── リモートワーク・非同期コミュニケーション ───────────────────────
  { title: 'テレワークで業務マニュアルを整備する方法', keyword: 'テレワーク 業務マニュアル 整備' },
  { title: '非同期コミュニケーションを成功させるドキュメント術', keyword: '非同期コミュニケーション ドキュメント 方法' },
  { title: 'リモートチームの情報共有を仕組み化する5つの方法', keyword: 'リモートチーム 情報共有 仕組み' },

  // ── 職場の問題解決（広い流入） ──────────────────────────────────
  { title: '仕事のミスを減らす方法｜チェックリストとマニュアルの活用', keyword: '仕事 ミス 減らす 方法' },
  { title: '業務改善の進め方｜問題を見える化して仕組みで解決する', keyword: '業務改善 進め方 仕組み' },
  { title: '同じ質問が繰り返される職場を変える｜FAQとマニュアルの整備', keyword: '同じ質問 繰り返す 職場 解決' },

  // ── 新規発掘キーワード（2026-05-20 discover-keywords.js） ──────────
  { title: 'マニュアル作成ツールおすすめ5選｜Notion連携で効率化', keyword: 'マニュアル 作成 おすすめ ツール' },
  { title: '新人教育マニュアルのテンプレート集｜すぐ使えるNotionフォーマット', keyword: '新人教育 マニュアル テンプレート' },
  { title: 'OJTマニュアルのテンプレート｜新人が迷わない手順書の作り方', keyword: 'ojt マニュアル テンプレート' },
  { title: 'NotionでつくるWiki完全ガイド｜社内情報をスクリーンショットで整理', keyword: '社内wiki 作り方 notion' },
  { title: 'Notionマニュアルテンプレート集｜業務別にすぐ使える', keyword: 'notion マニュアル テンプレート' },
  { title: '事務マニュアルのテンプレート｜Notionで使える業務別フォーマット', keyword: '業務マニュアル 作り方 事務 テンプレート' },
  { title: '手順書の作り方とコツ｜読まれるマニュアルの構成を解説', keyword: '手順書 作り方 コツ' },
  { title: '業務引継ぎ資料の作り方｜Notionで丸ごと引き継ぐ方法', keyword: '業務 引継ぎ 資料 作り方' },
  { title: '社内Wikiの作り方｜Notionで始める情報共有の仕組み', keyword: '社内wiki 作り方' },
  { title: '無料で社内Wikiを作る方法｜Notionの無料プランで始める', keyword: '社内wiki 作り方 無料' },
];

module.exports = THEMES;
