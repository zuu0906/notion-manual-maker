// 自動実行（リプレイ）用 — 拡張機能が自分のマニュアル一覧とステップ詳細を取得するAPI
// 認証: google_token。Pro以上のみ。
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const ALLOWED_PLANS = ['pro', 'team'];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    if (!body.google_token) return json({ error: 'google_token required' }, 400);

    const gRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${body.google_token}` },
    });
    if (!gRes.ok) return json({ error: 'invalid google token' }, 401);
    const { sub: google_id } = await gRes.json();
    if (!google_id) return json({ error: 'google_id missing' }, 401);

    const { data: user } = await supabase
      .from('users')
      .select('plan, deleted_at')
      .eq('google_id', google_id)
      .single();
    if (!user || user.deleted_at) return json({ error: 'user not found' }, 404);
    if (!ALLOWED_PLANS.includes(user.plan)) {
      return json({ error: 'replay_requires_pro' }, 403);
    }

    const action = body.action ?? 'list';

    if (action === 'list') {
      // リプレイ可能なもの（steps_jsonがあり、拡張機能で記録されたもの）のみ
      const { data, error } = await supabase
        .from('manuals')
        .select('id, title, page_domain, step_count, created_at')
        .eq('google_id', google_id)
        .eq('source', 'extension')
        .not('steps_json', 'is', null)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, manuals: data ?? [] });
    }

    if (action === 'get') {
      if (!body.manual_id) return json({ error: 'manual_id required' }, 400);
      const { data, error } = await supabase
        .from('manuals')
        .select('id, title, steps_json')
        .eq('google_id', google_id)
        .eq('id', body.manual_id)
        .single();
      if (error || !data) return json({ error: 'manual not found' }, 404);
      return json({ ok: true, id: data.id, title: data.title, steps: data.steps_json?.steps ?? [] });
    }

    return json({ error: `unknown action: ${action}` }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
