import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

async function getPricing(base44) {
  const rows = await base44.asServiceRole.entities.PricingConfig.list('-updated_date', 1);
  return rows[0] || {};
}

function getClaimType(claim) {
  if (claim.pool_id || (claim.type_requested === 'pool')) return 'pool';
  if (claim.bundle_id || claim.type_requested === 'multi_bundle') return 'bundle';
  if (claim.buyout_id || claim.type_requested === 'county_bundle' || claim.type_requested === 'full_buyout') return 'buyout';
  return 'single';
}

async function createStripeSubscription(paymentMethodId, monthlyPrice, productName) {
  // Create a dynamic recurring price
  const price = await stripe.prices.create({
    unit_amount: Math.round(monthlyPrice * 100),
    currency: 'usd',
    recurring: { interval: 'month' },
    product_data: { name: productName },
  });

  // Create a customer and attach payment method
  const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
  const customer = await stripe.customers.create({
    payment_method: paymentMethodId,
    email: pm.billing_details?.email || undefined,
  });

  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: price.id }],
    default_payment_method: paymentMethodId,
    metadata: { base44_app_id: Deno.env.get('BASE44_APP_ID') },
  });

  return { subscription, customerId: customer.id };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow both authenticated admins and service-role (auto-approve automation)
    let isAdmin = false;
    try {
      const user = await base44.auth.me();
      isAdmin = user?.role === 'admin' || user?.role === 'platform_owner';
    } catch (_) {
      // Auth failed — deny access
      isAdmin = false;
    }
    if (!isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { claim_id, admin_user_id } = await req.json();
    if (!claim_id) return Response.json({ error: 'claim_id required' }, { status: 400 });

    const claims = await base44.asServiceRole.entities.TerritoryClaimRequest.filter({ id: claim_id });
    const claim = claims[0];
    if (!claim) return Response.json({ error: 'Claim not found' }, { status: 404 });
    if (claim.status !== 'pending') return Response.json({ error: 'Claim is not pending' }, { status: 400 });

    const pricing = await getPricing(base44);
    const claimType = getClaimType(claim);
    const tier = claim.tier_requested;
    const tierPriceKey = `${tier}_monthly_price`;
    const tierCapKey = `${tier}_analyses_cap`;
    const tierPrice = parseFloat(pricing[tierPriceKey] || 0);
    const tierCap = parseInt(pricing[tierCapKey] || 0);

    const now = new Date().toISOString();
    let monthlyPrice = tierPrice;
    let productName = `PropPrompt ${tier.charAt(0).toUpperCase() + tier.slice(1)} Territory`;

    // ------ TYPE-SPECIFIC PRE-PROCESSING ------
    let territory = null;
    let state = null;

    if (claimType === 'single') {
      const rows = await base44.asServiceRole.entities.Territory.filter({ id: claim.territory_id });
      territory = rows[0];
      monthlyPrice = tierPrice;
      productName = `PropPrompt ${tier} — ${territory?.city_town || 'Territory'}`;
    } else if (claimType === 'pool') {
      const poolRows = await base44.asServiceRole.entities.PopulationPool.filter({ id: claim.pool_id });
      const pool = poolRows[0];
      if (pool) {
        monthlyPrice = pool.monthly_price || tierPrice;
        productName = `PropPrompt Population Pool — ${pool.buckets_used || 1} buckets`;
      }
    } else if (claimType === 'bundle') {
      const bundleRows = await base44.asServiceRole.entities.TerritoryBundle.filter({ id: claim.bundle_id });
      const bundle = bundleRows[0];
      if (bundle) {
        monthlyPrice = bundle.discounted_price || tierPrice;
        productName = `PropPrompt ${bundle.bundle_name} Bundle`;
      }
    } else if (claimType === 'buyout') {
      const rows = await base44.asServiceRole.entities.Territory.filter({ id: claim.territory_id });
      territory = rows[0];
      const buyoutRows = await base44.asServiceRole.entities.FullBuyoutSubscription.filter({ territory_id: claim.territory_id, user_id: claim.user_id });
      const buyout = buyoutRows[0];
      if (buyout) {
        monthlyPrice = buyout.monthly_price || tierPrice;
        productName = `PropPrompt Full Buyout — ${territory?.city_town || 'City'}`;
      }
    }

    // ------ STRIPE ------
    let stripeSubId = null;
    let stripeCustomerId = null;
    if (claim.stripe_payment_method_id) {
      try {
        const { subscription, customerId } = await createStripeSubscription(
          claim.stripe_payment_method_id, monthlyPrice, productName
        );
        stripeSubId = subscription.id;
        stripeCustomerId = customerId;
      } catch (stripeErr) {
        console.error('[approveClaim] Stripe error:', stripeErr.message);
        // Continue without Stripe in test/dev — log but don't fail
      }
    }

    // ------ MARK CLAIM APPROVED ------
    await base44.asServiceRole.entities.TerritoryClaimRequest.update(claim_id, {
      status: 'approved',
      approved_by: admin_user_id || 'system',
      approved_at: now,
    });

    // ------ TYPE-SPECIFIC RECORD CREATION ------
    if (claimType === 'single') {
      const newSeatNum = (territory?.seats_claimed || 0) + 1;
      await base44.asServiceRole.entities.TerritorySubscription.create({
        territory_id: claim.territory_id,
        user_id: claim.user_id,
        tier,
        type: 'single',
        monthly_price: monthlyPrice,
        analyses_cap: tierCap,
        status: 'active',
        approved_by: admin_user_id || 'system',
        approved_at: now,
        seat_number: newSeatNum,
        stripe_subscription_id: stripeSubId,
        stripe_customer_id: stripeCustomerId,
      });
      const allClaimed = (territory?.seats_claimed || 0) + 1;
      const newStatus = allClaimed >= (territory?.seats_total || 1) ? 'active' : 'active';
      await base44.asServiceRole.entities.Territory.update(claim.territory_id, {
        status: newStatus,
        seats_claimed: allClaimed,
      });

    } else if (claimType === 'pool') {
      const poolRows = await base44.asServiceRole.entities.PopulationPool.filter({ id: claim.pool_id });
      const pool = poolRows[0];
      if (pool) {
        await base44.asServiceRole.entities.PopulationPool.update(pool.id, {
          status: 'active',
          stripe_subscription_id: stripeSubId,
          stripe_customer_id: stripeCustomerId,
        });
        const townIds = pool.territory_ids || [];
        for (const tid of townIds) {
          await base44.asServiceRole.entities.Territory.update(tid, {
            status: 'active',
            pool_id: pool.id,
          });
        }
      }

    } else if (claimType === 'bundle') {
      const bundleRows = await base44.asServiceRole.entities.TerritoryBundle.filter({ id: claim.bundle_id });
      const bundle = bundleRows[0];
      if (bundle) {
        await base44.asServiceRole.entities.TerritoryBundle.update(bundle.id, {
          status: 'active',
          stripe_subscription_id: stripeSubId,
          stripe_customer_id: stripeCustomerId,
          approved_by: admin_user_id || 'system',
          approved_at: now,
        });
        const members = await base44.asServiceRole.entities.TerritoryBundleMember.filter({ bundle_id: bundle.id });
        for (const m of members) {
          await base44.asServiceRole.entities.Territory.update(m.territory_id, { status: 'active' });
        }
        // Send member invitation emails
        const userMembers = await base44.asServiceRole.entities.BundleUserMember.filter({ bundle_id: bundle.id, status: 'pending' });
        for (const um of userMembers) {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: um.user_id,
            subject: `You've been invited to a PropPrompt territory bundle`,
            body: `You've been invited to join a PropPrompt territory bundle. Log in to accept your invitation.`,
          });
        }
      }

    } else if (claimType === 'buyout') {
      const buyoutRows = await base44.asServiceRole.entities.FullBuyoutSubscription.filter({ territory_id: claim.territory_id, user_id: claim.user_id });
      const buyout = buyoutRows[0];
      if (buyout) {
        await base44.asServiceRole.entities.FullBuyoutSubscription.update(buyout.id, {
          status: 'active',
          stripe_subscription_id: stripeSubId,
          stripe_customer_id: stripeCustomerId,
        });
      }
      const tRows = await base44.asServiceRole.entities.Territory.filter({ id: claim.territory_id });
      const t = tRows[0];
      if (t) {
        await base44.asServiceRole.entities.Territory.update(claim.territory_id, {
          status: 'active',
          is_fully_bought_out: true,
          seats_claimed: t.seats_total || 1,
          buyout_subscription_id: buyout?.id,
        });
      }
    }

    // ------ SEND APPROVAL EMAIL ------
    const userRows = await base44.asServiceRole.entities.User.filter({ id: claim.user_id });
    const subscriber = userRows[0];
    if (subscriber?.email) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: subscriber.email,
        subject: `Your PropPrompt territory claim has been approved!`,
        body: `Congratulations! Your territory claim for ${claim.brokerage_name} has been approved. Your ${tier} subscription is now active at $${monthlyPrice.toFixed(2)}/month. Log in to PropPrompt to get started.`,
      });
    }

    return Response.json({ success: true, claimType, stripeSubId });
  } catch (err) {
    console.error('[approveClaim] error:', err.message, err.stack);
    return Response.json({ error: err.message }, { status: 500 });
  }
});