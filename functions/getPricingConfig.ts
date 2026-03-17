import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

let cache = null;
let cacheLoadedAt = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function loadPricing(base44) {
  const rows = await base44.asServiceRole.entities.PricingConfig.list('-updated_date', 1);
  const record = rows[0] || {};
  // Remove internal fields
  const { id, created_date, updated_date, created_by, ...pricing } = record;
  cache = pricing;
  cacheLoadedAt = Date.now();
  return pricing;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json().catch(() => ({}));
    const forceRefresh = body?.force_refresh === true;

    if (!forceRefresh && cache && cacheLoadedAt && (Date.now() - cacheLoadedAt) < CACHE_TTL_MS) {
      return Response.json({ pricing: cache, cached: true });
    }

    const pricing = await loadPricing(base44);
    return Response.json({ pricing, cached: false });
  } catch (err) {
    console.error('[getPricingConfig] error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});