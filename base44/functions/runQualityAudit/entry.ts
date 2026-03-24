import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * runQualityAudit — Evaluates analysis quality using Haiku (cheap evaluator).
 * Runs after analysis completion and creates a QualityAuditLog record.
 * Can also be called manually from admin dashboard.
 */

const QUALITY_AUDIT_PROMPT = `You are a quality auditor for a real estate analysis platform.
You have been given the JSON output of a completed analysis.
Your job is to evaluate the quality of each section and identify problems.

ANALYSIS TYPE: {assessment_type}
PROPERTY TYPE: {property_type}
LOCATION CLASSIFICATION: {location_classification}
MODEL USED: {model_used}

OUTPUT JSON:
{output_json}

━━━━━━━━━━━━━━━━━━━━━━━━
SCORING INSTRUCTIONS
━━━━━━━━━━━━━━━━━━━━━━━━

Score each section that exists in the output on a 1-10 scale.
If a section does not exist (null or missing key), score it null.

SCORING RUBRIC:

9-10: Exceptional — All required fields populated with specific, property-specific data. Numbers are internally consistent.
7-8: Good — All required fields, reasonable content, mostly property-specific. Minor issues acceptable.
5-6: Adequate — Most fields populated but some gaps. Partially generic. Agent would need to supplement.
3-4: Below Standard — Multiple fields missing or placeholder-quality. Largely generic boilerplate.
1-2: Failed — Mostly empty, contradictory, or nonsensical.

SECTION-SPECIFIC CHECKS:

MARKET CONTEXT:
- Specific median PPSF, YoY appreciation, DOM, months of inventory?
- Numbers plausible for this property type and location?
- Market characterization (seller's/balanced/buyer's) supported by data?

COMPS:
- At least 12 comps across 3 tiers?
- Tier A genuinely comparable (similar size, style, location)?
- Time adjustments applied to older sales?
- Implied value range calculated and internally consistent?
- Thin comp flag makes sense given comp count?

VALUATION:
- All three methods present (comp, assessed ratio, appreciation multiplier)?
- Do methods converge (within ~10% of each other)?
- If diverge, is there explanation?

MIGRATION:
- 5-8 feeder markets with plausible origins?
- Push/pull factors specific (not generic)?
- Migration scores reasonable (not all 8-10)?
- Employer targets relevant to commute radius?
- CRITICAL: Any references to race, ethnicity, religion, national origin, or protected classes? Flag as CRITICAL violation.

ARCHETYPES:
- 6-10 distinct archetypes?
- Estimated_pool_pct values sum to ~100%?
- Deep profiles specific to property (not generic)?
- Language calibration genuinely useful?
- Property-type-specific archetypes (investors for multi-family, downsizers for condos)?
- CRITICAL: Any archetype names/descriptions referencing protected classes? Flag as CRITICAL violation.

LANGUAGE CALIBRATION:
- AVOID phrases genuinely repel target buyer?
- USE phrases compelling for target buyer?
- Would agent find actionable in listing description?
- Distinct across archetypes (not copy-paste)?

PORTFOLIO OPTIONS:
- All 7 options (A-G) populated?
- Financial calculations internally consistent?
- Rate figures current and sourced?
- ADU trigger decision correct for property type and lot size?
- CRITICAL: Any text using selling language ("you should sell", "now is the time to list", "we recommend selling")? Flag as CRITICAL violation.

━━━━━━━━━━━━━━━━━━━━━━━━
ISSUE IDENTIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━

For every problem found, create an issue object:
{
  "section": "[section name]",
  "severity": "critical" | "major" | "minor",
  "description": "[specific problem]",
  "recommendation": "[how to fix]"
}

SEVERITY DEFINITIONS:
- critical: Data is wrong, missing, or poses legal/compliance risk.
- major: Significant quality gap that impacts usability.
- minor: Polish issue, doesn't impair usability.

━━━━━━━━━━━━━━━━━━━━━━━━
YOUR RESPONSE FORMAT
━━━━━━━━━━━━━━━━━━━━━━━━

You MUST respond with ONLY valid JSON (no markdown, no preamble):

{
  "scores": {
    "market_context": null | 1-10,
    "comps": null | 1-10,
    "valuation": null | 1-10,
    "avm_analysis": null | 1-10,
    "migration": null | 1-10,
    "archetypes": null | 1-10,
    "language_calibration": null | 1-10,
    "portfolio_options": null | 1-10,
    "adu_analysis": null | 1-10,
    "rate_environment": null | 1-10,
    "overall": 1-10
  },
  "issues": [
    { "section": "...", "severity": "critical|major|minor", "description": "...", "recommendation": "..." }
  ],
  "compliance": {
    "passed": true | false,
    "violations": [
      { "section": "...", "violation": "...", "reference": "..." }
    ]
  },
  "model_recommendation": {
    "strategy": "current_optimal" | "upgrade_full" | "upgrade_sections" | "downgrade_full" | "downgrade_sections" | "split_routing",
    "recommended_model": "provider::model-name" or null,
    "upgrade_sections": ["section1", "section2"] or null,
    "downgrade_sections": ["section1", "section2"] or null,
    "estimated_token_savings_pct": null | number,
    "estimated_quality_impact": "improved" | "maintained" | "minor_degradation",
    "rationale": "2-3 sentence explanation"
  }
}`;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { analysisId } = await req.json();
    if (!analysisId) return Response.json({ error: 'analysisId required' }, { status: 400 });

    // Load analysis
    const analyses = await base44.asServiceRole.entities.Analysis.filter({ id: analysisId });
    const analysis = analyses[0];
    if (!analysis) return Response.json({ error: 'Analysis not found' }, { status: 404 });

    if (!analysis.output_json) {
      return Response.json({ error: 'Analysis has no output_json yet' }, { status: 400 });
    }

    // Build prompt with analysis data
    const prompt = QUALITY_AUDIT_PROMPT
      .replace('{assessment_type}', analysis.assessment_type || 'unknown')
      .replace('{property_type}', analysis.property_type || 'unknown')
      .replace('{location_classification}', analysis.location_class || 'unknown')
      .replace('{model_used}', analysis.ai_model || analysis.ai_platform || 'unknown')
      .replace('{output_json}', JSON.stringify(analysis.output_json, null, 2));

    // Call Claude Haiku (cheapest evaluator)
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      console.warn('[runQualityAudit] ANTHROPIC_API_KEY not set, skipping audit');
      return Response.json({ error: 'API key not configured' }, { status: 500 });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages/batch', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[runQualityAudit] Claude error:', err);
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    const evalText = data.content?.[0]?.text || '';

    // Parse JSON response
    let evaluation;
    try {
      evaluation = JSON.parse(evalText);
    } catch (parseErr) {
      console.error('[runQualityAudit] Failed to parse Claude response:', evalText);
      throw new Error('Failed to parse evaluation response');
    }

    // Build audit log record
    const auditRecord = {
      analysis_id: analysisId,
      assessment_type: analysis.assessment_type,
      property_type: analysis.property_type,
      model_used: analysis.ai_model || analysis.ai_platform,
      total_token_count: analysis.tokens_used || 0,
      audit_date: new Date().toISOString(),
      score_market_context: evaluation.scores?.market_context || null,
      score_comps: evaluation.scores?.comps || null,
      score_valuation: evaluation.scores?.valuation || null,
      score_avm_analysis: evaluation.scores?.avm_analysis || null,
      score_migration: evaluation.scores?.migration || null,
      score_archetypes: evaluation.scores?.archetypes || null,
      score_language_calibration: evaluation.scores?.language_calibration || null,
      score_portfolio_options: evaluation.scores?.portfolio_options || null,
      score_adu_analysis: evaluation.scores?.adu_analysis || null,
      score_rate_environment: evaluation.scores?.rate_environment || null,
      score_overall: evaluation.scores?.overall || 0,
      issues: evaluation.issues || [],
      critical_count: (evaluation.issues || []).filter(i => i.severity === 'critical').length,
      major_count: (evaluation.issues || []).filter(i => i.severity === 'major').length,
      minor_count: (evaluation.issues || []).filter(i => i.severity === 'minor').length,
      recommended_model_strategy: evaluation.model_recommendation?.strategy || 'current_optimal',
      recommended_model: evaluation.model_recommendation?.recommended_model || null,
      upgrade_sections: evaluation.model_recommendation?.upgrade_sections || null,
      downgrade_sections: evaluation.model_recommendation?.downgrade_sections || null,
      estimated_token_savings_pct: evaluation.model_recommendation?.estimated_token_savings_pct || null,
      estimated_quality_impact: evaluation.model_recommendation?.estimated_quality_impact || 'maintained',
      recommendation_rationale: evaluation.model_recommendation?.rationale || '',
      fair_housing_violations: evaluation.compliance?.violations || [],
      compliance_passed: evaluation.compliance?.passed !== false,
    };

    // Create audit log record
    const auditLog = await base44.asServiceRole.entities.QualityAuditLog.create(auditRecord);

    // Flag analysis if compliance failed
    if (!auditRecord.compliance_passed) {
      await base44.asServiceRole.entities.Analysis.update(analysisId, {
        compliance_flagged: true,
        compliance_flag_reason: 'Fair housing violation detected in audit',
      });
    }

    console.log(`[runQualityAudit] audit complete for analysis ${analysisId}:`, {
      overall_score: auditRecord.score_overall,
      issues: auditRecord.critical_count + auditRecord.major_count + auditRecord.minor_count,
      compliance_passed: auditRecord.compliance_passed,
    });

    return Response.json({
      audit_id: auditLog.id,
      overall_score: auditRecord.score_overall,
      issues_found: auditRecord.critical_count + auditRecord.major_count + auditRecord.minor_count,
      compliance_passed: auditRecord.compliance_passed,
      model_recommendation: auditRecord.recommended_model_strategy,
    });

  } catch (error) {
    console.error('[runQualityAudit] error:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});