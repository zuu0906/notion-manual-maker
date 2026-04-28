import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const SUPABASE_FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;

export type UserProfile = {
  userId: string;
  email: string;
  plan: 'free' | 'standard' | 'pro';
  ai_calls_used: number;
  ai_calls_limit: number;
  monthly_screenshots: number;
  screenshot_reset_at: string | null;
  ai_calls_reset_at: string | null;
  workspaces: NotionWorkspace[];
  manuals: Manual[];
  usage_history: UsageHistory[];
};

export type NotionWorkspace = {
  workspace_id: string;
  workspace_name: string;
  connected_at: string;
};

export type Manual = {
  id: string;
  title: string;
  step_count: number;
  notion_page_url: string | null;
  created_at: string;
};

export type UsageHistory = {
  month: string;
  screenshots: number;
  ai_calls: number;
};

export type Invoice = {
  id: string;
  created: number;
  amount_paid: number;
  currency: string;
  status: string | null;
  invoice_pdf: string | null;
  hosted_invoice_url: string | null;
  period_start: number;
  period_end: number;
};
