import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// Returns the active subscription records for a user across all 4 types
async function getUserSubscriptions(base44, userId) {
  const [singles, pools, bundles, buyouts] = await Promise.all([
    base44.asServiceRole.entities.TerritorySubscription.filter({ user_id: userId, status: 'active' }),
    base44.asServiceRole.entities.PopulationPool.filter({ owner_user_id: userId, status: 'active' }),
    base44.asServiceRole.entities.TerritoryBundle.filter({ owner_user_id: userId, status: 'active' }),
    base44.asServiceRole.entities.FullBuyoutSubscription.filter({ user_id: userId, status: 'active' }),
  ]);
  return { singles, pools, bundles, buyouts };
}

async function getPricing(base44) {
  const rows = await base44.asServiceRole.entities.PricingConfig.list('-updated_date', 1);
  return rows[0] || {};
}

// Find oldest-expiring topup pack with remaining analyses
async function findTopupPack(base44, userId, subs) {
  const now = new Date().toISOString();

  // Build list of subscription IDs to check
  const subIds = subs.singles.map(s => s.id);
  const bundleIds = subs.bundles.map(b => b.id);
  const poolIds = subs.pools.map(p => p.id);

  const allPacks = await base44.asServiceRole.entities.TopupPack.list('expires_at', 200);
  const valid = allPacks.filter(p =>
    p.analyses_remaining > 0 &&
    p.expires_at > now &&
    (
      (p.subscription_id && subIds.includes(p.subscription_id)) ||
      (p.bundle_id && bundleIds.includes(p.bundle_id)) ||
      (p.pool_id && poolIds.includes(p.pool_id)) ||
      // If pack has no subscription linkage but belongs to user (legacy)
      (!p.subscription_id && !p.bundle_id && !p.pool_id)
    )
  );

  // Return oldest-expiring first
  return valid[0] || null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // platform_owner is always unlimited
    if (user.role === 'platform_owner') {
      return Response.json({ allowed: true, unlimited: true, analyses_cap: Infinity, analyses_used_this_month: 0 });
    }

    let user_id;
    try {
      const body = await req.json();
      user_id = body.user_id;
    } catch {
      // No body or invalid JSON
    }
    const targetUserId = user_id || user.id;

    const [subs, pricing] = await Promise.all([
      getUserSubscriptions(base44, targetUserId),
      getPricing(base44),
    ]);

    const tierCapMap = {
      starter: parseInt(pricing.starter_analyses_cap || 0),
      pro: parseInt(pricing.pro_analyses_cap || 0),
      team: parseInt(pricing.team_analyses_cap || 0),
    };

    // Check each subscription type independently
    // If ANY has remaining capacity, allowed = true
    const subscriptionStatuses = [];

    // Singles
    for (const sub of subs.singles) {
      const cap = sub.analyses_cap || tierCapMap[sub.tier] || 0;
      const used = sub.analyses_used_this_month || 0;
      subscriptionStatuses.push({ type: 'single', id: sub.id, cap, used, remaining: cap - used, tier: sub.tier });
    }

    // Pools
    for (const pool of subs.pools) {
      const tierCap = tierCapMap[pool.tier] || 0;
      const cap = pool.analyses_cap || (pool.buckets_used || 1) * tierCap;
      const used = pool.analyses_used_this_month || 0;
      subscriptionStatuses.push({ type: 'pool', id: pool.id, cap, used, remaining: cap - used, tier: pool.tier });
    }

    // Bundles
    for (const bundle of subs.bundles) {
      const cap = bundle.analyses_cap || 0;
      const used = bundle.analyses_used_this_month || 0;
      subscriptionStatuses.push({ type: 'bundle', id: bundle.id, cap, used, remaining: cap - used, tier: bundle.tier });
    }

    // Buyouts
    for (const bo of subs.buyouts) {
      const cap = bo.analyses_cap || 0;
      const used = bo.analyses_used_this_month || 0;
      subscriptionStatuses.push({ type: 'buyout', id: bo.id, cap, used, remaining: cap - used, tier: bo.tier });
    }

    // Find first subscription with remaining capacity (monthly cap)
    const availableSub = subscriptionStatuses.find(s => s.remaining > 0);
    if (availableSub) {
      return Response.json({
        allowed: true,
        source: 'monthly_cap',
        subscription: availableSub,
        remaining: availableSub.remaining,
        all_subscriptions: subscriptionStatuses,
      });
    }

    // All monthly caps exhausted — check topup packs
    const pack = await findTopupPack(base44, targetUserId, subs);
    if (pack) {
      return Response.json({
        allowed: true,
        source: 'topup',
        pack_id: pack.id,
        remaining: pack.analyses_remaining,
        all_subscriptions: subscriptionStatuses,
      });
    }

    // Everything exhausted
    const totalCap = subscriptionStatuses.reduce((s, x) => s + x.cap, 0);
    const totalUsed = subscriptionStatuses.reduce((s, x) => s + x.used, 0);
    return Response.json({
      allowed: false,
      cap: totalCap,
      used: totalUsed,
      all_subscriptions: subscriptionStatuses,
    });

  } catch (err) {
    console.error('[checkAnalysisQuota] error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});