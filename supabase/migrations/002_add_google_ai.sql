-- google_idカラム追加 + auth.users FK解除
-- AI使用回数はGoogleアカウント単位のクォータで管理

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;
ALTER TABLE public.users ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS google_id text unique;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS ai_calls_used integer not null default 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS ai_calls_reset_at timestamptz not null
  default date_trunc('month', now()) + interval '1 month';

-- standard planを追加
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_plan_check;
ALTER TABLE public.users ADD CONSTRAINT users_plan_check
  CHECK (plan in ('free', 'standard', 'pro', 'team'));
