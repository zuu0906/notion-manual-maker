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
    const { google_token, count } = await req.json();
    if (!google_token || typeof count !== 'number' || count <= 0) {
      return json({ error: 'invalid params' }, 400);
    }

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 5000);
    const gRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${google_token}` },
      signal: ac.signal,
    }).finally(() => clearTimeout(timer));
    if (!gRes.ok) return json({ error: 'invalid google token' }, 401);

    const { sub: google_id } = await gRes.json();
    if (!google_id) return json({ error: 'missing google profile' }, 401);

    const { data: userRows, error: selectErr } = await supabase
      .from('users')
      .select('id, monthly_screenshots')
      .eq('google_id', google_id)
      .limit(1);

    if (selectErr) return json({ error: selectErr.message }, 500);
    let user = userRows?.[0] ?? null;

    if (!user) {
      // users レコード未作成の場合は auth-user 経由で作成してリトライ
      await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/auth-user`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ google_token }),
      });

      const { data: retryRows, error: retryErr } = await supabase
        .from('users')
        .select('id, monthly_screenshots')
        .eq('google_id', google_id)
        .limit(1);

      if (retryErr) return json({ error: retryErr.message }, 500);
      user = retryRows?.[0] ?? null;
      if (!user) return json({ error: 'user not found' }, 404);
    }

    const newCount = (user.monthly_screenshots ?? 0) + count;
    const { error: updateErr } = await supabase
      .from('users')
      .update({ monthly_screenshots: newCount })
      .eq('id', user.id);

    if (updateErr) return json({ error: updateErr.message }, 500);

    return json({ monthly_screenshots: newCount });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
