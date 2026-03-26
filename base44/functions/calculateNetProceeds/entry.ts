/**
 * calculateNetProceeds — server-side deterministic net proceeds calculator.
 * Called AFTER generateAnalysis completes. No AI involved in any calculation.
 *
 * POST body: { analysisId }
 * Returns: { scenarios, notes }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

function fmtDollars(n) {
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function calcScenario(label, listPrice, multiplier, commissionRate, closingRate, otherCosts, mortgagePayoff, mortgageKnown) {
  const gross = Math.round(listPrice * multiplier * 100) / 100;
  const commission = Math.round(gross * (commissionRate / 100) * 100) / 100;
  const closing = Math.round(gross * (closingRate / 100) * 100) / 100;
  const mortgage = mortgagePayoff ?? 0;
  const other = otherCosts ?? 0;
  const net = Math.round((gross - commission - closing - mortgage - other) * 100) / 100;
  return {
    label,
    sale_price: fmtDollars(gross),
    sale_price_raw: gross,
    commission: fmtDollars(commission),
    closing_costs: fmtDollars(closing),
    mortgage_payoff: fmtDollars(mortgage),
    other_deductions: fmtDollars(other),
    net_proceeds: fmtDollars(net),
    net_proceeds_raw: net,
    estimated: !mortgageKnown && mortgage > 0,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { analysisId } = await req.json();
    if (!analysisId) return Response.json({ error: 'analysisId required' }, { status: 400 });

    const records = await base44.asServiceRole.entities.Analysis.filter({ id: analysisId });
    const analysis = records[0];
    if (!analysis) return Response.json({ error: 'Analysis not found' }, { status: 404 });

    // Only run for listing_pricing
    if (analysis.assessment_type !== 'listing_pricing') {
      return Response.json({ skipped: true, reason: 'Not a listing pricing analysis' });
    }

    // If seller financial data was skipped (all null), save null and return
    if (
      analysis.seller_commission_rate == null &&
      analysis.seller_closing_cost_rate == null
    ) {
      await base44.asServiceRole.entities.Analysis.update(analysisId, { net_proceeds_json: null });
      return Response.json({ net_proceeds_json: null, skipped: true, reason: 'Seller financial data not provided' });
    }

    // Resolve recommended list price from AI output JSON — never computed by AI
    const outputJson = analysis.output_json || {};
    let recommendedListPrice = null;

    // Try pricing_scenarios for strategic scenario
    const scenarios = outputJson.pricing_scenarios || [];
    const strategic = scenarios.find(s =>
      (s.scenario_type === 'strategic') ||
      (s.label && /strategic|ask/i.test(s.label))
    );
    if (strategic?.price) {
      recommendedListPrice = Number(strategic.price);
    }

    // Fallback: valuation.strategic_list_price
    if (!recommendedListPrice && outputJson.valuation?.strategic_list_price) {
      recommendedListPrice = Number(outputJson.valuation.strategic_list_price);
    }

    // Fallback: implied_value_range.midpoint
    if (!recommendedListPrice) {
      const ivr = outputJson.tiered_comps?.implied_value_range || outputJson.implied_value_range;
      if (ivr?.midpoint) recommendedListPrice = Number(ivr.midpoint);
    }

    if (!recommendedListPrice || isNaN(recommendedListPrice)) {
      console.warn('[calculateNetProceeds] Could not resolve recommendedListPrice from output_json');
      await base44.asServiceRole.entities.Analysis.update(analysisId, { net_proceeds_json: null });
      return Response.json({ net_proceeds_json: null, skipped: true, reason: 'Could not resolve list price from AI output' });
    }

    const commissionRate = analysis.seller_commission_rate ?? 5.0;
    const closingRate = analysis.seller_closing_cost_rate ?? 1.5;
    const otherCosts = analysis.seller_other_costs ?? 0;
    const mortgagePayoff = analysis.seller_mortgage_payoff ?? null;
    const mortgageKnown = analysis.seller_mortgage_known ?? false;

    const belowAsk = calcScenario('Below Ask', recommendedListPrice, 0.97, commissionRate, closingRate, otherCosts, mortgagePayoff, mortgageKnown);
    const atAsk = calcScenario('At Ask', recommendedListPrice, 1.00, commissionRate, closingRate, otherCosts, mortgagePayoff, mortgageKnown);
    const aboveAsk = calcScenario('Above Ask', recommendedListPrice, 1.03, commissionRate, closingRate, otherCosts, mortgagePayoff, mortgageKnown);

    const hasEstimate = belowAsk.estimated || atAsk.estimated || aboveAsk.estimated;
    const notes = hasEstimate
      ? 'Mortgage payoff is an estimate — confirm with lender before sharing with seller.'
      : (mortgagePayoff === 0 ? 'Property is owned free and clear.' : 'Mortgage payoff verified with seller or lender.');

    const result = {
      recommended_list_price: fmtDollars(recommendedListPrice),
      commission_rate: commissionRate,
      closing_cost_rate: closingRate,
      scenarios: [belowAsk, atAsk, aboveAsk],
      notes,
    };

    await base44.asServiceRole.entities.Analysis.update(analysisId, { net_proceeds_json: result });
    console.log(`[calculateNetProceeds] Saved net_proceeds_json for analysis ${analysisId}`);
    return Response.json({ net_proceeds_json: result });

  } catch (err) {
    console.error('[calculateNetProceeds] error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});