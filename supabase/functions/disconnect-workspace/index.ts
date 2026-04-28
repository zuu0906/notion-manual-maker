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
    if (!body.supabase_token || !body.workspace_id) {
      return json({ error: 'supabase_token and workspace_id required' }, 400);
    }

    const { data: { user } } = await supabase.auth.getUser(body.supabase_token);
    if (!user) return json({ error: 'invalid token' }, 401);

    const identity = user.identities?.find((i: { provider: string; id: string }) => i.provider === 'google');
    if (!identity) return json({ error: 'google identity required' }, 401);

    const { error } = await supabase
      .from('notion_workspaces')
      .delete()
      .eq('google_id', identity.id)
      .eq('workspace_id', body.workspace_id);

    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
