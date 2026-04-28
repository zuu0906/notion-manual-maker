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
    if (!body.google_token) return json({ error: 'google_token required' }, 400);

    const gRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${body.google_token}` },
    });
    if (!gRes.ok) return json({ error: 'invalid google token' }, 401);
    const { sub: google_id } = await gRes.json();
    if (!google_id) return json({ error: 'google_id missing' }, 401);

    const { data, error } = await supabase.from('manuals').insert({
      google_id,
      title: body.title ?? '無題のマニュアル',
      step_count: body.step_count ?? 0,
      notion_page_url: body.notion_page_url ?? null,
      notion_workspace_id: body.notion_workspace_id ?? null,
    }).select('id').single();

    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, id: data.id });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
