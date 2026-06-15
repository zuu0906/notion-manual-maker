// 拡張全体で使う公開設定値（Supabase URL / anon key / Notion client_id）。
// これらはクライアントに出る前提の公開値であり、秘密情報ではない。

export const CONFIG = {
  SUPABASE_URL: 'https://ouscjeptmkoszcjkrmtm.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91c2NqZXB0bWtvc3pjamtybXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzODM2ODQsImV4cCI6MjA5MTk1OTY4NH0.hYxWKYO2_H--7WAthX7azRJuier5uI3IA7km1sgwV3g',
  NOTION_CLIENT_ID: '345d872b-594c-810c-9c3d-00376d7425b3',
  // Notionのリダイレクトは popup.js 内で chrome.identity.getRedirectURL() が自動生成します
};

export const PLAN_LIMITS = {
  free:     { screenshots_per_month: 20,       workspaces: 1, ai_calls_per_month: 0 },
  standard: { screenshots_per_month: Infinity,  workspaces: 1, ai_calls_per_month: 100 },
  pro:      { screenshots_per_month: Infinity,  workspaces: 3, ai_calls_per_month: 500 },
  team:     { screenshots_per_month: Infinity,  workspaces: 3, ai_calls_per_month: 500 },
};
