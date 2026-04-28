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

    const gRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${google_token}` },
    });
    if (!gRes.ok) return json({ error: 'invalid google token' }, 401);

    const { sub: google_id } = await gRes.json();
    if (!google_id) return json({ error: 'missing google profile' }, 401);

    const { data: user } = await supabase
      .from('users')
      .select('id, monthly_screenshots, plan')
      .eq('google_id', google_id)
      .single();

    if (!user) return json({ error: 'user not found' }, 404);

    const newCount = (user.monthly_screenshots ?? 0) + count;
    await supabase
      .from('users')
      .update({ monthly_screenshots: newCount })
      .eq('id', user.id);

    return json({ monthly_screenshots: newCount });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
