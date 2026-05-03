# アーキテクチャ

## プロジェクト概要
`extension/` のChrome拡張機能（Manifest V3）。Webページ上のクリックをスクリーンショット＋赤丸アノテーションで記録し、NotionページへAIラベル付きで保存するSaaS。

- **バックエンド**: Supabase（Edge Functions / Storage）
- **認証**: Google OAuth（`chrome.identity`）
- **AI**: Gemini 2.5 Flash（`gemini-proxy` Edge Function 経由）
- **決済**: Stripe（`create-checkout` / `stripe-webhook` Edge Function）
- **Webサイト**: https://chrome-manual-maker.vercel.app（Next.js / Vercel）

## プラン定義

| プラン   | スクショ/月 | AI回数/月 | ワークスペース | 料金    |
|----------|------------|----------|--------------|---------|
| Free     | 20枚       | 0回      | 1            | 無料    |
| Standard | 無制限     | 100回    | 1            | ¥500/月 |
| Pro      | 無制限     | 500回    | 3            | ¥1,200/月 |

Free: スクショにウォーターマーク付き、PDF出力なし、保存先選択なし（新規ページのみ）

## ファイル構成

| ファイル | 役割 |
|---------|------|
| `extension/background.js` | Service Worker。スクショ・OffscreenCanvasアノテーション・Notion保存・状態管理 |
| `extension/content.js` | タブ注入。overlay・クリック検知・テキスト入力・PII検出 |
| `extension/popup/popup.html` | ポップアップHTML+CSS（320px固定幅） |
| `extension/popup/popup.js` | ポップアップUI全体。認証・AI生成・ステップ管理・保存・PDF |
| `extension/shared/config.js` | Supabase URL/AnonKey・Notion Client ID・プラン制限値 |
| `extension/manifest.json` | MV3設定。`webNavigation` 権限あり |
| `extension/pdf/index.html` + `index.js` | PDF出力ページ |
| `supabase/functions/auth-user/` | Google トークン検証・users upsert・プラン返却・月次リセット |
| `supabase/functions/gemini-proxy/` | Gemini API呼び出し（シングル/バッチ）・AI使用回数管理 |
| `supabase/functions/notion-proxy/` | Notion OAuth トークン交換 |
| `supabase/functions/create-checkout/` | Stripe Checkout セッション作成 |
| `supabase/functions/stripe-webhook/` | Stripe Webhook ハンドラ（plan更新・stripe_customer_id保存） |
| `supabase/functions/record-screenshots/` | スクショ保存数をDBに記録（background.js から呼び出し） |
| `supabase/functions/delete-user/` | ユーザーデータ削除（Storage画像＋usersレコード） |
| `supabase/migrations/001_users.sql` | users テーブル・Storage バケット・RLS |
| `supabase/migrations/002_add_google_ai.sql` | google_id・ai_calls_used・ai_calls_reset_at カラム追加 |

## DBスキーマ（`public.users`）

```
id                   uuid PK
google_id            text UNIQUE
email                text
plan                 text  ('free' | 'standard' | 'pro')
ai_calls_used        integer  月次リセット
ai_calls_reset_at    timestamptz  翌月1日
stripe_customer_id   text
monthly_screenshots  integer  月次リセット
screenshot_reset_at  timestamptz  翌月1日
notion_access_token  text
notion_workspace_id  text
notion_workspace_name text
created_at           timestamptz
```

## メッセージフロー

```
popup.js
  └─ START_RECORDING  → background.js → executeScript(content.js)
  └─ SAVE_TO_NOTION   → background.js → Supabase Storage → Notion API
  └─ UPDATE_STEPS     → background.js（ラベル/メモ編集の同期）
  └─ CLEAR_STEPS      → background.js
  └─ GET_STATE        → background.js（初期化時）

content.js
  └─ CLICK_CAPTURED   → background.js → captureVisibleTab → drawOnOffscreen → CAPTURE_DONE
  └─ RECORDING_STOPPED → background.js → STATE_UPDATE → popup.js

background.js
  └─ CAPTURE_DONE     → content.js（overlay再表示 + ripple）
  └─ STOP_RECORDING   → content.js → deactivate()
  └─ STATE_UPDATE     → popup.js
  └─ STEP_ADDED       → popup.js
  └─ PRIVACY_SETTING  → content.js（ぼかし設定）
```

## アノテーション処理（重要）

`background.js` の `drawOnOffscreen()` がService Worker内のOffscreenCanvasで完結：

```js
const scaleX = imageBitmap.width / viewportWidth;
const scaleY = imageBitmap.height / viewportHeight;
// FileReader.readAsDataURL で blob→dataUrl 変換
```
content.js から `viewportWidth: window.innerWidth, viewportHeight: window.innerHeight` を送ること。

## 記録フロー（タイミング厳守）
1. クリック → overlay/hint非表示 → CLICK_CAPTURED送信
2. background: `Math.max(100, MIN_CAPTURE_INTERVAL - elapsed)` 待機
3. `captureVisibleTab()` → OffscreenCanvas描画 → CAPTURE_DONE送信
4. content: CAPTURE_DONE受信後にoverlay再表示＋ripple

`clickQueue` でクリックを直列処理（`captureVisibleTab` は1秒1回制限）。

## ストレージキー
- `chrome.storage.sync`: `plan`, `monthly_screenshots`, `ai_calls_used`, `privacy_masking`
- `chrome.storage.local`: `notion_access_token`, `notion_workspace_*`（セキュリティ上 local）
- `chrome.storage.session`: `pendingClicks`, `isRecording`, `recordingTabId`, `googleToken`

## スクショ上限チェック
クライアントとサーバーで二重チェック：
- クライアント: `monthly_screenshots + stepsToSave.length > limit` （バッチ超過対策）
- サーバー: auth-user Edge Function が同様のチェックを実施
- カウントの永続化: `record-screenshots` Edge Function でDBに反映、ポップアップ起動時は `Math.max(ローカル値, サーバー値)`

## 既知の制約・注意事項
- **manifest.json 変更後は削除→再読み込みが必要**（更新ボタンだけでは不十分）
- **chrome.storage.session** はブラウザ再起動で消える（SW クラッシュには有効、ブラウザ再起動には無効）
- **content.js は CSP 厳格なページ（google.com 等）でも動作する**（data:URL 操作なし）
- **Notion OAuth の redirect URL** は extension ID に依存。ID が変わると連携が壊れる
- **captureVisibleTab** は 1秒1回制限。clickQueue で直列処理済み
- **`supabase login`** は非TTY のため `--token` フラグが必要
- **Supabase anon key・Notion Client ID** はコードに直書き（anon key は公開前提で実害限定的）

## デプロイコマンド

```bash
supabase link --project-ref ouscjeptmkoszcjkrmtm
supabase functions deploy auth-user
supabase functions deploy stripe-webhook
supabase functions deploy create-checkout
supabase functions deploy gemini-proxy
supabase functions deploy notion-proxy
supabase functions deploy record-screenshots
supabase functions deploy delete-user

supabase secrets set \
  NOTION_CLIENT_ID=... \
  NOTION_CLIENT_SECRET=... \
  STRIPE_SECRET_KEY=... \
  STRIPE_WEBHOOK_SECRET=... \
  STRIPE_STANDARD_PRICE_ID=price_1TO6E11zfFhRe5YPJkoCR2aj \
  STRIPE_PRO_PRICE_ID=price_1TO6F01zfFhRe5YPyppCAONb \
  GEMINI_API_KEY=...
```

## デバッグ
- **Service Worker**: `chrome://extensions/` → 拡張機能の「Service Worker」リンク
- **Popup**: popupを開いた状態で右クリック →「検証」
- 変更後は `chrome://extensions/` で更新ボタン（↻）
- manifest.json 変更時は削除→再読み込み

## Supabase
- Project ref: `ouscjeptmkoszcjkrmtm`
- URL: `https://ouscjeptmkoszcjkrmtm.supabase.co`
- Storage bucket: `annotations`（public read、anon insert 許可）
- Edge Function呼び出しには `Authorization: Bearer <SUPABASE_ANON_KEY>` 必須
