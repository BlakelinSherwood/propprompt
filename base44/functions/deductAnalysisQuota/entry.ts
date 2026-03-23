import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    if (user.role === 'platform_owner') {
      return Response.json({ deducted: true, unlimited: true });
    }

    const { source, subscription, pack_id, refund } = await req.json();
    // source: 'monthly_cap' | 'topup'
    // subscription: { type, id }
    // refund: boolean — if true, reverse the deduction

    if (source === 'topup' && pack_id) {
      const packs = await base44.asServiceRole.entities.TopupPack.filter({ id: pack_id });
      const pack = packs[0];
      if (!pack) return Response.json({ error: 'Pack not found' }, { status: 404 });
      const delta = refund ? 1 : -1;
      await base44.asServiceRole.entities.TopupPack.update(pack_id, {
        analyses_remaining: Math.max(0, (pack.analyses_remaining || 0) + delta),
      });
      return Response.json({ deducted: !refund, source: 'topup' });
    }

    if (source === 'monthly_cap' && subscription) {
      const { type, id } = subscription;
      const delta = refund ? -1 : 1;

      if (type === 'single') {
        const rows = await base44.asServiceRole.entities.TerritorySubscription.filter({ id });
        const sub = rows[0];
        if (!sub) return Response.json({ error: 'Subscription not found' }, { status: 404 });
        await base44.asServiceRole.entities.TerritorySubscription.update(id, {
          analyses_used_this_month: Math.max(0, (sub.analyses_used_this_month || 0) + delta),
        });

      } else if (type === 'pool') {
        const rows = await base44.asServiceRole.entities.PopulationPool.filter({ id });
        const pool = rows[0];
        if (!pool) return Response.json({ error: 'Pool not found' }, { status: 404 });
        await base44.asServiceRole.entities.PopulationPool.update(id, {
          analyses_used_this_month: Math.max(0, (pool.analyses_used_this_month || 0) + delta),
        });

      } else if (type === 'bundle') {
        const rows = await base44.asServiceRole.entities.TerritoryBundle.filter({ id });
        const bundle = rows[0];
        if (!bundle) return Response.json({ error: 'Bundle not found' }, { status: 404 });
        await base44.asServiceRole.entities.TerritoryBundle.update(id, {
          analyses_used_this_month: Math.max(0, (bundle.analyses_used_this_month || 0) + delta),
        });
        // Also increment BundleUserMember
        const userMembers = await base44.asServiceRole.entities.BundleUserMember.filter({ bundle_id: id, user_id: user.id });
        if (userMembers[0]) {
          await base44.asServiceRole.entities.BundleUserMember.update(userMembers[0].id, {
            analyses_this_month: Math.max(0, (userMembers[0].analyses_this_month || 0) + delta),
          });
        }

      } else if (type === 'buyout') {
        const rows = await base44.asServiceRole.entities.FullBuyoutSubscription.filter({ id });
        const bo = rows[0];
        if (!bo) return Response.json({ error: 'Buyout subscription not found' }, { status: 404 });
        await base44.asServiceRole.entities.FullBuyoutSubscription.update(id, {
          analyses_used_this_month: Math.max(0, (bo.analyses_used_this_month || 0) + delta),
        });
      }

      return Response.json({ deducted: !refund, source: 'monthly_cap', type, id });
    }

    return Response.json({ error: 'Invalid deduction parameters' }, { status: 400 });
  } catch (err) {
    console.error('[deductAnalysisQuota] error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});