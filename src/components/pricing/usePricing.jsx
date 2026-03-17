import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

let _cache = null;

export function usePricing() {
  const [pricing, setPricing] = useState(_cache || {});
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
      // Fall back to empty object — components should handle missing values gracefully
      if (!_cache) _cache = {};
      setPricing(_cache);
    }
    setLoading(false);
    return _cache;
  }, []);

  useEffect(() => {
    if (!_cache) load();
  }, [load]);

  const refresh = () => load(true);

  return { pricing, loading, refresh };
}