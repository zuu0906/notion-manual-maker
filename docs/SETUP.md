# セットアップガイド

## 1. Chrome拡張機能 — ローカル読み込み
1. `chrome://extensions/` を開く
2. 右上「デベロッパーモード」を ON
3. 「パッケージ化されていない拡張機能を読み込む」→ `extension/` を選択

## 2. Supabase プロジェクト
1. https://supabase.com でプロジェクト作成
2. SQL Editor で以下を順に実行
   - `supabase/migrations/001_users.sql`
   - `supabase/migrations/002_add_google_ai.sql`
3. Project Settings → API から URL と anon key を取得
4. `extension/shared/config.js` に設定

## 3. Notion Integration
1. https://www.notion.so/my-integrations → 「New integration」
2. Type: **Public**（OAuthが必要）
3. Redirect URIs: `https://<extension-id>.chromiumapp.org/notion`
   ※ extension ID は `chrome://extensions/` で確認
4. Client ID / Client Secret を取得

## 4. Supabase Edge Functions

```bash
supabase login --token <SUPABASE_ACCESS_TOKEN>
supabase link --project-ref ouscjeptmkoszcjkrmtm

supabase secrets set \
  NOTION_CLIENT_ID=... \
  NOTION_CLIENT_SECRET=... \
  STRIPE_SECRET_KEY=... \
  STRIPE_WEBHOOK_SECRET=... \
  STRIPE_STANDARD_PRICE_ID=price_... \
  STRIPE_PRO_PRICE_ID=price_... \
  GEMINI_API_KEY=...

supabase functions deploy auth-user
supabase functions deploy notion-proxy
supabase functions deploy stripe-webhook
supabase functions deploy create-checkout
supabase functions deploy gemini-proxy
supabase functions deploy record-screenshots
supabase functions deploy delete-user
```

## 5. Stripe
1. Dashboard で商品・価格を作成
   - Standard: ¥500/月
   - Pro: ¥1,200/月
2. Webhooks → エンドポイント:
   `https://ouscjeptmkoszcjkrmtm.supabase.co/functions/v1/stripe-webhook`
3. 購読イベント:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`

## 6. Google OAuth
1. Google Cloud Console で OAuth クライアント作成
2. `manifest.json` の `oauth2.client_id` に設定
3. Vercel 運用時は Authorized redirect URI に以下を追加
   - `https://ouscjeptmkoszcjkrmtm.supabase.co/auth/v1/callback`
   - `https://app.s-tasklog.com/auth/callback`

## 7. Next.js (`web/`) Vercel デプロイ

**Step 1 — Supabase Google Provider 有効化**
- Supabase Dashboard → Authentication → Providers → Google を ON
- Client ID / Secret を Supabase に設定

**Step 2 — Vercel デプロイ**
```bash
cd web
npm install
npm run build
npx vercel --prod
```
Vercel 環境変数:
```
NEXT_PUBLIC_SUPABASE_URL=https://ouscjeptmkoszcjkrmtm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<config.js と同じ値>
```

**Step 3 — DNS（カスタムドメインを使う場合）**
- Vercel → Project Settings → Domains にドメインを追加し、CNAME を DNS に設定

## 検証チェックリスト
- [ ] 拡張機能が読み込まれてアイコン表示
- [ ] Google ログイン成功
- [ ] Notion 接続 OAuth 成功
- [ ] 記録開始→クリック→スクショ+矢印生成
- [ ] Notion保存で画像+テキストがページに追加
- [ ] Free 20枚上限でアップグレード案内
- [ ] Stripe Checkout で Standard/Pro 購入
- [ ] Webサイト（https://chrome-manual-maker.vercel.app）表示
