import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * calculateNetProceeds — Server-side deterministic net proceeds calculation.
 * Runs AFTER AI generation and AFTER validateValuation passes.
 * 
 * Computes three scenarios (Below Ask / At Ask / Above Ask) using:
 * - Recommended list price from the AI report JSON
 * - Seller financial data from the Analysis record
 * 
 * Saves computed scenarios to net_proceeds_json on the Analysis record.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { analysisId } = await req.json();
    if (!analysisId) return Response.json({ error: 'analysisId required' }, { status: 400 });

    // Load the analysis record
    const records = await base44.asServiceRole.entities.Analysis.filter({ id: analysisId });
    const analysis = records[0];
    if (!analysis) return Response.json({ error: 'Analysis not found' }, { status: 404 });

    // If seller financial step was skipped (all null), don't calculate
    if (
      analysis.seller_mortgage_payoff === null &&
      analysis.seller_commission_rate === null &&
      analysis.seller_closing_cost_rate === null &&
      analysis.seller_other_costs === null
    ) {
      console.log('[calculateNetProceeds] Seller financial step was skipped, not calculating');
      return Response.json({ skipped: true });
    }

    // Extract recommended list price from AI report JSON
    let recommendedListPrice = null;
    if (analysis.output_json) {
      // Look for strategic pricing scenario
      const pricingScenarios = analysis.output_json.pricing_scenarios || [];
      const strategicScenario = pricingScenarios.find(s => s.scenario_type === 'strategic' || s.label?.toLowerCase().includes('strategic'));
      if (strategicScenario?.price) {
        recommendedListPrice = strategicScenario.price;
      }

      // Fallback: use implied value range midpoint
      if (!recommendedListPrice && analysis.output_json.tiered_comps?.implied_value_range?.midpoint) {
        recommendedListPrice = analysis.output_json.tiered_comps.implied_value_range.midpoint;
      }
    }

    // Use provided fields with defaults
    const sellerCommissionRate = analysis.seller_commission_rate ?? 5.0;
    const sellerClosingCostRate = analysis.seller_closing_cost_rate ?? 1.5;
    const sellerOtherCosts = analysis.seller_other_costs ?? 0;
    const sellerMortgagePayoff = analysis.seller_mortgage_payoff ?? 0;
    const isMortgageEstimated = !analysis.seller_mortgage_known; // If not verified, it's estimated

    // Build scenarios
    const scenarios = [];
    if (recommendedListPrice) {
      const multipliers = [
        { label: 'Below Ask', multiplier: 0.97 },
        { label: 'At Ask', multiplier: 1.00 },
        { label: 'Above Ask', multiplier: 1.03 },
      ];

      for (const { label, multiplier } of multipliers) {
        const salePrice = recommendedListPrice * multiplier;
        const commission = salePrice * (sellerCommissionRate / 100);
        const closingCosts = salePrice * (sellerClosingCostRate / 100);
        const netProceeds = salePrice - commission - closingCosts - sellerOtherCosts - sellerMortgagePayoff;

        scenarios.push({
          label,
          sale_price: `$${salePrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
          commission: `$${commission.toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
          closing_costs: `$${closingCosts.toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
          mortgage_payoff: `$${sellerMortgagePayoff.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
          other_deductions: `$${sellerOtherCosts.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
          net_proceeds: `$${netProceeds.toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
          estimated: isMortgageEstimated,
        });
      }
    }

    // Build notes
    const notes = isMortgageEstimated
      ? 'Mortgage payoff is an estimate — confirm with lender before sharing with seller.'
      : 'Mortgage payoff verified with seller.';

    const netProceedsJson = {
      scenarios,
      notes,
    };

    // Save to Analysis record
    await base44.asServiceRole.entities.Analysis.update(analysisId, {
      net_proceeds_json: netProceedsJson,
    });

    console.log('[calculateNetProceeds] Calculated and saved net proceeds:', {
      analysisId,
      scenarioCount: scenarios.length,
      isMortgageEstimated,
    });

    return Response.json({ success: true, scenarios: scenarios.length, estimated: isMortgageEstimated });
  } catch (error) {
    console.error('[calculateNetProceeds] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});