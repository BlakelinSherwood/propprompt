import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || (user.role !== 'admin' && user.role !== 'platform_owner')) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { subscription_id, territory_id } = await req.json();
    if (!subscription_id || !territory_id) {
      return Response.json({ error: 'Missing subscription_id or territory_id' }, { status: 400 });
    }

    // Cancel Stripe subscription if present
    const subs = await base44.asServiceRole.entities.TerritorySubscription.filter({ id: subscription_id });
    if (subs.length && subs[0].stripe_subscription_id) {
      try {
        await stripe.subscriptions.cancel(subs[0].stripe_subscription_id);
      } catch (e) {
        console.warn('[revokeSublicense] Stripe cancel failed:', e.message);
      }
    }

    // Update subscription status
    await base44.asServiceRole.entities.TerritorySubscription.update(subscription_id, { status: 'cancelled' });

    // Return territory to reserved
    await base44.asServiceRole.entities.Territory.update(territory_id, { status: 'reserved' });

    console.log(`[revokeSublicense] Revoked subscription ${subscription_id} for territory ${territory_id}`);
    return Response.json({ success: true });
  } catch (error) {
    console.error('[revokeSublicense] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});