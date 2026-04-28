import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@12?target=deno';

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

async function resolveGoogleId(body: { google_token?: string; supabase_token?: string }): Promise<string | null> {
  // Supabase JWT で認証（ページリロード後も動作）
  if (body.supabase_token) {
    const { data: { user } } = await supabase.auth.getUser(body.supabase_token);
    if (!user) return null;
    const identity = user.identities?.find((i: { provider: string; id: string }) => i.provider === 'google');
    return identity?.id ?? null;
  }

  // Google アクセストークンで認証（従来）
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
    if (!body.google_token && !body.supabase_token) return json({ error: 'token required' }, 400);

    const google_id = await resolveGoogleId(body);
    if (!google_id) return json({ error: 'invalid token' }, 401);

    // ユーザー取得
    const { data: user, error: fetchErr } = await supabase
      .from('users')
      .select('id, stripe_customer_id')
      .eq('google_id', google_id)
      .single();

    if (fetchErr || !user) return json({ error: 'user not found' }, 404);

    // Stripe サブスクリプションをキャンセル
    if (user.stripe_customer_id) {
      try {
        const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2023-10-16' });
        const subs = await stripe.subscriptions.list({
          customer: user.stripe_customer_id,
          status: 'all',
          limit: 100,
        });
        const toCancel = subs.data.filter(s => !['canceled', 'incomplete_expired'].includes(s.status));
        await Promise.all(toCancel.map((sub) => stripe.subscriptions.cancel(sub.id)));
        console.log('[delete-user] Stripe subscriptions canceled for customer:', user.stripe_customer_id);
      } catch (e) {
        console.error('[delete-user] Stripe cancel failed:', e);
      }
    }

    // Storage 内の画像を削除
    const { data: files } = await supabase.storage
      .from('annotations')
      .list(user.id, { limit: 1000 });

    if (files && files.length > 0) {
      const paths = files.map((f: { name: string }) => `${user.id}/${f.name}`);
      await supabase.storage.from('annotations').remove(paths);
    }

    // ソフトデリート: PII(email)を削除し deleted_at をセット（row は残してスクショ枚数を保持）
    const { error: deleteErr } = await supabase
      .from('users')
      .update({ email: null, deleted_at: new Date().toISOString() })
      .eq('id', user.id);

    if (deleteErr) return json({ error: deleteErr.message }, 500);

    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
