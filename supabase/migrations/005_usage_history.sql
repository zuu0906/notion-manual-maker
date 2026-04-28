CREATE TABLE IF NOT EXISTS public.usage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_id text NOT NULL,
  month text NOT NULL,
  screenshots int NOT NULL DEFAULT 0,
  ai_calls int NOT NULL DEFAULT 0,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(google_id, month)
);
