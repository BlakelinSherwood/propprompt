import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

const TIER_PRICE_IDS = {
  starter: 'price_starter_placeholder',
  pro: 'price_pro_placeholder',
  team: 'price_team_placeholder',
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'platform_owner') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { territory_id, sublicensee_email, tier, revenue_share_pct, note } = body;

    if (!territory_id || !sublicensee_email || !tier || revenue_share_pct == null) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get territory
    const territories = await base44.asServiceRole.entities.Territory.filter({ id: territory_id });
    const territory = territories[0];
    if (!territory) return Response.json({ error: 'Territory not found' }, { status: 404 });

    // Get pricing config
    const configs = await base44.asServiceRole.entities.PricingConfig.list('', 1);
    const pricing = configs[0] || {};
    const tierPrices = { starter: pricing.starter_monthly_price || 49, pro: pricing.pro_monthly_price || 79, team: pricing.team_monthly_price || 129 };
    const monthlyPrice = tierPrices[tier];

    // Get or find sublicensee user
    const allUsers = await base44.asServiceRole.entities.User.filter({ email: sublicensee_email });
    const sublicenseeUser = allUsers[0];
    const sublicenseeUserId = sublicenseeUser?.id || sublicensee_email;

    let stripeSubscriptionId = null;
    let stripeCustomerId = null;

    // If user exists and has stripe_customer_id, create Stripe subscription
    if (sublicenseeUser?.stripe_customer_id) {
      try {
        stripeCustomerId = sublicenseeUser.stripe_customer_id;
        // Note: price ID lookup would need to be wired to actual Stripe prices
        // Skipping actual Stripe subscription creation until price IDs are configured
        console.log(`[createSublicense] Would create Stripe subscription for ${sublicensee_email} at $${monthlyPrice}/mo`);
      } catch (stripeErr) {
        console.error('[createSublicense] Stripe error:', stripeErr.message);
      }
    }

    // Create TerritorySubscription
    const subscription = await base44.asServiceRole.entities.TerritorySubscription.create({
      territory_id,
      user_id: sublicenseeUserId,
      tier,
      type: 'single',
      monthly_price: monthlyPrice,
      discount_pct: 0,
      analyses_cap: pricing[`${tier}_analyses_cap`] || 20,
      analyses_used_this_month: 0,
      status: 'active',
      sublicensor_id: user.id,
      sublicensor_revenue_share: revenue_share_pct,
      stripe_subscription_id: stripeSubscriptionId,
      stripe_customer_id: stripeCustomerId,
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    });

    // Update territory status
    await base44.asServiceRole.entities.Territory.update(territory_id, {
      status: 'sublicensed',
    });

    // Create initial ledger record for current month
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    const shareAmount = parseFloat(((monthlyPrice * revenue_share_pct) / 100).toFixed(2));

    await base44.asServiceRole.entities.RevenueShareLedger.create({
      sublicensor_id: user.id,
      sublicensee_subscription_id: subscription.id,
      territory_id,
      period_start: periodStart,
      period_end: periodEnd,
      gross_amount: monthlyPrice,
      share_pct: revenue_share_pct,
      share_amount: shareAmount,
      status: 'pending',
    });

    console.log(`[createSublicense] Created sublicense for ${sublicensee_email} on territory ${territory.city_town}`);
    return Response.json({ success: true, subscription_id: subscription.id, share_amount: shareAmount });
  } catch (err) {
    console.error('[createSublicense] error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});