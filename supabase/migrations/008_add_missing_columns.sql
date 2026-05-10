-- migration 001 の CREATE TABLE で定義されたが実テーブルに存在しないカラムを追加
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS monthly_screenshots integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS screenshot_reset_at timestamptz NOT NULL DEFAULT (date_trunc('month', now()) + interval '1 month'),
  ADD COLUMN IF NOT EXISTS first_record_at timestamptz;

-- manuals テーブルの不足カラム（record-manual で参照）
ALTER TABLE public.manuals
  ADD COLUMN IF NOT EXISTS page_domain text,
  ADD COLUMN IF NOT EXISTS recording_duration_sec integer;
