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
    const locale = body.locale as string;
    if (!['ja', 'en'].includes(locale)) return json({ error: 'invalid locale' }, 400);

    let google_id: string | null = null;

    // Google token経由（拡張機能・デスクトップ）
    if (body.google_token) {
      const gRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${body.google_token}` },
      });
      if (!gRes.ok) return json({ error: 'invalid google token' }, 401);
      const { sub } = await gRes.json();
      google_id = sub;
    }
    // Supabase token経由（マイページ）
    else if (body.supabase_token) {
      const { data: { user }, error } = await supabase.auth.getUser(body.supabase_token);
      if (error || !user) return json({ error: 'invalid supabase token' }, 401);
      // Google OAuthのsub（Google user ID）をgoogle_idとして使用
      google_id = user.user_metadata?.sub ?? user.user_metadata?.provider_id ?? null;
    }

    if (!google_id) return json({ error: 'could not resolve user' }, 401);

    const { error } = await supabase.from('users')
      .update({ locale })
      .eq('google_id', google_id);

    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, locale });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
