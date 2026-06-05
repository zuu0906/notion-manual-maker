-- マニュアルの送信元（'extension' | 'desktop'）を記録
ALTER TABLE public.manuals
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'extension';
