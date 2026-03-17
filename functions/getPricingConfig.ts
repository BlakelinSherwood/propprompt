import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// In-memory cache: { data: {key: value}, loadedAt: timestamp }
let cache = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const forceRefresh = body?.force_refresh === true;

    // Return cache if fresh and not force-refreshed
    if (!forceRefresh && cache && (Date.now() - cache.loadedAt) < CACHE_TTL_MS) {
      return Response.json({ pricing: cache.data, from_cache: true });
    }

    // Load all rows from PricingConfig
    const rows = await base44.asServiceRole.entities.PricingConfig.list();

    // Build key-value map
    const pricing = {};
    for (const row of rows) {
      pricing[row.config_key] = row.config_value;
    }

    cache = { data: pricing, loadedAt: Date.now() };

    console.log(`[getPricingConfig] Loaded ${rows.length} pricing keys`);
    return Response.json({ pricing, from_cache: false });

  } catch (err) {
    console.error('[getPricingConfig] error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});