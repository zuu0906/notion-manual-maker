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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();

    let google_id: string;

    if (body.supabase_token) {
      const { data: { user } } = await supabase.auth.getUser(body.supabase_token);
      if (!user) return json({ error: 'invalid supabase_token' }, 401);
      const identity = user.identities?.find((i: { provider: string; id: string }) => i.provider === 'google');
      if (!identity) return json({ error: 'google identity required' }, 401);
      google_id = identity.id;
    } else if (body.google_token) {
      const gRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${body.google_token}` },
      });
      if (!gRes.ok) return json({ error: 'invalid google_token' }, 401);
      const { sub } = await gRes.json();
      if (!sub) return json({ error: 'google_id missing' }, 401);
      google_id = sub;
    } else {
      return json({ error: 'supabase_token or google_token required' }, 400);
    }

    const workspaces: { id: string; name: string; token?: string }[] = body.workspaces ?? [];
    const mode: string = body.mode ?? 'replace';

    if (mode === 'add' && workspaces.length === 1) {
      // 1件追加モード: 既存を残したまま該当IDだけ差し替え
      const w = workspaces[0];
      await supabase.from('notion_workspaces')
        .delete()
        .eq('google_id', google_id)
        .eq('workspace_id', w.id);
      await supabase.from('notion_workspaces').insert({
        google_id,
        workspace_id: w.id,
        workspace_name: w.name,
        access_token: w.token ?? null,
      });
    } else {
      // replaceモード: 全削除→再挿入（拡張機能からの同期）
      await supabase.from('notion_workspaces').delete().eq('google_id', google_id);
      if (workspaces.length > 0) {
        await supabase.from('notion_workspaces').insert(
          workspaces.map((w) => ({
            google_id,
            workspace_id: w.id,
            workspace_name: w.name,
            access_token: w.token ?? null,
          }))
        );
      }
    }

    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
