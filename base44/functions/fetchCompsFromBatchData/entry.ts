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
    const city = parts[1] || '';
    const stateZip = (parts[2] || '').trim().split(/\s+/);
    const state = stateZip[0] || '';
    const zip = stateZip[1] || '';

    // Get BatchData API key from PlatformConfig
    const configs = await base44.asServiceRole.entities.PlatformConfig.list();
    const config = configs[0];
    if (!config?.batchdata_api_key) {
      return Response.json({ success: false, message: 'BatchData API key not configured' }, { status: 402 });
    }
    const batchDataKey = config.batchdata_api_key;

    // Large property flag (sqft >= 4000)
    const isLargeProperty = sqft && sqft >= 4000;

    // Tiered waterfall radii — progressively wider search
    const radiiTiers = [
      { radii: [0.5, 1.0, 2.0],             soldWithinMonths: 12, tierNum: 1 },
      { radii: [0.5, 1.0, 2.0, 3.0],        soldWithinMonths: 18, tierNum: 2 },
      { radii: [1.0, 2.0, 3.0, 5.0],        soldWithinMonths: 24, tierNum: 3 },
      { radii: [1.0, 2.0, 3.0, 5.0, 7.0],   soldWithinMonths: 36, tierNum: 4 },
      { radii: [3.0, 5.0, 7.0, 10.0],       soldWithinMonths: 48, tierNum: 5 }, // ultra-wide fallback
    ];

    const compAddress = { street, city, state, zip };

    // Helper: Filter raw BatchData results by sold date only — allow all residential types
    function filterResults(properties, soldWithinMonths) {
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - soldWithinMonths);

      return properties.filter(p => {
        // Accept any residential type — exclude only commercial/land
        const listingType = (p.listing?.propertyType || '').toLowerCase();
        const isCommercialOrLand = ['commercial', 'industrial', 'land', 'farm', 'vacant'].some(t => listingType.includes(t));
        if (isCommercialOrLand) return false;

        // Check sold date from listing or deed history
        const soldDate = p.listing?.soldDate
          ? new Date(p.listing.soldDate)
          : p.deedHistory && p.deedHistory.length > 0
            ? new Date(p.deedHistory[p.deedHistory.length - 1].recordingDate)
            : null;

        if (!soldDate || soldDate < cutoffDate) return false;

        // Check has sold price
        const hasSoldPrice = !!p.listing?.soldPrice ||
                            (p.deedHistory && p.deedHistory.length > 0 && !!p.deedHistory[p.deedHistory.length - 1].salePrice);
        return hasSoldPrice;
      });
    }

    // Helper: Normalize property to comp schema
    function normalizeProp(p, tierNum, distanceMiles) {
      const lastDeed = p.deedHistory && p.deedHistory.length > 0 ? p.deedHistory[p.deedHistory.length - 1] : {};
      const listing = p.listing || {};

      const soldPrice = listing.soldPrice || lastDeed.salePrice || null;
      const sqftValue = listing.totalBuildingAreaSquareFeet || listing.livingArea || null;

      const address = [
        p.address?.houseNumber,
        p.address?.street,
        p.address?.city,
        p.address?.state,
        p.address?.zip
      ].filter(Boolean).join(' ');

      return {
        address,
        sale_price: soldPrice,
        sale_date: listing.soldDate || lastDeed.recordingDate || null,
        sqft: sqftValue,
        bedrooms: listing.bedroomCount || null,
        bathrooms: listing.bathroomCount || null,
        price_per_sqft: (soldPrice && sqftValue)
          ? Math.round(soldPrice / sqftValue)
          : null,
        lot_sqft: listing.lotSizeSquareFeet || null,
        year_built: listing.yearBuilt || null,
        days_on_market: listing.daysOnMarket || null,
        listing_url: listing.listingUrl || null,
        batchdata_id: p._id,
        source: 'batchdata',
        search_tier: tierNum,
        search_radius: distanceMiles,
        perplexity_confirmed: false,
        perplexity_variance: null,
        agent_excluded: false,
        agent_notes: ''
      };
    }

    let allComps = [];
    let successTierNum = null;
    let successRadiusMiles = null;

    // Run tiered waterfall
    for (const tierConfig of radiiTiers) {
      const logMsg = `Tier ${tierConfig.tierNum}: trying radii ${tierConfig.radii.join(', ')} mi, sold within ${tierConfig.soldWithinMonths} months`;
      console.log(`[fetchCompsFromBatchData] ${logMsg}`);
      try {
        await base44.functions.invoke('logActivity', {
          log_level: 'info',
          function_name: 'fetchCompsFromBatchData',
          message: logMsg,
          context: { address, tier: tierConfig.tierNum, radii: tierConfig.radii },
          analysis_id: null,
        });
      } catch (logErr) {
        console.warn('[fetchCompsFromBatchData] logging failed:', logErr.message);
      }

      for (const distanceMiles of tierConfig.radii) {
        try {
          // CORRECT FLAT REQUEST BODY STRUCTURE with property filters
          // Relax filters progressively by tier — tier 3+ drops bedroom/bath constraints
          const relaxed = tierConfig.tierNum >= 3;
          const requestBody = {
            searchCriteria: {
              compAddress,
              bedroomsMin: (!relaxed && bedrooms) ? Math.max(1, bedrooms - 2) : null,
              bedroomsMax: (!relaxed && bedrooms) ? bedrooms + 2 : null,
              bathroomsMin: null, // always open — too restrictive
              bathroomsMax: null,
              sqftMin: sqft ? Math.round(sqft * (relaxed ? 0.60 : 0.70)) : null,
              sqftMax: sqft ? Math.round(sqft * (relaxed ? 1.40 : 1.30)) : null,
            },
            options: {
              useDistance: true,
              distanceMiles: distanceMiles,
              take: 50, // increased from 25 to catch more before filtering
            }
          };

          const response = await fetch('https://api.batchdata.com/api/v1/property/search', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${batchDataKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          });

          if (response.status === 403) {
            const errMsg = '403 Forbidden — check BatchData token permissions (property-search, property-lookup-all-attributes)';
            console.error('[fetchCompsFromBatchData] ' + errMsg);
            try {
              await base44.functions.invoke('logActivity', {
                log_level: 'error',
                function_name: 'fetchCompsFromBatchData',
                message: errMsg,
                error_details: 'BatchData API returned 403 Forbidden',
              });
            } catch (logErr) {}
            return Response.json({ success: false, message: 'BatchData API authentication failed — token may not have property-search permission' }, { status: 403 });
          }

          if (!response.ok) {
            console.warn(`[fetchCompsFromBatchData] Tier ${tierConfig.tierNum} radius ${distanceMiles}mi failed with status ${response.status}`);
            continue;
          }

          const data = await response.json();
          const rawProperties = data.properties || [];
          console.log(`[fetchCompsFromBatchData] Tier ${tierConfig.tierNum} radius ${distanceMiles}mi: ${rawProperties.length} raw results`);

          // Filter by property type and sold date
          const filtered = filterResults(rawProperties, tierConfig.soldWithinMonths);
          console.log(`[fetchCompsFromBatchData] After filtering: ${filtered.length} recently-sold SFR comps`);

          // Relax comp threshold for higher tiers
          const compThreshold = tierConfig.tierNum >= 4 ? 1 : tierConfig.tierNum >= 3 ? 2 : 3;
          if (filtered.length >= compThreshold) {
            // Success — normalize and return
            allComps = filtered.map(p => normalizeProp(p, tierConfig.tierNum, distanceMiles));
            successTierNum = tierConfig.tierNum;
            successRadiusMiles = distanceMiles;
            break;
          }
        } catch (radiusErr) {
          console.warn(`[fetchCompsFromBatchData] Tier ${tierConfig.tierNum} radius ${distanceMiles}mi error:`, radiusErr.message);
          continue;
        }
      }

      if (allComps.length >= 1) break; // Exit tier loop once we have any comps
    }

    if (allComps.length === 0) {
      const noCompsMsg = 'No comps found after exhaustive tier search — escalating to Perplexity deep search';
      console.log('[fetchCompsFromBatchData] ' + noCompsMsg);
      try {
        await base44.functions.invoke('logActivity', {
          log_level: 'warn',
          function_name: 'fetchCompsFromBatchData',
          message: noCompsMsg,
          context: { address, propertyType, bedrooms, bathrooms, sqft, isLargeProperty },
        });
      } catch (logErr) {}
      return Response.json({
        success: true,
        comps: [],
        search_tier: 'exhausted',
        search_radius: 3.0,
        large_property_flag: isLargeProperty,
        researcher_note: 'Standard comparable sales search returned limited results. Will perform extended research to find the best available comparables.',
      });
    }

    console.log(`[fetchCompsFromBatchData] Found ${allComps.length} comps at tier ${successTierNum} radius ${successRadiusMiles}mi`);
    return Response.json({
      success: true,
      comps: allComps,
      search_tier: successTierNum,
      search_radius: successRadiusMiles,
      large_property_flag: isLargeProperty,
      researcher_note: null,
    });

  } catch (error) {
    console.error('[fetchCompsFromBatchData] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});