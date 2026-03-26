import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { address, bedrooms, bathrooms, sqft, propertyType, forceRefresh } = await req.json();
    if (!address) return Response.json({ error: 'address required' }, { status: 400 });

    // Parse address: "123 Main St, City, State 12345"
    const parts = address.split(',').map(p => p.trim());
    const street = parts[0] || '';
    const cityState = parts[1] || '';
    const zip = parts[2] || '';
    
    const [city, state] = cityState.split(/\s+/).slice(0, 2);

    // Get BatchData API key from PlatformConfig
    const configs = await base44.asServiceRole.entities.PlatformConfig.list();
    const config = configs[0];
    if (!config?.batchdata_api_key) {
      return Response.json({ success: false, message: 'BatchData API key not configured' }, { status: 402 });
    }

    const batchDataKey = config.batchdata_api_key;

    // Map property type for BatchData
    const typeMap = {
      'single_family': 'SFR',
      'condo': 'CONDO',
      'multi_family': 'MF2TO4',
      'land': 'SFR' // fallback
    };
    const batchDataType = typeMap[propertyType] || 'SFR';

    // Large property flag: omit bedroom constraints for sqft >= 4000
    const isLargeProperty = sqft >= 4000;

    // Tiered waterfall: expand radius and relax constraints progressively
    const tiers = [
      {
        radius: 0.5,
        maxResults: 10,
        radiusLabel: '0.5 mi',
        bedOffset: 1,
        sqftPercent: 0.20,
      },
      {
        radius: 1.0,
        maxResults: 12,
        radiusLabel: '1.0 mi',
        bedOffset: 2,
        sqftPercent: 0.30,
      },
      {
        radius: 2.0,
        maxResults: 15,
        radiusLabel: '2.0 mi',
        bedOffset: 3,
        sqftPercent: 0.40,
      },
      {
        radius: 3.0,
        maxResults: 20,
        radiusLabel: '3.0 mi',
        bedOffset: 4,
        sqftPercent: 0.50,
      },
    ];

    let allComps = [];
    let successTier = null;

    for (const tier of tiers) {
      console.log(`[fetchCompsFromBatchData] Trying tier with radius ${tier.radius}mi`);

      const searchCriteria = {
        compAddress: {
          street,
          city,
          state,
          zip,
        },
        propertyType: batchDataType,
        radiusMiles: tier.radius,
        maxResults: tier.maxResults,
        soldWithinMonths: 12,
      };

      // Add bedroom constraints unless large property
      if (!isLargeProperty && bedrooms) {
        searchCriteria.bedroomsRange = {
          min: Math.max(0, bedrooms - tier.bedOffset),
          max: bedrooms + tier.bedOffset,
        };
      }

      // Add sqft constraints if sqft provided
      if (sqft) {
        searchCriteria.sqftRange = {
          min: Math.round(sqft * (1 - tier.sqftPercent)),
          max: Math.round(sqft * (1 + tier.sqftPercent)),
        };
      }

      try {
        const response = await fetch('https://api.batchdata.com/api/v1/property/search', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${batchDataKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requests: [{ searchCriteria }],
          }),
        });

        if (response.status === 403) {
          console.error('[fetchCompsFromBatchData] 403 Forbidden — check BatchData token permissions (property-search, property-lookup-all-attributes)');
          return Response.json({ success: false, message: 'BatchData API authentication failed — token may not have property-search permission' }, { status: 403 });
        }

        if (!response.ok) {
          console.warn(`[fetchCompsFromBatchData] Tier ${tier.radiusLabel} failed with status ${response.status}`);
          continue;
        }

        const data = await response.json();
        const results = data.results?.[0]?.properties || [];
        console.log(`[fetchCompsFromBatchData] Tier ${tier.radiusLabel}: ${results.length} results`);

        if (results.length >= 3) {
          // Success — format and return
          allComps = results.map(p => ({
            address: `${p.address?.street || ''}, ${p.address?.city || ''}, ${p.address?.state || ''}`,
            sale_price: p.lastSalePrice?.amount || null,
            sale_date: p.lastSalePrice?.date || null,
            sqft: p.buildingArea?.sqft || null,
            bedrooms: p.bedrooms || null,
            bathrooms: p.bathrooms || null,
            price_per_sqft: p.lastSalePrice?.amount && p.buildingArea?.sqft
              ? Math.round(p.lastSalePrice.amount / p.buildingArea.sqft)
              : null,
            source: 'batchdata',
            perplexity_confirmed: false,
            perplexity_variance: null,
            condition_vs_subject: 'Similar',
            agent_excluded: false,
            agent_notes: '',
            found_on: [],
          }));
          successTier = tier.radius;
          break;
        }
      } catch (tierErr) {
        console.warn(`[fetchCompsFromBatchData] Tier ${tier.radiusLabel} error:`, tierErr.message);
        continue;
      }
    }

    if (allComps.length === 0) {
      console.log('[fetchCompsFromBatchData] No comps found after all tiers — escalating to Perplexity deep search');
      return Response.json({
        success: true,
        comps: [],
        search_tier: 'exhausted',
        search_radius: 3.0,
        large_property_flag: isLargeProperty,
        researcher_note: 'Standard comparable sales search returned limited results. Will perform extended research to find the best available comparables.',
      });
    }

    console.log(`[fetchCompsFromBatchData] Found ${allComps.length} comps at tier ${successTier}mi`);
    return Response.json({
      success: true,
      comps: allComps,
      search_tier: successTier <= 0.5 ? 1 : successTier <= 1.0 ? 2 : successTier <= 2.0 ? 3 : 4,
      search_radius: successTier,
      large_property_flag: isLargeProperty,
      researcher_note: null,
    });

  } catch (error) {
    console.error('[fetchCompsFromBatchData] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});