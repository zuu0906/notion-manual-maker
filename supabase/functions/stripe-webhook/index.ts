import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@12?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2023-10-16' });
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req) => {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature') ?? '';

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
  } catch (err) {
    console.error('[stripe-webhook] signature verification failed:', String(err));
    console.error('[stripe-webhook] sig header present:', !!sig, '| secret length:', webhookSecret?.length ?? 0);
    return new Response(`webhook error: ${String(err)}`, { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerId = session.customer as string;
      const plan = session.metadata?.plan ?? 'pro';
      const email = session.customer_email ?? '';
      const googleId = session.metadata?.google_id;
      await updateUserPlan(email, plan, googleId, customerId);
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = sub.customer as string;
      const { data: userByCustomer } = await supabase
        .from('users')
        .update({ plan: 'free' })
        .eq('stripe_customer_id', customerId)
        .select('google_id')
        .single();
      if (userByCustomer?.google_id) {
        await enforceWorkspaceLimit(userByCustomer.google_id, 1);
      } else {
        const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;
        if (customer.email) {
          const { data: userByEmail } = await supabase
            .from('users')
            .update({ plan: 'free' })
            .eq('email', customer.email)
            .select('google_id')
            .single();
          if (userByEmail?.google_id) await enforceWorkspaceLimit(userByEmail.google_id, 1);
        }
      }
      break;
    }
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = sub.customer as string;
      const priceId = sub.items.data[0]?.price.id;
      const standardPriceId = Deno.env.get('STRIPE_STANDARD_PRICE_ID') ?? 'price_1TeTkw1zfFhRe5YP4sbK4wKa';
      const proPriceId      = Deno.env.get('STRIPE_PRO_PRICE_ID')      ?? 'price_1TeTmC1zfFhRe5YPW4ReYraX';
      const planMap: Record<string, string> = {
        [standardPriceId]: 'standard',
        [proPriceId]: 'pro',
      };
      const newPlan = priceId ? (planMap[priceId] ?? 'free') : 'free';
      const { data: updatedUser } = await supabase
        .from('users')
        .update({ plan: newPlan })
        .eq('stripe_customer_id', customerId)
        .select('google_id')
        .single();
      // ダウングレード時はワークスペースを1つに制限
      if (updatedUser?.google_id && newPlan !== 'pro') {
        await enforceWorkspaceLimit(updatedUser.google_id, 1);
      }
      break;
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;
      await supabase.from('users').update({ plan: 'free' }).eq('stripe_customer_id', customerId);
      break;
    }
  }

  return new Response('ok');
});

async function enforceWorkspaceLimit(googleId: string, max: number) {
  const { data: workspaces } = await supabase
    .from('notion_workspaces')
    .select('id')
    .eq('google_id', googleId)
    .order('connected_at', { ascending: true });
  if (!workspaces || workspaces.length <= max) return;
  const toDelete = workspaces.slice(max).map((w: { id: string }) => w.id);
  await supabase.from('notion_workspaces').delete().in('id', toDelete);
}

async function updateUserPlan(email: string, plan: string, googleId?: string, customerId?: string) {
  let user: { id: string } | null = null;

  if (googleId) {
    const { data } = await supabase
      .from('users').select('id').eq('google_id', googleId).single();
    user = data;
    if (!user) console.error('[stripe-webhook] user not found by google_id:', googleId);
  }

  if (!user && email) {
    const { data } = await supabase
      .from('users').select('id').eq('email', email).single();
    user = data;
    if (!user) console.error('[stripe-webhook] user not found by email either:', email);
  }

  if (!user) return;

  const updateData: Record<string, unknown> = { plan };
  if (customerId) updateData.stripe_customer_id = customerId;

  const { error } = await supabase
    .from('users').update(updateData).eq('id', user.id);

  if (error) console.error('[stripe-webhook] update failed:', error);
  else console.log('[stripe-webhook] plan updated to', plan, 'for user', user.id);
}
