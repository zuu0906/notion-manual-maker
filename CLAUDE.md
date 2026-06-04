# CLAUDE.md

Notion Manual Maker — Chrome拡張（MV3）+ Supabase + Stripe + Next.js（Vercel）のSaaS。**拡張機能はリリース済み。**

## 構成
- `extension/` — Chrome拡張（リリース済み。変更時は store-build/ ZIP再作成が必要）
- `web/` — Next.js LP（`npx vercel --prod` でデプロイ）
- `supabase/functions/` — Edge Functions（`supabase functions deploy <name>`）
- `blog-automation/` — ブログ自動投稿スクリプト（詳細 → `blog-automation/INSTRUCTIONS.md`）

## プラン
Free (20枚/月・WM付き) / Standard ¥500 (AI 100回) / Pro ¥1200 (AI 500回・3WS)

## デプロイ
```bash
supabase link --project-ref ouscjeptmkoszcjkrmtm
supabase functions deploy <name>
cd web && npx vercel --prod
```

## 主要URL
- LP: https://notion-manual-maker.vercel.app
- Dashboard: https://notion-manual-maker.vercel.app/dashboard
- Supabase: ouscjeptmkoszcjkrmtm
