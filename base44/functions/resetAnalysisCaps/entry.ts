import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Reset all four subscription types
    const [singles, pools, bundles, buyouts, bundleMembers] = await Promise.all([
      base44.asServiceRole.entities.TerritorySubscription.filter({ status: 'active' }),
      base44.asServiceRole.entities.PopulationPool.filter({ status: 'active' }),
      base44.asServiceRole.entities.TerritoryBundle.filter({ status: 'active' }),
      base44.asServiceRole.entities.FullBuyoutSubscription.filter({ status: 'active' }),
      base44.asServiceRole.entities.BundleUserMember.filter({ status: 'active' }),
    ]);

    let resetCount = 0;

    await Promise.all([
      ...singles.map(s => base44.asServiceRole.entities.TerritorySubscription.update(s.id, { analyses_used_this_month: 0 })),
      ...pools.map(p => base44.asServiceRole.entities.PopulationPool.update(p.id, { analyses_used_this_month: 0 })),
      ...bundles.map(b => base44.asServiceRole.entities.TerritoryBundle.update(b.id, { analyses_used_this_month: 0 })),
      ...buyouts.map(b => base44.asServiceRole.entities.FullBuyoutSubscription.update(b.id, { analyses_used_this_month: 0 })),
      ...bundleMembers.map(m => base44.asServiceRole.entities.BundleUserMember.update(m.id, { analyses_this_month: 0 })),
    ]);

    resetCount = singles.length + pools.length + bundles.length + buyouts.length;

    console.log(`[resetAnalysisCaps] Reset ${resetCount} subscriptions, ${bundleMembers.length} bundle members`);

    // Notify platform owner
    const admins = await base44.asServiceRole.entities.User.filter({ role: 'platform_owner' });
    for (const admin of admins) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: admin.email,
        subject: 'PropPrompt: Monthly analysis caps reset',
        body: `Monthly analysis caps have been reset.\n\n- Single territory subscriptions: ${singles.length}\n- Population pools: ${pools.length}\n- Territory bundles: ${bundles.length}\n- Full buyouts: ${buyouts.length}\n- Bundle members: ${bundleMembers.length}\n\nAll analyses_used_this_month counters are now 0.`,
      });
    }

    return Response.json({ success: true, resetCount });
  } catch (err) {
    console.error('[resetAnalysisCaps] error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});