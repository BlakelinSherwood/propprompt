import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

let cache = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const forceRefresh = url.searchParams.get('force_refresh') === 'true';

    // Check cache
    if (!forceRefresh && cache && Date.now() - cacheTime < CACHE_TTL) {
      return Response.json(cache);
    }

    const base44 = createClientFromRequest(req);
    const configs = await base44.asServiceRole.entities.PricingConfig.list('', 1);
    
    if (!configs || configs.length === 0) {
      return Response.json({
        starter_monthly_price: 99,
        pro_monthly_price: 149,
        team_monthly_price: 249,
        starter_analyses_cap: 30,
        pro_analyses_cap: 50,
        team_analyses_cap: 100,
        territory_seat_size: 50000,
        bundle_duo_discount: 10,
        bundle_trio_discount: 15,
        bundle_regional_discount: 20,
        bundle_district_discount: 25,
        bundle_master_discount: 30,
        buyout_2seat_discount: 15,
        buyout_3_4seat_discount: 25,
        buyout_5_9seat_discount: 35,
        buyout_10plus_seat_discount: 40,
        topup_starter_price: 29,
        topup_starter_analyses: 10,
        topup_expiry_days: 90,
      });
    }

    const config = configs[0];
    delete config.id;
    delete config.created_date;
    delete config.updated_date;
    delete config.created_by;

    cache = config;
    cacheTime = Date.now();

    return Response.json(config);
  } catch (error) {
    console.error('getPricingConfig error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});