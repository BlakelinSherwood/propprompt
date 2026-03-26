import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { reportJSON, analysisRecord } = body;

    const prior_sale_price = analysisRecord?.prior_sale_price ?? body.prior_sale_price ?? null;
    const prior_sale_year  = analysisRecord?.prior_sale_year  ?? body.prior_sale_year  ?? null;

    if (prior_sale_price == null || prior_sale_year == null) {
      return Response.json({ valid: true, reason: 'no_prior_sale_data' });
    }

    const currentYear = new Date().getFullYear();
    const yearsElapsed = currentYear - Number(prior_sale_year);

    let appreciationRate = 0.04;
    const rawRate = reportJSON?.market_context?.yoy_appreciation_rate
      ?? reportJSON?.market_context?.yoy_appreciation;
    if (rawRate != null && !isNaN(Number(rawRate))) {
      appreciationRate = Number(rawRate);
      if (appreciationRate > 1) appreciationRate = appreciationRate / 100;
    }

    const projectedValue = Number(prior_sale_price) * Math.pow(1 + appreciationRate, yearsElapsed);

    let aiMidpoint = reportJSON?.tiered_comps?.implied_value_range?.midpoint
      ?? reportJSON?.implied_value_range?.midpoint
      ?? null;

    if (aiMidpoint == null) {
      return Response.json({ valid: true, reason: 'no_ai_midpoint' });
    }
    if (typeof aiMidpoint === 'string') {
      aiMidpoint = Number(aiMidpoint.replace(/[^0-9.]/g, ''));
    }
    aiMidpoint = Number(aiMidpoint);
    if (isNaN(aiMidpoint) || aiMidpoint === 0) {
      return Response.json({ valid: true, reason: 'no_ai_midpoint' });
    }

    const varianceDecimal = (projectedValue - aiMidpoint) / projectedValue;

    if (varianceDecimal > 0.20) {
      return Response.json({
        valid: false,
        reason: 'valuation_anomaly',
        variance_percent: Math.round(varianceDecimal * 100),
        prior_sale_price: Number(prior_sale_price),
        prior_sale_year: Number(prior_sale_year),
        projected_current_value: Math.round(projectedValue),
        ai_midpoint: aiMidpoint,
      });
    }

    return Response.json({ valid: true });

  } catch (error) {
    console.error('[validateValuation] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});