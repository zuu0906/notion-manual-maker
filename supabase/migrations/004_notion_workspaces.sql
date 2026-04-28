CREATE TABLE IF NOT EXISTS public.notion_workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_id text NOT NULL REFERENCES public.users(google_id) ON DELETE CASCADE,
  workspace_id text NOT NULL,
  workspace_name text NOT NULL,
  connected_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(google_id, workspace_id)
);
ALTER TABLE public.notion_workspaces ENABLE ROW LEVEL SECURITY;
