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
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2023-10-16' });

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { session_id, supabase_token } = await req.json();
    if (!session_id || !supabase_token) return json({ error: 'missing params' }, 400);

    const { data: { user } } = await supabase.auth.getUser(supabase_token);
    if (!user) return json({ error: 'invalid token' }, 401);
    const identity = user.identities?.find((i: { provider: string }) => i.provider === 'google');
    if (!identity) return json({ error: 'google identity not found' }, 401);
    const google_id = identity.id;

    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (session.payment_status !== 'paid') return json({ error: 'not_paid' }, 402);

    const plan = session.metadata?.plan ?? 'pro';
    const customerId = session.customer as string | undefined;

    const updateData: Record<string, unknown> = { plan };
    if (customerId) updateData.stripe_customer_id = customerId;

    const { error } = await supabase
      .from('users')
      .update(updateData)
      .eq('google_id', google_id);

    if (error) return json({ error: error.message }, 500);

    return json({ plan });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
