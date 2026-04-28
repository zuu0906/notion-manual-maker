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
    const body = await req.json();
    if (!body.supabase_token) return json({ error: 'token required' }, 400);

    const { data: { user } } = await supabase.auth.getUser(body.supabase_token);
    if (!user) return json({ error: 'invalid token' }, 401);

    const identity = user.identities?.find((i: { provider: string }) => i.provider === 'google');
    if (!identity) return json({ error: 'google identity required' }, 401);

    const { data: profile } = await supabase
      .from('users')
      .select('stripe_customer_id')
      .eq('google_id', identity.id)
      .single();

    if (!profile?.stripe_customer_id) return json({ invoices: [] });

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2023-10-16' });
    const result = await stripe.invoices.list({
      customer: profile.stripe_customer_id,
      limit: 24,
    });

    const invoices = result.data.map((inv) => ({
      id: inv.id,
      created: inv.created,
      amount_paid: inv.amount_paid,
      currency: inv.currency,
      status: inv.status,
      invoice_pdf: inv.invoice_pdf,
      hosted_invoice_url: inv.hosted_invoice_url,
      period_start: inv.period_start,
      period_end: inv.period_end,
    }));

    return json({ invoices });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
