import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Module-level cache shared across requests in the same Deno isolate
let cache = null;
let cacheLoadedAt = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function loadPricing(base44) {
  const rows = await base44.asServiceRole.entities.PricingConfig.list('', 200);
  const map = {};
  for (const row of rows) {
    map[row.config_key] = row.config_value;
  }
  cache = map;
  cacheLoadedAt = Date.now();
  return map;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json().catch(() => ({}));
    const forceRefresh = body?.force_refresh === true;

    // Return cached if fresh and not forced
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