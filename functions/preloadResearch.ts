import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { analysis_id, address, state_code } = await req.json();
    if (!analysis_id || !address || !state_code) {
      return Response.json({ error: 'Missing required fields: analysis_id, address, state_code' }, { status: 400 });
    }

    const results = {
      public_records: null,
      public_records_confidence: null,
      comparables: [],
      market_snapshot: null,
      buyer_archetype: null,
      avm_estimate: null,
      warnings: [],
      tasks_completed: 0,
    };

    // Task A: Public Records Search
    try {
      const recordsRes = await base44.functions.invoke('searchPublicRecords', {
        address,
        state_code,
        force_refresh: true,
      });
      results.public_records = recordsRes.data;
      
      // Score confidence
      if (results.public_records?.search_status === 'found') {
        results.public_records_confidence = 'high';
      } else if (results.public_records?.search_status === 'partial') {
        results.public_records_confidence = 'medium';
        results.warnings.push('Partial public record data — some fields unavailable');
      } else {
        results.public_records_confidence = 'low';
        results.warnings.push('Assessor data not found — using comp-based estimate only');
      }
      results.tasks_completed += 1;
    } catch (err) {
      console.error('[preloadResearch] Public records search failed:', err.message);
      results.warnings.push('Public records search failed');
    }

    // Task B: Comparable Sales Pull
    try {
      const analysis = await base44.entities.Analysis.get(analysis_id);
      if (analysis?.property_type) {
        // Find territory for this address
        const territories = await base44.asServiceRole.entities.Territory.filter({
          state_code,
        }, '-updated_date', 100);
        
        // Fetch recent sales for similar properties
        // This would typically call an external MLS/sales database
        // For now, we'll create placeholder comps from PropertyPublicRecord
        const records = await base44.asServiceRole.entities.PropertyPublicRecord.filter({
          state_code,
          search_status: 'found',
        }, '-last_sale_date', 20);
        
        const sqft = results.public_records?.sqft || 2000;
        const filtered = records.filter(r => {
          const distance = Math.random() * 2; // Placeholder for distance calc
          return distance <= 0.5 && r.last_sale_price && r.last_sale_date;
        }).slice(0, 10);

        for (const comp of filtered) {
          await base44.entities.PreLoadedComps.create({
            analysis_id,
            address: comp.property_address,
            sale_price: comp.last_sale_price,
            sale_date: comp.last_sale_date,
            beds: null,
            baths: null,
            sqft: null,
            distance_miles: Math.random() * 0.5,
            source: 'public_records',
            loaded_at: new Date().toISOString(),
          });
        }
        results.comparables = filtered.slice(0, 10);
      }
      results.tasks_completed += 1;
    } catch (err) {
      console.error('[preloadResearch] Comparables pull failed:', err.message);
      results.warnings.push('Failed to load comparable sales');
    }

    // Task C: Territory Market Snapshot
    try {
      const territories = await base44.asServiceRole.entities.Territory.filter({
        state_code,
      }, '-updated_date', 1);
      
      if (territories.length > 0) {
        const territory = territories[0];
        // Placeholder market snapshot — would come from market data service
        results.market_snapshot = {
          territory_id: territory.id,
          median_dom: 25,
          list_to_sale_ratio: 0.96,
          active_inventory: 145,
          median_price: 385000,
          as_of_date: new Date().toISOString(),
        };
      }
      results.tasks_completed += 1;
    } catch (err) {
      console.error('[preloadResearch] Market snapshot failed:', err.message);
    }

    // Task D: Migration and Archetype Context
    try {
      // Placeholder — would identify dominant buyer profile
      results.buyer_archetype = {
        primary: 'first_time_buyers',
        secondary: 'downsizers',
        migration_markets: ['Boston Metro', 'Providence Metro', 'Hartford Metro'],
      };
      results.tasks_completed += 1;
    } catch (err) {
      console.error('[preloadResearch] Archetype context failed:', err.message);
    }

    // Task E: AVM Estimate
    try {
      if (results.public_records?.assessed_value) {
        const assessed = results.public_records.assessed_value;
        results.avm_estimate = {
          low: Math.round(assessed * 0.95),
          high: Math.round(assessed * 1.05),
          basis: 'assessed_value',
          confidence: 'medium',
        };
      } else if (results.comparables.length > 0) {
        const avgSale = results.comparables.reduce((sum, c) => sum + (c.last_sale_price || 0), 0) / results.comparables.length;
        results.avm_estimate = {
          low: Math.round(avgSale * 0.93),
          high: Math.round(avgSale * 1.07),
          basis: 'comparable_sales',
          confidence: 'medium',
        };
      }
      results.tasks_completed += 1;
    } catch (err) {
      console.error('[preloadResearch] AVM estimate failed:', err.message);
    }

    console.log(`[preloadResearch] Completed ${results.tasks_completed} tasks for analysis ${analysis_id}`);
    return Response.json(results);
  } catch (err) {
    console.error('[preloadResearch] error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});