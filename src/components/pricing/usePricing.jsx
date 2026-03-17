import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

let _cache = null;

export function usePricing() {
  const [pricing, setPricing] = useState(_cache || {});
  const [loading, setLoading] = useState(!_cache);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    const res = await base44.functions.invoke('getPricingConfig', { force_refresh: force });
    _cache = res.data.pricing;
    setPricing(_cache);
    setLoading(false);
    return _cache;
  }, []);

  useEffect(() => {
    if (!_cache) load();
  }, [load]);

  const refresh = () => load(true);

  return { pricing, loading, refresh };
}