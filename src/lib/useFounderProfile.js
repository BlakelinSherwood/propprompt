import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

let _cache = null;

export function useFounderProfile() {
  const [founder, setFounder] = useState(_cache || null);
  const [loading, setLoading] = useState(!_cache);

  useEffect(() => {
    if (_cache) {
      setFounder(_cache);
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const profiles = await base44.entities.FounderProfile.list();
        const profile = profiles?.[0] || null;
        _cache = profile;
        setFounder(profile);
      } catch (err) {
        console.warn('[useFounderProfile] Error:', err.message);
        _cache = null;
        setFounder(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { founder, loading };
}