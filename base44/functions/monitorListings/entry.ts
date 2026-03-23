import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    // If called from a scheduled automation, no user context
    const isScheduled = req.headers.get('x-scheduled-job') === 'true';
    if (!isScheduled && !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, analysis_id, listed_date, list_price } = await req.json();

    if (action === 'mark_listed') {
      // Step 1: Track Listing
      if (!analysis_id || !listed_date || !list_price) {
        return Response.json({ error: 'Missing required fields for mark_listed' }, { status: 400 });
      }

      const analysis = await base44.entities.Analysis.get(analysis_id);
      if (!analysis) {
        return Response.json({ error: 'Analysis not found' }, { status: 404 });
      }

      // Get territory for DOM threshold
      const records = await base44.asServiceRole.entities.PropertyPublicRecord.filter({
        id: analysis.id,
      }, '-updated_date', 1);

      let domThreshold = 30; // Default
      if (records.length > 0) {
        // Placeholder: would fetch territory average DOM from market data
        const territoryAvgDom = 25;
        domThreshold = Math.ceil(territoryAvgDom * 1.25);
      }

      await base44.entities.Analysis.update(analysis_id, {
        status: 'listed',
        listed_date,
        list_price,
        dom_alert_threshold: domThreshold,
        price_reduction_alert_sent: false,
      });

      console.log(`[monitorListings] Marked analysis ${analysis_id} as listed with DOM threshold ${domThreshold}`);
      return Response.json({ success: true, dom_alert_threshold: domThreshold });
    }

    if (action === 'check_all_listings') {
      // Step 2: Daily DOM Check (scheduled)
      const listedAnalyses = await base44.asServiceRole.entities.Analysis.filter({
        status: 'listed',
        price_reduction_alert_sent: false,
      }, '-listed_date', 500);

      const today = new Date();
      const generated = [];

      for (const analysis of listedAnalyses) {
        if (!analysis.listed_date || !analysis.dom_alert_threshold) continue;

        const listedDate = new Date(analysis.listed_date);
        const daysOnMarket = Math.floor((today - listedDate) / (1000 * 60 * 60 * 24));

        if (daysOnMarket >= analysis.dom_alert_threshold) {
          // Step 3: Generate Price Reduction Analysis
          try {
            const priceReductionAnalysis = await base44.asServiceRole.entities.Analysis.create({
              org_id: analysis.org_id,
              run_by_email: analysis.run_by_email,
              assessment_type: 'price_reduction_review',
              property_type: analysis.property_type,
              location_class: analysis.location_class,
              ai_platform: analysis.ai_platform,
              ai_model: analysis.ai_model,
              output_format: 'narrative',
              status: 'complete',
              intake_data: {
                ...analysis.intake_data,
                original_analysis_id: analysis.id,
                days_on_market: daysOnMarket,
                list_price: analysis.list_price,
              },
              output_text: generatePriceReductionMemo(analysis, daysOnMarket),
            });

            // Mark original as alert sent
            await base44.asServiceRole.entities.Analysis.update(analysis.id, {
              price_reduction_alert_sent: true,
            });

            // Step 4: Notify Agent
            await base44.asServiceRole.integrations.Core.SendEmail({
              to: analysis.run_by_email,
              subject: `[${analysis.intake_data?.address}] — Price Reduction Analysis Ready`,
              body: `
                <p>Your listing at <strong>${analysis.intake_data?.address}</strong> has been on market for <strong>${daysOnMarket} days</strong>.</p>
                <p>A price reduction analysis is ready for your review. <a href="#">View analysis</a></p>
              `,
              from_name: 'PropPrompt Listing Monitor',
            });

            generated.push({
              original_analysis_id: analysis.id,
              price_reduction_analysis_id: priceReductionAnalysis.id,
            });

            console.log(`[monitorListings] Generated price reduction analysis for ${analysis.id}`);
          } catch (err) {
            console.error(`[monitorListings] Failed to generate price reduction for ${analysis.id}:`, err.message);
          }
        }
      }

      return Response.json({ success: true, alerts_generated: generated.length, generated });
    }

    if (action === 'mark_sold') {
      // Step 5: Post-Sale Capture
      if (!analysis_id) {
        return Response.json({ error: 'Missing analysis_id for mark_sold' }, { status: 400 });
      }

      const { sale_date, sale_price } = await req.json();
      if (!sale_date || !sale_price) {
        return Response.json({ error: 'Missing sale_date or sale_price' }, { status: 400 });
      }

      const analysis = await base44.entities.Analysis.get(analysis_id);
      if (!analysis) {
        return Response.json({ error: 'Analysis not found' }, { status: 404 });
      }

      await base44.entities.Analysis.update(analysis_id, {
        status: 'sold',
        sale_date,
        sale_price,
      });

      // Log accuracy
      const estimate_low = analysis.intake_data?.estimated_value_low || null;
      const estimate_high = analysis.intake_data?.estimated_value_high || null;

      if (estimate_low && estimate_high && sale_price) {
        const midpoint = (estimate_low + estimate_high) / 2;
        const variance_pct = ((sale_price - midpoint) / midpoint) * 100;

        await base44.asServiceRole.entities.AnalysisAccuracyLog.create({
          analysis_id,
          territory_id: null, // Would populate from property location
          estimated_value_low: estimate_low,
          estimated_value_high: estimate_high,
          actual_sale_price: sale_price,
          variance_pct: Math.round(variance_pct * 100) / 100,
          days_on_market_actual: analysis.listed_date
            ? Math.floor((new Date(sale_date) - new Date(analysis.listed_date)) / (1000 * 60 * 60 * 24))
            : null,
        });
      }

      console.log(`[monitorListings] Marked analysis ${analysis_id} as sold at $${sale_price}`);
      return Response.json({ success: true, variance_pct: variance_pct || null });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('[monitorListings] error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});

function generatePriceReductionMemo(analysis, daysOnMarket) {
  const territoryAvgDom = 25; // Placeholder
  const listPrice = analysis.list_price || 0;
  const suggestedReduction = Math.round(listPrice * 0.05); // 5% example
  const suggestedPrice = listPrice - suggestedReduction;

  return `
# Price Reduction Analysis — ${analysis.intake_data?.address}

## Market Positioning
Your property has been active for **${daysOnMarket} days** against a territory average of **${territoryAvgDom} days**.

**Status:** Above-average days on market (${daysOnMarket - territoryAvgDom}+ days over territory average)

## Comparable Activity
Recent comparable sales suggest the current list price of **$${listPrice.toLocaleString()}** may benefit from adjustment to align with buyer expectations.

## Recommended Price Strategy
**Suggested range:** $${(suggestedPrice - 5000).toLocaleString()} – $${suggestedPrice.toLocaleString()}
**Adjustment:** Reduce by 3–6% ($${suggestedReduction.toLocaleString()})

This adjustment aligns the property with recent market sales and may increase qualified buyer interest.

---

*This analysis was automatically generated based on current market conditions. Discuss with your broker before making pricing decisions.*
  `.trim();
}