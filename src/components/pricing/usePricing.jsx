import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const DEFAULT_PRICING = {
  starter_monthly_price: 99,
  pro_monthly_price: 199,
  team_monthly_price: 299,
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
};

let _cache = null;

export function usePricing() {
  const [pricing, setPricing] = useState(_cache || DEFAULT_PRICING);
  const [loading, setLoading] = useState(!_cache);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('getPricingConfig', { force_refresh: force });
      if (res.data?.pricing) {
        _cache = res.data.pricing;
        setPricing(_cache);
      }
    } catch (err) {
      console.warn('[usePricing] Could not load pricing config:', err.message);
      if (!_cache) _cache = DEFAULT_PRICING;
      setPricing(_cache);
    }
    setLoading(false);
    return _cache;
  }, []);

  useEffect(() => {
    if (!_cache || Object.keys(_cache).length === 0) load();
  }, [load]);

  const refresh = () => load(true);

  return { pricing, loading, refresh };
}