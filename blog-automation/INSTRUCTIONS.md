# ブログ自動投稿 + SEO PDCA 指示書

## 概要

Notion関連記事を毎日1本自動生成してs-tasklog.comのWordPressに投稿する。
Claude APIで記事生成 → Pollinations.ai（無料）で挿絵生成 → WordPress REST APIで投稿。

**PDCAサイクル（全て無料）:**
- Plan: SERP競合分析 → アウトライン生成
- Do: 記事生成・投稿
- Check: Google Search Console APIで掲載順位・CTR取得
- Act: 低パフォーマンス記事のリライト提案

---

## ファイル構成

```
blog-automation/
├── create-post.js        # メインスクリプト（アウトライン対応）
├── themes.js             # 記事テーマ一覧（60本）
├── analyze-serp.js       # [PLAN] Playwright SERP競合分析
├── generate-outline.js   # [PLAN] ClaudeでSEO最適化アウトライン生成
├── fetch-gsc-data.js     # [CHECK] Google Search Console APIデータ取得
├── rewrite-analyzer.js   # [ACT] 低パフォーマンス記事のリライト提案
├── gsc-setup.js          # GSC OAuth2 セットアップヘルパー
├── package.json
├── .env                  # 環境変数（Git管理外）
├── .env.example          # テンプレート
├── .used-themes.json     # 使用済みテーマ記録（自動生成）
├── performance.json      # 掲載順位・CTR追跡（自動生成）
├── serp-cache/           # SERPスクレイピング結果キャッシュ（自動生成）
└── outlines/             # 生成済みアウトライン（自動生成）

.github/workflows/
├── daily-blog-post.yml   # 毎日 09:00 JST 記事投稿
├── weekly-seo-check.yml  # 毎週月曜 GSC取得 + リライト提案Issue作成
└── manual-serp-analysis.yml # 手動: SERP分析 + アウトライン生成
```

---

## 環境変数（.env）

```
# 必須
ANTHROPIC_API_KEY=sk-ant-xxxxx
WP_URL=https://s-tasklog.com
WP_USERNAME=WordPressユーザー名
WP_APP_PASSWORD=xxxx xxxx xxxx xxxx
WP_CATEGORY_ID=1

# GSC用（fetch-gsc-data.js 使用時）
GSC_SITE_URL=https://s-tasklog.com/
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx
GOOGLE_REFRESH_TOKEN=1//xxx
```

---

## GitHub Secrets 設定

| Secret名 | 内容 |
|----------|------|
| `ANTHROPIC_API_KEY` | Claude APIキー |
| `WP_URL` | WordPress URL |
| `WP_USERNAME` | WordPressユーザー名 |
| `WP_APP_PASSWORD` | アプリケーションパスワード |
| `WP_CATEGORY_ID` | 投稿カテゴリID |
| `GSC_SITE_URL` | GSCに登録したサイトURL |
| `GOOGLE_CLIENT_ID` | OAuth2クライアントID |
| `GOOGLE_CLIENT_SECRET` | OAuth2クライアントシークレット |
| `GOOGLE_REFRESH_TOKEN` | OAuth2リフレッシュトークン |

---

## 使い方

### PDCA サイクル

#### [PLAN] SERP競合分析（週1回程度）

```bash
# Playwright初回インストール（ローカル）
npm install playwright
npx playwright install chromium

# 特定キーワードを分析
node analyze-serp.js "Notion マニュアル 作り方"

# themes.jsの特定インデックス
node analyze-serp.js --index 5

# または GitHub Actions で手動実行
# Actions → SERP競合分析（手動）→ Run workflow
```

#### [PLAN] アウトライン生成

```bash
# SERPキャッシュを元にアウトライン生成
node generate-outline.js "Notion マニュアル 作り方"
node generate-outline.js --index 5
```

#### [DO] 記事生成・投稿

```bash
# 通常投稿（アウトラインがあれば自動使用）
node create-post.js

# 特定テーマ指定
node create-post.js --index 5

# 内容確認のみ（WordPress投稿なし）
node create-post.js --dry-run
```

#### [CHECK] GSCデータ取得（週1回・要GSC設定）

```bash
node fetch-gsc-data.js
node fetch-gsc-data.js --days 90   # 90日分
```

#### [ACT] リライト提案

```bash
# コンソール出力
node rewrite-analyzer.js

# ファイル保存
node rewrite-analyzer.js --output report.md

# GitHub Issue作成（CI環境用）
node rewrite-analyzer.js --github-issue
```

---

## GSC セットアップ（初回のみ）

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクト作成
2. APIs & Services → Enable APIs → **Google Search Console API** を有効化
3. APIs & Services → Credentials → Create Credentials → **OAuth client ID**
   - Application type: **Desktop app**
4. クライアントIDとシークレットを `.env` に設定
5. 認証URLを取得:
   ```bash
   node gsc-setup.js
   ```
6. 表示されたURLをブラウザで開いて認証
7. 表示されたコードを使ってRefresh Tokenを取得:
   ```bash
   node gsc-setup.js --code "認証コード"
   ```
8. 表示された `GOOGLE_REFRESH_TOKEN` を `.env` と GitHub Secrets に追加

---

## 自動ワークフロー

| ワークフロー | スケジュール | 内容 |
|-------------|------------|------|
| `daily-blog-post.yml` | 毎日 09:00 JST | アウトライン生成（キャッシュあれば）→ 記事投稿 |
| `weekly-seo-check.yml` | 毎週月曜 10:00 JST | GSCデータ取得 → リライト提案 → GitHub Issue作成 |
| `manual-serp-analysis.yml` | 手動のみ | SERP競合分析 → アウトライン生成 |

---

## 推奨ワークフロー

```
月曜: weekly-seo-check が自動実行
       └─ GitHub Issueで低パフォーマンス記事の改善提案を確認

週1〜2回: Actions → SERP競合分析 を手動実行
           └─ S優先テーマ（1〜7番）を重点的に

毎日: daily-blog-post が自動実行
      └─ SERPキャッシュがあればアウトライン付きの高品質記事を生成
```

---

## 記事仕様

- 文字数: 1800〜2200文字（アウトラインがある場合は指定文字数に従う）
- 構成: リード文 → H2×4〜5 → 中盤CTA → 末尾CTA → まとめ
- CTA: 中盤と末尾の2箇所にChrome Manual Makerのリンク
- 挿絵: 1200×630px（Pollinations.ai / Fluxモデル・無料）
- CTA URL: https://chrome-manual-maker.s-tasklog.com

---

## トラブルシューティング

### Playwrightエラー / CAPTCHA
Googleが一時ブロックした可能性。数時間待って再実行。
または GitHub Actions の manual-serp-analysis を使う（IPが変わる）。

### GSC 401エラー
Refresh Tokenの期限切れ。`node gsc-setup.js` から再取得。

### WordPress 401エラー
アプリケーションパスワードのスペースを含めてコピーしているか確認。
WP_USERNAMEはメールアドレスではなくログインID。

### performance.json が空のまま
`create-post.js` で投稿するたびに自動追加される。
既存の記事を追加したい場合は手動でJSONを編集。
