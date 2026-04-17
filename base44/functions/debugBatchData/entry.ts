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

    // Test correct base URL (no /api/v1/) with datasets for enriched data
    const searchRes = await fetch('https://api.batchdata.com/api/v1/property/search', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${batchDataKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        searchCriteria: {
          compAddress: { street: "11 Holly Lane", city: "Beverly", state: "MA", zip: "01915" },
        },
        options: { useDistance: true, distanceMiles: 5.0 },
        take: 3,
        datasets: ["basic", "listing", "deed"],
      }),
    });
    const searchData = await searchRes.json();
    const searchProps = searchData.results?.properties || [];
    results['search_with_datasets'] = {
      status: searchRes.status,
      count: searchProps.length,
      prop_keys: searchProps[0] ? Object.keys(searchProps[0]) : [],
      listing_keys: searchProps[0]?.listing ? Object.keys(searchProps[0].listing) : [],
      deed_count: searchProps[0]?.deedHistory?.length || 0,
      sample_listing: searchProps[0]?.listing || null,
      sample_deed_last: searchProps[0]?.deedHistory?.[0] || null,
    };

    // Test lookup/all-attributes with requests array format
    const lookupRes = await fetch('https://api.batchdata.com/api/v1/property/lookup/all-attributes', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${batchDataKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{
          address: { street: "11 Holly Lane", city: "Beverly", state: "MA", zip: "01915" },
        }],
      }),
    });
    const lookupData = await lookupRes.json();
    results['lookup_all_attributes'] = {
      status: lookupRes.status,
      top_keys: Object.keys(lookupData),
      results_keys: lookupData.results ? Object.keys(lookupData.results) : [],
      prop_keys: lookupData.results?.property ? Object.keys(lookupData.results.property) : [],
      listing_keys: lookupData.results?.property?.listing ? Object.keys(lookupData.results.property.listing) : [],
      deed_count: lookupData.results?.property?.deedHistory?.length || 0,
      sale_price: lookupData.results?.property?.listing?.soldPrice || null,
      snippet: JSON.stringify(lookupData).slice(0, 600),
    };

    // Also test property/comps endpoint directly
    const compsRes = await fetch('https://api.batchdata.com/api/v1/property/comps', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${batchDataKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        searchCriteria: {
          address: { street: "11 Holly Lane", city: "Beverly", state: "MA", zip: "01915" },
        },
        options: { distanceMiles: 5.0 },
        take: 5,
      }),
    });
    const compsData = await compsRes.json();
    results['property_comps_endpoint'] = {
      status: compsRes.status,
      snippet: JSON.stringify(compsData).slice(0, 600),
    };

    const sampleProps = searchProps;
    results['total_from_search'] = sampleProps.length;
    results['sample_prop_id'] = sampleProps[0]?._id;

    // Now fetch full details for the first property using all-attributes with _id
    if (sampleProps[0]) {
      const firstId = sampleProps[0]._id;
      const fullRes = await fetch('https://api.batchdata.com/api/v1/property/lookup/all-attributes', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${batchDataKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: [{ id: firstId }] }),
      });
      const fullData = await fullRes.json();
      const fullProp = fullData.results?.properties?.[0] || null;
      results['full_lookup_status'] = fullRes.status;
      results['full_prop_keys'] = fullProp ? Object.keys(fullProp) : [];
      results['full_listing'] = fullProp?.listing || null;
      results['full_listing_keys'] = fullProp?.listing ? Object.keys(fullProp.listing) : [];
      results['full_deed_count'] = fullProp?.deedHistory?.length || 0;
      results['full_deed_last'] = fullProp?.deedHistory?.[fullProp.deedHistory.length - 1] || null;
      results['full_address'] = fullProp?.address || null;
    }

    return Response.json(results);
  } catch (error) {
    console.error('[debugBatchData]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});