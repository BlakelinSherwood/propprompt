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

    const { territory_id, sublicensee_email, sublicensee_user_id, tier, revenue_share_pct, note } = await req.json();

    if (!territory_id || !sublicensee_email || !tier || revenue_share_pct == null) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get pricing config
    const configs = await base44.asServiceRole.entities.PricingConfig.list();
    const pricing = configs[0] || {};
    const tierPrices = {
      starter: pricing.starter_monthly_price || 49,
      pro: pricing.pro_monthly_price || 79,
      team: pricing.team_monthly_price || 129,
    };
    const monthlyPrice = tierPrices[tier];

    // Get territory
    const territory = await base44.asServiceRole.entities.Territory.filter({ id: territory_id });
    if (!territory.length) return Response.json({ error: 'Territory not found' }, { status: 404 });
    const t = territory[0];

    // Find or resolve sublicensee user
    let resolvedUserId = sublicensee_user_id;
    if (!resolvedUserId) {
      const users = await base44.asServiceRole.entities.User.filter({ email: sublicensee_email });
      resolvedUserId = users[0]?.id || sublicensee_email;
    }

    // Create or retrieve Stripe customer for sublicensee
    let customerId;
    const existing = await stripe.customers.list({ email: sublicensee_email, limit: 1 });
    if (existing.data.length) {
      customerId = existing.data[0].id;
    } else {
      const customer = await stripe.customers.create({
        email: sublicensee_email,
        metadata: { base44_app_id: Deno.env.get('BASE44_APP_ID'), role: 'sublicensee', territory_id }
      });
      customerId = customer.id;
    }

    // Create Stripe price for this tier
    const stripePrice = await stripe.prices.create({
      unit_amount: Math.round(monthlyPrice * 100),
      currency: 'usd',
      recurring: { interval: 'month' },
      product_data: {
        name: `PropPrompt Sublicense — ${t.city_town} (${tier})`,
      },
      metadata: { base44_app_id: Deno.env.get('BASE44_APP_ID'), territory_id, tier }
    });

    // Create Stripe subscription (no payment method yet — sublicensee must complete onboarding)
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: stripePrice.id }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        base44_app_id: Deno.env.get('BASE44_APP_ID'),
        territory_id,
        sublicensor_id: user.id,
        revenue_share_pct: String(revenue_share_pct),
        type: 'sublicense'
      }
    });

    // Create TerritorySubscription record
    const tierCapMap = {
      starter: pricing.starter_analyses_cap || 20,
      pro: pricing.pro_analyses_cap || 50,
      team: pricing.team_analyses_cap || 100,
    };
    const sub = await base44.asServiceRole.entities.TerritorySubscription.create({
      territory_id,
      user_id: resolvedUserId,
      tier,
      type: 'single',
      monthly_price: monthlyPrice,
      discount_pct: 0,
      analyses_cap: tierCapMap[tier],
      analyses_used_this_month: 0,
      status: 'active',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      sublicensor_id: user.id,
      sublicensor_revenue_share: revenue_share_pct,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: customerId,
    });

    // Update territory status
    await base44.asServiceRole.entities.Territory.update(territory_id, {
      status: 'sublicensed',
    });

    // Create initial revenue share ledger entry
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    const shareAmount = parseFloat(((monthlyPrice * revenue_share_pct) / 100).toFixed(2));

    await base44.asServiceRole.entities.RevenueShareLedger.create({
      sublicensor_id: user.id,
      sublicensee_subscription_id: sub.id,
      territory_id,
      period_start: periodStart,
      period_end: periodEnd,
      gross_amount: monthlyPrice,
      share_pct: revenue_share_pct,
      share_amount: shareAmount,
      status: 'pending',
    });

    console.log(`[createSublicense] Created sublicense for ${sublicensee_email} on territory ${t.city_town}, share ${revenue_share_pct}%`);

    return Response.json({
      success: true,
      subscription_id: sub.id,
      stripe_subscription_id: subscription.id,
      client_secret: subscription.latest_invoice?.payment_intent?.client_secret,
    });
  } catch (error) {
    console.error('[createSublicense] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});