-- usersテーブル
create table if not exists public.users (
  id uuid primary key references auth.users on delete cascade,
  email text,
  plan text not null default 'free' check (plan in ('free', 'pro', 'team')),
  notion_access_token text,
  notion_workspace_id text,
  notion_workspace_name text,
  stripe_customer_id text,
  monthly_screenshots int not null default 0,
  screenshot_reset_at timestamptz not null default date_trunc('month', now()),
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'users' and policyname = 'users can read own row'
  ) then
    execute 'create policy "users can read own row" on public.users for select using (auth.uid() = id)';
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'users' and policyname = 'users can update own row'
  ) then
    execute 'create policy "users can update own row" on public.users for update using (auth.uid() = id)';
  end if;
end $$;

-- Storageバケット（すでに存在する場合はスキップ）
insert into storage.buckets (id, name, public)
values ('annotations', 'annotations', true)
on conflict (id) do nothing;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'authenticated users can upload'
  ) then
    execute 'create policy "authenticated users can upload" on storage.objects for insert with check (bucket_id = ''annotations'' and auth.uid() is not null)';
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'public read'
  ) then
    execute 'create policy "public read" on storage.objects for select using (bucket_id = ''annotations'')';
  end if;
end $$;
