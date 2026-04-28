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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { supabase_token, google_token, new_price_id } = await req.json();
    if (!new_price_id || (!supabase_token && !google_token)) {
      return json({ error: 'missing params' }, 400);
    }

    // ユーザー認証
    let google_id: string;
    if (supabase_token) {
      const { data: { user } } = await supabase.auth.getUser(supabase_token);
      if (!user) return json({ error: 'token_invalid' }, 401);
      const identity = user.identities?.find((i: { provider: string }) => i.provider === 'google');
      if (!identity) return json({ error: 'no_google_identity' }, 401);
      google_id = (identity as { id: string }).id;
    } else {
      const gRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${google_token}` },
      });
      if (!gRes.ok) return json({ error: 'invalid google token' }, 401);
      const profile = await gRes.json();
      if (!profile.sub) return json({ error: 'token_invalid' }, 401);
      google_id = profile.sub;
    }

    const { data: dbUser } = await supabase
      .from('users')
      .select('stripe_customer_id, plan')
      .eq('google_id', google_id)
      .single();

    if (!dbUser?.stripe_customer_id) {
      return json({ error: 'no_stripe_customer' }, 400);
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2023-10-16' });

    // アクティブ or トライアル中のサブスクリプションを取得
    const { data: subs } = await stripe.subscriptions.list({
      customer: dbUser.stripe_customer_id,
      limit: 5,
    });
    const sub = subs.find((s) => ['active', 'trialing'].includes(s.status));
    if (!sub) return json({ error: 'no_active_subscription' }, 400);

    const subItem = sub.items.data[0];

    // プランを即時更新（差額は日割りで請求）
    await stripe.subscriptions.update(sub.id, {
      items: [{ id: subItem.id, price: new_price_id }],
      proration_behavior: 'create_prorations',
    });

    // DB のプランも即時反映
    const PRICE_PLAN: Record<string, string> = {
      [Deno.env.get('STRIPE_STANDARD_PRICE_ID') ?? '']: 'standard',
      [Deno.env.get('STRIPE_PRO_PRICE_ID') ?? '']: 'pro',
    };
    const newPlan = PRICE_PLAN[new_price_id] ?? 'pro';
    await supabase.from('users').update({ plan: newPlan }).eq('google_id', google_id);

    return json({ success: true, plan: newPlan });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
