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
      (!p.subscription_id && !p.bundle_id && !p.pool_id)
    )
  );
  return valid[0] || null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // platform_owner and admin always get unlimited access
    const ALWAYS_UNLIMITED = ['platform_owner', 'admin'];
    if (ALWAYS_UNLIMITED.includes(user.role)) {
      return Response.json({ allowed: true, unlimited: true, analyses_cap: 9999, analyses_used_this_month: 0 });
    }

    // team_agent / team_admin get unlimited only if their org is owned by a platform_owner or admin
    if (['team_agent', 'team_admin', 'brokerage_admin', 'team_lead'].includes(user.role)) {
      const memberships = await base44.asServiceRole.entities.OrgMembership.filter({ user_email: user.email, status: 'active' });
      if (memberships.length > 0) {
        const orgIds = memberships.map(m => m.org_id);
        // Check if any of these orgs is owned by a platform_owner/admin
        const orgs = await Promise.all(orgIds.map(id => base44.asServiceRole.entities.Organization.filter({ id })));
        const flatOrgs = orgs.flat();
        const owners = flatOrgs.map(o => o.owner_email).filter(Boolean);
        if (owners.length > 0) {
          const ownerUsers = await Promise.all(owners.map(email => base44.asServiceRole.entities.User.filter({ email })));
          const flatOwners = ownerUsers.flat();
          const isPlatformTeam = flatOwners.some(u => ['platform_owner', 'admin'].includes(u.role));
          if (isPlatformTeam) {
            return Response.json({ allowed: true, unlimited: true, analyses_cap: 9999, analyses_used_this_month: 0 });
          }
        }
      }
      // brokerage_admin and team_lead without a platform org still get unlimited (original behavior)
      if (['brokerage_admin', 'team_lead'].includes(user.role)) {
        return Response.json({ allowed: true, unlimited: true, analyses_cap: 9999, analyses_used_this_month: 0 });
      }
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

    const subscriptionStatuses = [];

    for (const sub of subs.singles) {
      const cap = sub.analyses_cap || tierCapMap[sub.tier] || 0;
      const used = sub.analyses_used_this_month || 0;
      subscriptionStatuses.push({ type: 'single', id: sub.id, cap, used, remaining: cap - used, tier: sub.tier });
    }

    for (const pool of subs.pools) {
      const tierCap = tierCapMap[pool.tier] || 0;
      const cap = pool.analyses_cap || (pool.buckets_used || 1) * tierCap;
      const used = pool.analyses_used_this_month || 0;
      subscriptionStatuses.push({ type: 'pool', id: pool.id, cap, used, remaining: cap - used, tier: pool.tier });
    }

    for (const bundle of subs.bundles) {
      const cap = bundle.analyses_cap || 0;
      const used = bundle.analyses_used_this_month || 0;
      subscriptionStatuses.push({ type: 'bundle', id: bundle.id, cap, used, remaining: cap - used, tier: bundle.tier });
    }

    for (const bo of subs.buyouts) {
      const cap = bo.analyses_cap || 0;
      const used = bo.analyses_used_this_month || 0;
      subscriptionStatuses.push({ type: 'buyout', id: bo.id, cap, used, remaining: cap - used, tier: bo.tier });
    }

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