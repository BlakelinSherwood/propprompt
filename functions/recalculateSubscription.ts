import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

async function getPricing(base44) {
  const rows = await base44.asServiceRole.entities.PricingConfig.list('-updated_date', 1);
  return rows[0] || {};
}

function getBundleTier(count, pricing) {
  if (count >= 20) return { name: 'master', discount: parseFloat(pricing.bundle_master_discount || 0), multiplier: parseFloat(pricing.bundle_master_cap_multiplier || 100) };
  if (count >= 10) return { name: 'district', discount: parseFloat(pricing.bundle_district_discount || 0), multiplier: parseFloat(pricing.bundle_district_cap_multiplier || 100) };
  if (count >= 5)  return { name: 'regional', discount: parseFloat(pricing.bundle_regional_discount || 0), multiplier: parseFloat(pricing.bundle_regional_cap_multiplier || 100) };
  if (count >= 3)  return { name: 'trio', discount: parseFloat(pricing.bundle_trio_discount || 0), multiplier: parseFloat(pricing.bundle_trio_cap_multiplier || 100) };
  if (count >= 2)  return { name: 'duo', discount: parseFloat(pricing.bundle_duo_discount || 0), multiplier: parseFloat(pricing.bundle_duo_cap_multiplier || 100) };
  return { name: 'duo', discount: 0, multiplier: 100 };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { id, type } = await req.json();
    if (!id || !type) return Response.json({ error: 'id and type required' }, { status: 400 });

    const pricing = await getPricing(base44);

    if (type === 'bundle') {
      const bundleRows = await base44.asServiceRole.entities.TerritoryBundle.filter({ id });
      const bundle = bundleRows[0];
      if (!bundle) return Response.json({ error: 'Bundle not found' }, { status: 404 });

      const members = await base44.asServiceRole.entities.TerritoryBundleMember.filter({ bundle_id: id });
      const count = members.length;
      const tier = bundle.tier;
      const tierPrice = parseFloat(pricing[`${tier}_monthly_price`] || 0);
      const tierCap = parseInt(pricing[`${tier}_analyses_cap`] || 0);

      const { name: bundleName, discount, multiplier } = getBundleTier(count, pricing);
      const basePrice = count * tierPrice;
      const discountedPrice = basePrice * (1 - discount / 100);
      const analysesCap = Math.floor(count * tierCap * (multiplier / 100));

      await base44.asServiceRole.entities.TerritoryBundle.update(id, {
        bundle_name: bundleName,
        territory_count: count,
        discount_pct: discount,
        base_price: basePrice,
        discounted_price: discountedPrice,
        analyses_cap: analysesCap,
      });

      return Response.json({ success: true, bundleName, count, discount, basePrice, discountedPrice, analysesCap });

    } else if (type === 'pool') {
      const poolRows = await base44.asServiceRole.entities.PopulationPool.filter({ id });
      const pool = poolRows[0];
      if (!pool) return Response.json({ error: 'Pool not found' }, { status: 404 });

      const members = await base44.asServiceRole.entities.PopulationPoolMember.filter({ pool_id: id });
      const combinedPop = members.reduce((s, m) => s + (m.population_contribution || 0), 0);
      const bucketSize = parseInt(pricing.territory_seat_size || 50000);
      const buckets = Math.max(1, Math.ceil(combinedPop / bucketSize));
      const tier = pool.tier;
      const tierPrice = parseFloat(pricing[`${tier}_monthly_price`] || 0);
      const tierCap = parseInt(pricing[`${tier}_analyses_cap`] || 0);
      const monthlyPrice = buckets * tierPrice;
      const analysesCap = buckets * tierCap;

      await base44.asServiceRole.entities.PopulationPool.update(id, {
        territory_ids: members.map(m => m.territory_id),
        combined_population: combinedPop,
        buckets_used: buckets,
        monthly_price: monthlyPrice,
        analyses_cap: analysesCap,
      });

      return Response.json({ success: true, combinedPop, buckets, monthlyPrice, analysesCap, tierPrice, tierCap });
    }

    return Response.json({ error: 'Invalid type' }, { status: 400 });
  } catch (err) {
    console.error('[recalculateSubscription] error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});