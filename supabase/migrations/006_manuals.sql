CREATE TABLE IF NOT EXISTS public.manuals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_id text NOT NULL,
  title text NOT NULL,
  step_count int NOT NULL DEFAULT 0,
  notion_page_url text,
  notion_workspace_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS manuals_google_id_created_at_idx ON public.manuals(google_id, created_at DESC);
