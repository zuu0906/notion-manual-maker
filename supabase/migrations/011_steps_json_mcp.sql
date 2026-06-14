-- steps_json: マニュアルのステップ詳細（画像URL・クリック座標・elementHint等）を永続化
-- MCPサーバー（AI連携）とマニュアル自動実行（リプレイ）の共通基盤
ALTER TABLE public.manuals ADD COLUMN IF NOT EXISTS steps_json jsonb;

-- gen_random_bytes に必要
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- MCPクライアント（Claude Desktop等）用のAPIキー
-- MCPクライアントはGoogle OAuthフローを踏めないためAPIキー方式で認証する
CREATE TABLE IF NOT EXISTS public.mcp_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_id text NOT NULL REFERENCES public.users(google_id) ON DELETE CASCADE,
  key text UNIQUE NOT NULL DEFAULT ('mcp_' || encode(extensions.gen_random_bytes(24), 'hex')),
  name text,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mcp_api_keys_google_id ON public.mcp_api_keys(google_id);

ALTER TABLE public.mcp_api_keys ENABLE ROW LEVEL SECURITY;
-- Edge Function (service role) のみがアクセスする。anon からの直接アクセスは不可
