import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

async function getPricing(base44) {
  const rows = await base44.asServiceRole.entities.PricingConfig.list('-updated_date', 1);
  return rows[0] || {};
}

// Packs are defined by config keys — not hardcoded
function getPacks(pricing) {
  return [
    {
      key: 'starter',
      analyses: parseInt(pricing.topup_starter_analyses || 10),
      price: parseFloat(pricing.topup_starter_price || 29),
    },
    {
      key: 'standard',
      analyses: parseInt(pricing.topup_standard_analyses || 25),
      price: parseFloat(pricing.topup_standard_price || 59),
    },
    {
      key: 'pro',
      analyses: parseInt(pricing.topup_pro_analyses || 50),
      price: parseFloat(pricing.topup_pro_price || 99),
    },
    {
      key: 'bulk',
      analyses: parseInt(pricing.topup_bulk_analyses || 100),
      price: parseFloat(pricing.topup_bulk_price || 179),
    },
  ];
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { pack_key, subscription_id, bundle_id, pool_id } = await req.json();

    const pricing = await getPricing(base44);
    const packs = getPacks(pricing);
    const pack = packs.find(p => p.key === pack_key);
    if (!pack) return Response.json({ error: 'Invalid pack key' }, { status: 400 });

    const expiryDays = parseInt(pricing.topup_expiry_days || 90);

    // Create Stripe PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(pack.price * 100),
      currency: 'usd',
      metadata: {
        base44_app_id: Deno.env.get('BASE44_APP_ID'),
        user_email: user.email,
        pack_key,
        analyses: pack.analyses,
      },
      automatic_payment_methods: { enabled: true },
    });

    return Response.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      publishableKey: Deno.env.get('STRIPE_PUBLISHABLE_KEY'),
      pack,
      expiryDays,
    });
  } catch (err) {
    console.error('[purchaseTopup] error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});