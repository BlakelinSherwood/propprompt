import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Admin-only function to aggregate data quality metrics daily
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { territory_id } = await req.json();
    
    if (!territory_id) {
      return Response.json({ error: 'territory_id required' }, { status: 400 });
    }

    // Get all analysis attempts for this territory from yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStart = yesterday.toISOString().split('T')[0];
    
    // For demo purposes, we'll track directly from PropertyPublicRecord searches
    const records = await base44.entities.PropertyPublicRecord.filter({
      territory_id: territory_id,
      searched_at: { $gte: yesterdayStart }
    });

    if (records.length === 0) {
      return Response.json({ 
        message: 'No searches yesterday for this territory',
        territory_id: territory_id,
        date: yesterdayStart
      });
    }

    const stats = {
      searches_attempted: records.length,
      searches_found: records.filter(r => r.search_status === 'found' || r.search_status === 'partial').length,
      searches_not_found: records.filter(r => r.search_status === 'not_found').length,
      searches_errored: records.filter(r => r.search_status === 'error').length,
      average_confidence_score: 0,
      green_state_count: 0,
      yellow_state_count: 0,
      red_state_count: 0,
      common_blocking_reasons: []
    };

    // Calculate average confidence (placeholder — in real system would come from analysis_run)
    let totalConfidence = 0;
    for (const record of records) {
      // Rough scoring based on record completeness
      let score = 0;
      if (record.owner_of_record) score += 30;
      if (record.original_mortgage_amount) score += 30;
      if (record.assessed_value) score += 25;
      if (!record.liens_found) score += 10;
      if (record.search_status === 'found') score += 5;
      totalConfidence += score;
    }
    stats.average_confidence_score = Math.round(totalConfidence / records.length);

    // Calculate red_rate
    const red_rate = Math.round((stats.searches_errored / stats.searches_attempted) * 100);

    // Create or update territory data quality record
    const existing = await base44.entities.TerritoryDataQuality.filter({
      territory_id: territory_id,
      search_date: yesterdayStart
    });

    const qualityData = {
      territory_id: territory_id,
      search_date: yesterdayStart,
      ...stats,
      red_rate: red_rate
    };

    if (existing.length > 0) {
      await base44.entities.TerritoryDataQuality.update(existing[0].id, qualityData);
    } else {
      await base44.entities.TerritoryDataQuality.create(qualityData);
    }

    // Check alert thresholds
    const alerts = [];
    if (red_rate >= 40 && red_rate < 60) {
      alerts.push({
        level: 'warning',
        message: `Territory ${territory_id}: Red state rate ${red_rate}% (40-60% range)`
      });
    } else if (red_rate >= 60) {
      alerts.push({
        level: 'critical',
        message: `Territory ${territory_id}: Red state rate ${red_rate}% (>60% — auto-pausing)`
      });
      // Auto-pause if not already paused
      const territory = await base44.entities.Territory.get(territory_id);
      if (territory.status !== 'paused') {
        await base44.entities.Territory.update(territory_id, { status: 'data_quality_paused' });
      }
    }

    return Response.json({
      territory_id: territory_id,
      date: yesterdayStart,
      stats: qualityData,
      alerts: alerts
    });
  } catch (error) {
    console.error('[aggregateTerritoryDataQuality] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});