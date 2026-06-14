// MCP APIキー管理 — ダッシュボード用（create / list / revoke）
// 認証: supabase_token（ダッシュボード）または google_token（拡張機能）。Pro以上のみ。
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
const MAX_KEYS = 5;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

async function resolveGoogleId(body: { google_token?: string; supabase_token?: string }): Promise<string | null> {
  if (body.supabase_token) {
    const { data: { user } } = await supabase.auth.getUser(body.supabase_token);
    if (!user) return null;
    const identity = user.identities?.find((i: { provider: string; id: string }) => i.provider === 'google');
    return identity?.id ?? null;
  }
  if (body.google_token) {
    const gRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${body.google_token}` },
    });
    if (!gRes.ok) return null;
    const { sub } = await gRes.json();
    return sub ?? null;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const google_id = await resolveGoogleId(body);
    if (!google_id) return json({ error: 'invalid token' }, 401);

    const { data: user } = await supabase
      .from('users')
      .select('plan, deleted_at')
      .eq('google_id', google_id)
      .single();
    if (!user || user.deleted_at) return json({ error: 'user not found' }, 404);
    if (!ALLOWED_PLANS.includes(user.plan)) {
      return json({ error: 'mcp_requires_pro', message: 'MCP連携はProプラン以上で利用できます' }, 403);
    }

    const action = body.action ?? 'list';

    if (action === 'create') {
      const { count } = await supabase
        .from('mcp_api_keys')
        .select('id', { count: 'exact', head: true })
        .eq('google_id', google_id);
      if ((count ?? 0) >= MAX_KEYS) {
        return json({ error: `APIキーは最大${MAX_KEYS}個までです` }, 400);
      }
      const { data, error } = await supabase
        .from('mcp_api_keys')
        .insert({ google_id, name: body.name ?? null })
        .select('id, key, name, created_at')
        .single();
      if (error) return json({ error: error.message }, 500);
      // key はこのレスポンスでのみ全文を返す（以後は末尾4桁のみ）
      return json({ ok: true, key: data });
    }

    if (action === 'list') {
      const { data, error } = await supabase
        .from('mcp_api_keys')
        .select('id, key, name, last_used_at, created_at')
        .eq('google_id', google_id)
        .order('created_at', { ascending: false });
      if (error) return json({ error: error.message }, 500);
      const keys = (data ?? []).map(k => ({
        id: k.id,
        name: k.name,
        key_masked: `mcp_…${k.key.slice(-4)}`,
        last_used_at: k.last_used_at,
        created_at: k.created_at,
      }));
      return json({ ok: true, keys });
    }

    if (action === 'revoke') {
      if (!body.key_id) return json({ error: 'key_id required' }, 400);
      const { error } = await supabase
        .from('mcp_api_keys')
        .delete()
        .eq('google_id', google_id)
        .eq('id', body.key_id);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    return json({ error: `unknown action: ${action}` }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
