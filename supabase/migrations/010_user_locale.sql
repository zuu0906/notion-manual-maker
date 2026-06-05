-- ユーザーの言語設定（デフォルト: 英語）
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'en'
    CHECK (locale IN ('ja', 'en'));
