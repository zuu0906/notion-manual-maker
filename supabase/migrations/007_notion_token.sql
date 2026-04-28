ALTER TABLE public.notion_workspaces
  ADD COLUMN IF NOT EXISTS access_token text;
