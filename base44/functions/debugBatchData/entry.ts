import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const configs = await base44.asServiceRole.entities.PlatformConfig.filter({});
    const config = configs[0];
    if (!config?.batchdata_api_key) return Response.json({ error: 'No BatchData key' }, { status: 402 });
    const batchDataKey = config.batchdata_api_key;

    const results = {};

    // ── TEST 1: Property search (stub data only — confirms search works) ─────
    const searchRes = await fetch('https://api.batchdata.com/api/v1/property/search', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${batchDataKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        searchCriteria: {
          compAddress: { street: "11 Holly Lane", city: "Beverly", state: "MA", zip: "01915" },
        },
        options: { useDistance: true, distanceMiles: 2.0 },
      }),
    });
    const searchData = await searchRes.json();
    const searchProps = searchData.results?.properties || [];
    results['search_status'] = searchRes.status;
    results['search_count'] = searchProps.length;
    results['search_prop_keys'] = searchProps[0] ? Object.keys(searchProps[0]) : [];
    results['search_sample_address'] = searchProps[0]?.address || null;

    // ── TEST 2: Full lookup — hardcoded known address (bypass search dependency) ──
    const knownAddr = searchProps[0]?.address || { street: "40 James St", city: "Beverly", state: "MA", zip: "01915" };
    if (knownAddr) {
      const fullRes = await fetch('https://api.batchdata.com/api/v1/property/lookup/all-attributes', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${batchDataKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            address: {
              street: knownAddr.street,  // e.g. "40 James St" (already includes house number)
              city: knownAddr.city,
              state: knownAddr.state,
              zip: knownAddr.zip,
            }
          }]
        }),
      });
      const fullData = await fullRes.json();
      const fullProp = fullData.results?.properties?.[0] || null;
      results['full_lookup_status'] = fullRes.status;
      results['full_match_count'] = fullData.results?.meta?.results?.matchCount ?? fullData.results?.properties?.length ?? 0;
      results['full_prop_keys'] = fullProp ? Object.keys(fullProp) : [];
      results['full_listing'] = fullProp?.listing || null;
      results['full_deed_count'] = fullProp?.deedHistory?.length || 0;
      results['full_deed_last'] = fullProp?.deedHistory?.[fullProp.deedHistory.length - 1] || null;
      results['full_building'] = fullProp?.building || null;
      results['full_assessed'] = fullProp?.assessed || null;
      results['full_address_confirmed'] = fullProp?.address || null;
    } else {
      results['full_lookup_skip'] = 'search returned 0 props — nothing to look up';
    }

    // ── TEST 3: Bulk lookup of first 3 search result addresses (if search worked) ──
    if (searchProps.length >= 3) {
      const requests = searchProps.slice(0, 3).map(p => ({
        address: { street: p.address.street, city: p.address.city, state: p.address.state, zip: p.address.zip }
      }));
      const bulkRes = await fetch('https://api.batchdata.com/api/v1/property/lookup/all-attributes', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${batchDataKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests }),
      });
      const bulkData = await bulkRes.json();
      const bulkProps = bulkData.results?.properties || [];
      results['bulk_lookup_status'] = bulkRes.status;
      results['bulk_match_count'] = bulkData.results?.meta?.results?.matchCount ?? bulkProps.length;
      results['bulk_props_with_listing'] = bulkProps.filter(p => p.listing?.soldPrice).length;
      results['bulk_props_with_deed'] = bulkProps.filter(p => p.deedHistory?.length > 0).length;
      results['bulk_sample_prop0_keys'] = bulkProps[0] ? Object.keys(bulkProps[0]) : [];
      results['bulk_sample_listing'] = bulkProps[0]?.listing || null;
      results['bulk_sample_deed_last'] = bulkProps[0]?.deedHistory?.[bulkProps[0].deedHistory.length - 1] || null;
    }

    return Response.json(results);
  } catch (error) {
    console.error('[debugBatchData]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});