import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

async function getPricing(base44) {
  const rows = await base44.asServiceRole.entities.PricingConfig.list('-updated_date', 1);
  return rows[0] || {};
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { payment_intent_id, pack_key, subscription_id, bundle_id, pool_id } = await req.json();

    // Verify payment intent succeeded
    const pi = await stripe.paymentIntents.retrieve(payment_intent_id);
    if (pi.status !== 'succeeded') {
      return Response.json({ error: 'Payment not completed', status: pi.status }, { status: 400 });
    }

    // Check for duplicate (idempotency)
    const existing = await base44.asServiceRole.entities.TopupPack.filter({
      stripe_payment_intent_id: payment_intent_id,
    });
    if (existing.length > 0) {
      return Response.json({
        success: true,
        pack_id: existing[0].id,
        message: 'Already processed',
      });
    }

    const pricing = await getPricing(base44);
    const expiryDays = parseInt(pricing.topup_expiry_days || 90);

    // Use the analyses count from the payment intent metadata (frozen at purchase time)
    const analyses = parseInt(pi.metadata.analyses || 10);
    const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString();

    const topup = await base44.asServiceRole.entities.TopupPack.create({
      subscription_id: subscription_id || null,
      bundle_id: bundle_id || null,
      analyses_purchased: analyses,
      analyses_remaining: analyses,
      price_paid: pi.amount / 100,
      expires_at: expiresAt,
      stripe_payment_intent_id: payment_intent_id,
    });

    return Response.json({ success: true, topup_id: topup.id, analyses, expiresAt });
  } catch (err) {
    console.error('[confirmTopup] error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});