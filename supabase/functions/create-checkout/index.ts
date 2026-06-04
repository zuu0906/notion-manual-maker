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

async function getVerifiedUser(
  token: { type: 'google'; value: string } | { type: 'supabase'; value: string }
): Promise<{ id: string; email: string; plan: string; google_id: string } | 'token_invalid'> {
  let google_id: string;
  let email: string;

  if (token.type === 'supabase') {
    const { data: { user } } = await supabase.auth.getUser(token.value);
    if (!user) return 'token_invalid';
    const identity = user.identities?.find((i: { provider: string; id: string }) => i.provider === 'google');
    if (!identity) return 'token_invalid';
    google_id = identity.id;
    email = user.email ?? '';
  } else {
    const gRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token.value}` },
    });
    if (!gRes.ok) throw new Error(`google_userinfo_${gRes.status}`);
    const profile = await gRes.json();
    if (!profile.sub) return 'token_invalid';
    google_id = profile.sub;
    email = profile.email ?? '';
  }

  let { data: user } = await supabase
    .from('users')
    .select('id, email, plan, google_id')
    .eq('google_id', google_id)
    .single();

  if (!user) {
    const { data: created, error: upsertErr } = await supabase
      .from('users')
      .upsert({ google_id, email }, { onConflict: 'google_id', ignoreDuplicates: false })
      .select('id, email, plan, google_id')
      .single();
    if (upsertErr) throw new Error(`upsert_failed: ${upsertErr.message}`);
    user = created;
  }

  if (!user) throw new Error('user_still_null_after_upsert');
  return { ...user, email: user.email ?? email };
}

const STRIPE_STANDARD_PRICE_ID = Deno.env.get('STRIPE_STANDARD_PRICE_ID') ?? 'price_1TO5CS1zfFhRe5YPzWfAYSpa';
const STRIPE_PRO_PRICE_ID      = Deno.env.get('STRIPE_PRO_PRICE_ID')      ?? 'price_1TN4YS1zfFhRe5YP6ZLFX9qq';
const PRICE_PLAN: Record<string, string> = {
  [STRIPE_STANDARD_PRICE_ID]: 'standard',
  [STRIPE_PRO_PRICE_ID]: 'pro',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { google_token, supabase_token, price_id, success_url, cancel_url } = await req.json();
    if ((!google_token && !supabase_token) || !price_id) return json({ error: 'missing params' }, 400);

    const token = supabase_token
      ? { type: 'supabase' as const, value: supabase_token }
      : { type: 'google' as const, value: google_token };
    const user = await getVerifiedUser(token);
    if (user === 'token_invalid') return json({ error: 'token_invalid' }, 401);

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2023-10-16' });

    const plan = PRICE_PLAN[price_id] ?? 'pro';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: price_id, quantity: 1 }],
      customer_email: user.email,
      success_url: (success_url ?? 'https://notion-manual-maker.vercel.app/success') +
        ((success_url ?? '').includes('?') ? '&' : '?') + 'session_id={CHECKOUT_SESSION_ID}',
      cancel_url: cancel_url ?? 'https://notion-manual-maker.vercel.app/pricing',
      metadata: { google_id: user.google_id, plan },
      subscription_data: { trial_period_days: 14 },
    });

    return json({ url: session.url });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
