import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

function nextMonthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString();
}

function monthKey(isoDate: string): string {
  const d = new Date(isoDate);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function resolveIdentity(body: {
  google_token?: string;
  supabase_token?: string;
}): Promise<{ google_id: string; email: string } | null> {
  // Supabase JWT（ページリロード後も動作）
  if (body.supabase_token) {
    const { data: { user } } = await supabase.auth.getUser(body.supabase_token);
    if (!user) return null;
    const identity = user.identities?.find((i: { provider: string; id: string }) => i.provider === 'google');
    if (!identity) return null;
    return { google_id: identity.id, email: user.email ?? '' };
  }

  // Google アクセストークン（拡張機能からの呼び出し）
  if (body.google_token) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 5000);
    const gRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${body.google_token}` },
      signal: ac.signal,
    }).finally(() => clearTimeout(timer));
    if (!gRes.ok) return null;
    const { sub: google_id, email } = await gRes.json();
    if (!google_id) return null;
    return { google_id, email };
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    if (!body.google_token && !body.supabase_token) return json({ error: 'token required' }, 400);

    const identity = await resolveIdentity(body);
    if (!identity) return json({ error: 'invalid token' }, 401);

    const { google_id, email } = identity;

    const { data: user, error } = await supabase
      .from('users')
      .upsert({ google_id, email }, { onConflict: 'google_id', ignoreDuplicates: false })
      .select()
      .single();

    if (error) return json({ error: error.message }, 500);

    // 削除済みアカウントで再登録した場合は deleted_at を解除（monthly_screenshots は引き継ぐ）
    if (user.deleted_at) {
      await supabase.from('users').update({ deleted_at: null }).eq('google_id', google_id);
      user.deleted_at = null;
    }

    // AI使用回数の月次リセット（リセット前に履歴を記録）
    if (user.ai_calls_reset_at && new Date() > new Date(user.ai_calls_reset_at)) {
      const mk = monthKey(user.ai_calls_reset_at);
      await supabase.from('usage_history').upsert(
        { google_id, month: mk, ai_calls: user.ai_calls_used ?? 0 },
        { onConflict: 'google_id,month', ignoreDuplicates: false }
      );
      await supabase.from('users')
        .update({ ai_calls_used: 0, ai_calls_reset_at: nextMonthStart() })
        .eq('google_id', google_id);
      user.ai_calls_used = 0;
    }

    // スクショ枚数の月次リセット（リセット前に履歴を記録）
    if (user.screenshot_reset_at && new Date() > new Date(user.screenshot_reset_at)) {
      const mk = monthKey(user.screenshot_reset_at);
      await supabase.from('usage_history').upsert(
        { google_id, month: mk, screenshots: user.monthly_screenshots ?? 0 },
        { onConflict: 'google_id,month', ignoreDuplicates: false }
      );
      await supabase.from('users')
        .update({ monthly_screenshots: 0, screenshot_reset_at: nextMonthStart() })
        .eq('google_id', google_id);
      user.monthly_screenshots = 0;
    }

    const limits: Record<string, number> = { free: 0, standard: 100, pro: 500, team: 500 };
    const plan = user.plan ?? 'free';

    // ワークスペース・マニュアル・使用履歴を並行取得
    // access_token は拡張機能（google_token 経由）のみ返す（web セッションには不要）
    const wsSelect = body.google_token
      ? 'workspace_id, workspace_name, connected_at, access_token'
      : 'workspace_id, workspace_name, connected_at';
    const [wsRes, manualsRes, historyRes] = await Promise.all([
      supabase.from('notion_workspaces').select(wsSelect)
        .eq('google_id', google_id).order('connected_at'),
      supabase.from('manuals').select('id, title, step_count, notion_page_url, created_at')
        .eq('google_id', google_id).order('created_at', { ascending: false }).limit(20),
      supabase.from('usage_history').select('month, screenshots, ai_calls')
        .eq('google_id', google_id).order('month', { ascending: false }).limit(6),
    ]);

    return json({
      userId: user.id,
      email: user.email,
      plan,
      locale: (user.locale as string) ?? 'en',
      ai_calls_used: user.ai_calls_used ?? 0,
      ai_calls_limit: limits[plan] ?? 0,
      monthly_screenshots: user.monthly_screenshots ?? 0,
      screenshot_reset_at: user.screenshot_reset_at ?? null,
      ai_calls_reset_at: user.ai_calls_reset_at ?? null,
      workspaces: wsRes.data ?? [],
      manuals: manualsRes.data ?? [],
      usage_history: historyRes.data ?? [],
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
