/**
 * generateAnalysis — Non-streaming analysis generator.
 * ALL enrichment lookups (AVM, neighborhood, walk/flood/schools, town-intel) run in parallel
 * before the AI call. This reduces total time from ~30 min to ~5-8 min.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

function runValidation({ reportJSON, prior_sale_price, prior_sale_year }) {
  if (prior_sale_price == null || prior_sale_year == null) return { valid: true, reason: 'no_prior_sale_data' };
  const currentYear = new Date().getFullYear();
  const yearsElapsed = currentYear - Number(prior_sale_year);
  let appreciationRate = 0.04;
  const rawRate = reportJSON?.market_context?.yoy_appreciation_rate ?? reportJSON?.market_context?.yoy_appreciation;
  if (rawRate != null && !isNaN(Number(rawRate))) {
    appreciationRate = Number(rawRate);
    if (appreciationRate > 1) appreciationRate = appreciationRate / 100;
  }
  const projectedValue = Number(prior_sale_price) * Math.pow(1 + appreciationRate, yearsElapsed);
  let aiMidpoint = reportJSON?.tiered_comps?.implied_value_range?.midpoint ?? reportJSON?.implied_value_range?.midpoint ?? null;
  if (aiMidpoint == null) return { valid: true, reason: 'no_ai_midpoint' };
  if (typeof aiMidpoint === 'string') aiMidpoint = Number(aiMidpoint.replace(/[^0-9.]/g, ''));
  aiMidpoint = Number(aiMidpoint);
  if (isNaN(aiMidpoint) || aiMidpoint === 0) return { valid: true, reason: 'no_ai_midpoint' };
  const varianceDecimal = (projectedValue - aiMidpoint) / projectedValue;
  if (varianceDecimal > 0.20) {
    return {
      valid: false,
      reason: 'valuation_anomaly',
      variance_percent: Math.round(varianceDecimal * 100),
      prior_sale_price: Number(prior_sale_price),
      prior_sale_year: Number(prior_sale_year),
      projected_current_value: Math.round(projectedValue),
      ai_midpoint: aiMidpoint,
    };
  }
  return { valid: true };
}

// ── AI Cost Logging ─────────────────────────────────────────────────────────

const PRICING = {
  anthropic: {
    'claude-sonnet-4-20250514': { inputPer1M: 3.00,  outputPer1M: 15.00 },
    'claude-opus-4-20250514':   { inputPer1M: 5.00,  outputPer1M: 25.00 },
    'claude-haiku-4-5':         { inputPer1M: 0.25,  outputPer1M: 1.25  },
    default:                    { inputPer1M: 3.00,  outputPer1M: 15.00 },
  },
  openai: {
    'gpt-4o':      { inputPer1M: 2.50,  outputPer1M: 10.00 },
    'gpt-4o-mini': { inputPer1M: 0.15,  outputPer1M: 0.60  },
    default:       { inputPer1M: 2.50,  outputPer1M: 10.00 },
  },
  google: {
    'gemini-2.0-flash': { inputPer1M: 0.075, outputPer1M: 0.30 },
    'gemini-1.5-pro':   { inputPer1M: 1.25,  outputPer1M: 5.00 },
    default:            { inputPer1M: 0.075, outputPer1M: 0.30 },
  },
  perplexity: { default: { inputPer1M: 1.00, outputPer1M: 1.00 } },
  xai:        { default: { inputPer1M: 5.00, outputPer1M: 15.00 } },
  mistral: {
    'mistral-large-latest': { inputPer1M: 2.00, outputPer1M: 6.00 },
    'mistral-small-latest': { inputPer1M: 0.10, outputPer1M: 0.30 },
    default:                { inputPer1M: 2.00, outputPer1M: 6.00 },
  },
  meta: { default: { inputPer1M: 0.18, outputPer1M: 0.18 } },
};

function calculateCostCents(provider, model, inputTokens, outputTokens) {
  const providerRates = PRICING[provider] || {};
  const rates = providerRates[model] || providerRates['default'] || { inputPer1M: 0, outputPer1M: 0 };
  const inputCost  = (inputTokens  / 1_000_000) * rates.inputPer1M;
  const outputCost = (outputTokens / 1_000_000) * rates.outputPer1M;
  return Math.round((inputCost + outputCost) * 100);
}

async function createAITokenLog(base44, payload) {
  await base44.asServiceRole.entities.AITokenLog.create(payload);
}

const SECTION_TO_TASK = {
  market_research:       'live_market_context',
  neighborhood_snapshot: 'neighbourhood_demand',
  buyer_archetype:       'buyer_archetypes',
  report_assembly:       'seller_narrative',
  narrative_layer:       'seller_narrative',
  pricing_strategy:      'pricing_strategy',
  net_sheet:             'net_sheet',
};

// ── Parse AI JSON-only response ───────────────────────────────────────────────

function extractJsonOutput(rawText) {
  let text = rawText.trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  }
  try {
    const outputJson = JSON.parse(text);
    const parts = [];
    if (outputJson.executive_summary) parts.push(`## Executive Summary\n${outputJson.executive_summary}`);
    if (outputJson.market_context?.narrative) parts.push(`## Market Context\n${outputJson.market_context.narrative}`);
    if (outputJson.valuation?.narrative) parts.push(`## Valuation\n${outputJson.valuation.narrative}`);
    if (outputJson.avm_analysis?.narrative) parts.push(`## AVM Analysis\n${outputJson.avm_analysis.narrative}`);
    const cleanText = parts.length ? parts.join('\n\n') : JSON.stringify(outputJson, null, 2).slice(0, 2000);
    return { cleanText, outputJson };
  } catch (e) {
    console.warn('[extractJsonOutput] Full-response JSON parse failed:', e.message, '| first 300:', text.slice(0, 300));
  }

  const START = '---BEGIN_JSON_OUTPUT---';
  const END   = '---END_JSON_OUTPUT---';
  const startIdx = text.indexOf(START);
  const endIdx   = text.indexOf(END);
  if (startIdx !== -1 && endIdx !== -1) {
    const jsonStr   = text.slice(startIdx + START.length, endIdx).trim();
    const cleanText = (text.slice(0, startIdx) + text.slice(endIdx + END.length)).trim();
    try {
      return { cleanText, outputJson: JSON.parse(jsonStr) };
    } catch (e2) {
      console.warn('[extractJsonOutput] Delimiter JSON parse also failed:', e2.message);
    }
  }
  return { cleanText: rawText, outputJson: null };
}

function getExpandedSystemPrompt(todayString) {
  const dataIntegrityRules = `
═══════════════════════════════════════════════════════════════
PROPPROMPT DATA INTEGRITY RULES — READ BEFORE PROCEEDING
═══════════════════════════════════════════════════════════════

1. COMPARABLE SALES
   You MUST NOT generate, invent, estimate, or recall any comparable
   sale address, price, or date from training data or memory.
   You MUST NOT fabricate street addresses, sale prices, or MLS numbers.
   
   Comparable sales are ONLY valid if they appear in the comp data
   passed to you in this prompt. If no comps are provided:
     - Set "implied_value_range" to null
     - Set "confidence_level" to "insufficient_data"
     - Set "data_quality_flag" to "red"
     - Set "comps" to an empty array []
   A red data_quality_flag will block PDF generation and refund the
   credit. This is the correct and expected behavior — do not attempt
   to work around it by generating placeholder comps.

2. PROPERTY ADDRESSES
   You MUST NOT generate fictional street addresses for any purpose.
   Every address in this report will be verified by a licensed real
   estate professional against public registry records.

3. VALUATIONS WITHOUT COMPS
   If you have fewer than 3 verified comps, set:
     "confidence_level": "low"
   State this clearly in the report narrative. Do not present a range
   with false precision when the underlying data is insufficient.

4. AVM DATA
   You MUST NOT guess or estimate AVM values from memory.
   Zillow, Redfin, Realtor.com, and Homes.com estimates must ONLY be
   populated from the PERPLEXITY_AVM_DATA block passed to you below.
   If PERPLEXITY_AVM_DATA is absent or null, set ALL avm platform
   estimate fields to null. Do not interpolate or guess.

5. OUTPUT FORMAT
   Return ONLY valid JSON matching the schema. Your response must begin
   with { and end with }. No preamble. No explanation. No markdown.
   No triple backticks. Just the JSON object.

A licensed real estate agent will present this output to a homeowner
making a financial decision. Accuracy is not optional.
═══════════════════════════════════════════════════════════════`;

  const finalSelfCheck = `
═══════════════════════════════════════════════════════════════
FINAL SELF-CHECK BEFORE OUTPUTTING:
  [ ] Did I use ONLY the comps provided in the input data?
      (No training-data addresses, no invented sales)
  [ ] Are all AVM values from PERPLEXITY_AVM_DATA only?
      (No guesses — null if not provided)
  [ ] Does my response begin with { and end with }?
  [ ] Are all required JSON fields populated?
  [ ] Does data_quality_flag reflect actual data state?
Output the JSON now.
═══════════════════════════════════════════════════════════════`;

  const prompt = `OUTPUT FORMAT — CRITICAL

You must return your entire response as a single valid JSON object.
Do NOT return markdown. Do NOT return narrative prose outside the JSON.
Do NOT use markdown fences. Start your response with { and end with }.

Every key in the schema below must be present. Populate every field with real, specific analysis data.
Narrative text goes inside designated string fields within the JSON.
If a field cannot be determined, use null and explain in the nearest notes field.

────────────────────────────────────────────────────────────────
JSON OUTPUT SCHEMA — RETURN THIS STRUCTURE POPULATED WITH REAL DATA
────────────────────────────────────────────────────────────────

{
  "property_address": "full address string",
  "assessment_type": "listing_pricing",
  "analysis_date": "March 25, 2026",
  "executive_summary": "3-4 paragraph narrative summary of the full analysis.",
  "market_context": {
    "narrative": "2-3 paragraph narrative on market conditions",
    "median_sale_price": 412000,
    "yoy_appreciation": 3.2,
    "avg_days_on_market": 24,
    "sale_to_list_ratio": 0.984,
    "months_inventory": 2.1,
    "market_characterization": "balanced-to-seller-favorable"
  },
  "valuation": {
    "narrative": "Explanation of valuation methodology and conclusions",
    "recommended_range_low": 425000,
    "recommended_range_high": 455000,
    "strategic_list_price": 439900,
    "estimated_dom_low": 18,
    "estimated_dom_high": 35,
    "confidence_level": "medium"
  },
  "tiered_comps": {
    "tiers": [
      {
        "tier_id": "A",
        "tier_label": "Tier A — Direct Comparables (Same Town)",
        "ppsf_range": {"low": 320, "high": 380},
        "comps": [
          {
            "address": "123 Example St, Norwood",
            "sale_date": "Jan 2026",
            "sale_price": 430000,
            "square_feet": 1050,
            "raw_ppsf": 410,
            "adjusted_ppsf": 385,
            "condition_vs_subject": "Similar",
            "within_building": false,
            "town": "Norwood",
            "same_town_as_subject": true,
            "town_adjustment_ratio": null,
            "town_adjusted_price": null,
            "town_adjustment_note": null
          }
        ]
      },
      {
        "tier_id": "B",
        "tier_label": "Tier B — Nearby Comparables (Same Town)",
        "ppsf_range": {"low": 300, "high": 360},
        "comps": []
      },
      {
        "tier_id": "C",
        "tier_label": "Tier C — Context Comparables (Adjacent Towns, Reference Only)",
        "ppsf_range": {"low": 290, "high": 370},
        "comps": [
          {
            "address": "456 Other Rd, Dedham",
            "sale_date": "Dec 2025",
            "sale_price": 485000,
            "square_feet": 1100,
            "raw_ppsf": 441,
            "adjusted_ppsf": 382,
            "condition_vs_subject": "Similar",
            "within_building": false,
            "town": "Dedham",
            "same_town_as_subject": false,
            "town_adjustment_ratio": 0.867,
            "town_adjusted_price": 420495,
            "town_adjustment_note": "Town-adjusted from Dedham to Norwood equivalent using 0.867 ratio (Dedham median $490/SF vs Norwood $425/SF)"
          }
        ]
      }
    ],
    "implied_value_range": {"low": 420000, "high": 460000, "midpoint": 440000},
    "thin_comp_flag": false
  },
  "avm_analysis": {
    "narrative": "Discussion of AVM estimates vs professional valuation and how to address with clients",
    "platforms": [
      {"name": "Zillow", "estimate": 445000, "range_low": 420000, "range_high": 465000, "trend": "stable", "date_retrieved": "March 25, 2026", "available": true, "unavailable_reason": null},
      {"name": "Redfin", "estimate": null, "range_low": null, "range_high": null, "trend": null, "date_retrieved": "March 25, 2026", "available": false, "unavailable_reason": "No estimate found for this unit"},
      {"name": "Realtor.com", "estimate": null, "range_low": null, "range_high": null, "trend": null, "date_retrieved": "March 25, 2026", "available": false, "unavailable_reason": "No estimate found"},
      {"name": "Homes.com", "estimate": null, "range_low": null, "range_high": null, "trend": null, "date_retrieved": "March 25, 2026", "available": false, "unavailable_reason": "No estimate found"}
    ],
    "composite": {"simple_average": 445000, "median": 445000, "spread": 0},
    "gap_analysis": {
      "professional_range_low": 425000,
      "professional_range_high": 455000,
      "avm_composite": 445000,
      "gap_dollars": -5000,
      "gap_pct": 1.1,
      "direction": "aligned"
    },
    "blind_spots": ["Property-specific reason 1", "Property-specific reason 2", "Property-specific reason 3"],
    "agent_response_strategy": "Strategy for addressing AVM questions from buyers"
  },
  "migration_analysis": {
    "feeder_markets": [
      {"market": "Boston", "migration_score": 8, "primary_motivation": "Space/Value trade", "price_psychology": "cashing_out_equity"}
    ],
    "push_factors": ["Factor 1", "Factor 2"],
    "pull_factors": ["Factor 1", "Factor 2"],
    "employer_targets": [
      {"company": "Company Name", "relevance": "High", "priority": 1, "target_roles": "Role types", "commute_time": "25-40 min", "office_location": "Location"}
    ]
  },
  "buyer_archetypes": [
    {
      "archetype_name": "Archetype Name",
      "estimated_pool_pct": 30,
      "profile": "3-4 sentence profile narrative describing who this buyer is and why property fits.",
      "must_haves": ["Item 1", "Item 2"],
      "key_concerns": ["Concern 1"],
      "language_use": ["Phrase to use 1", "Phrase to use 2", "Phrase to use 3"],
      "language_avoid": ["Phrase to avoid 1", "Phrase to avoid 2"],
      "attribute_resonance": {"turnkey": 3, "schools": 2}
    }
  ],
  "pricing_scenarios": [
    {"label": "Aggressive / Test Market", "price": 465000, "rationale": "Tests ceiling pricing.", "expected_dom": "30-45 days"},
    {"label": "Strategic List", "price": 439900, "rationale": "Maximum buyer pool access.", "expected_dom": "18-28 days"},
    {"label": "Rapid Sale", "price": 425000, "rationale": "Drive multiple offers.", "expected_dom": "7-14 days"}
  ]
}

────────────────────────────────────────────────────────────────
ANALYSIS INSTRUCTIONS
────────────────────────────────────────────────────────────────

COVER PAGE DATA:
- Property address (full street address, city, state, zip)
- Property type (e.g., Single-Family Residence)
- Report title: LISTING PRICING ANALYSIS
- Date: current date formatted as Month DD, YYYY
- Prepared by [AGENT_NAME]
- CONFIDENTIAL
DO NOT include the recommended price range, strategic list price, or estimated DOM on the cover page. These appear in Section 04 after the data foundation is established.

SECTION ORDER (generate content in this sequence):

SECTION 01 — Property & Market Context
  01a. Property Snapshot: subject property details, condition, notable features
  01b. Market Overview: current conditions narrative, KPI metrics, seasonal context
  01c. Rate Environment: current rates, purchasing power impact, Fed outlook

SECTION 02 — Valuation Analysis
  02a. Comparable Sales: tiered comp table WITH narrative per tier
  02b. Valuation Convergence: three independent methods, convergence statement
  02c. Consumer AVM Perception: AVM table, gap analysis, why AVMs miss this property

SECTION 03 — Buyer Demand Intelligence [PRO+ ONLY — omit for Starter tier]
  03a. Buyer Archetype Profiles: full profiles with language calibration
  03b. Migration & Feeder Markets: feeder table, employer targeting matrix

SECTION 04 — Pricing Strategy & Recommendation
  04a. Pricing Scenarios: 3 scenarios with full narrative each
  04b. Recommended Strategy: THE strategic list price reveal
  04c. Pre-Listing Preparation Timeline: 4-6 week checklist
  04d. Risk Factors & Market Headwinds: 3-5 risks with analysis

SECTION 05 — Seller Financial Summary
  05a. Estimated Net Proceeds: 3 scenarios matching pricing scenarios
  05b. Analysis Summary Table: 8-10 row key findings table

AGENT APPENDIX (mark all pages AGENT USE ONLY — REMOVE BEFORE SHARING):
  A1. Research Data Log (every data point, source, date)
  A2. Confidence Assessment (category-level HIGH/MEDIUM/LOW ratings)
  A3. Client Inquiry Note (if data gaps exist — draft email to client)
  A4. Follow-Up Checklist (pre-meeting, during, post-meeting, next annual)

SECTION LENGTH REQUIREMENTS:
This report supports a 30-45 minute listing appointment. Every section must feel substantial and authoritative.

- Executive Summary / Property Context: 3-4 paragraphs (8-12 sentences)
- Market Overview: 3-4 paragraphs + KPI metrics block
- Rate Environment: 2-3 paragraphs with specific rate data and purchasing power math
- Comparable Sales: 2-3 narrative sentences PER TIER above each comp table, plus a 2-3 sentence synthesis paragraph after all tiers
- Valuation Convergence: 2-3 sentences per method + convergence statement
- AVM Perception: Full table + 4-6 bullet 'Why AVMs Miss' section + 3-4 sentence 'Our Position' coaching section. DO NOT TRUNCATE.
- Buyer Archetypes [PRO+]: 3-5 sentence profile per archetype, minimum 3 USE items and 3 AVOID items each. DO NOT TRUNCATE.
- Migration [PRO+]: 2-3 sentences per feeder market. Complete employer table rows.
- Pricing Scenarios: 4-6 sentence narrative per scenario with strategy, expected buyer behavior, competition dynamics, and risk/reward.
- Pre-Listing Timeline: Specific tasks grouped by week for 4-6 weeks
- Risk Factors: 3-5 risks with 2-3 sentences each
- Net Proceeds: Three scenarios with line-item math
- Summary Table: 8-10 rows of key findings
- Agent Appendix: Full data log, confidence matrix, inquiry note, checklist

DO NOT truncate any section. If approaching token limits, prioritize completing all sections over adding length to any single section.

COMP SOURCING RULES — STRICTLY ENFORCED

TIER A comps MUST be from the SAME TOWN as the subject property. No exceptions.
Priority: same street/building > same neighborhood > same town, similar type/vintage.

TIER B comps MUST also be from the SAME TOWN. Expand radius within town only.

TIER C may include ADJACENT TOWNS for market context ONLY. Every Tier C comp from a
different town MUST include a town premium/discount adjustment:
  Ratio = subject_town_median_ppsf / comp_town_median_ppsf
  Town-adjusted price = comp_sale_price x ratio
  Label: Town-adjusted from [CompTown] to [SubjectTown] using X.XXX ratio

Tier C comps are REFERENCE ONLY. implied_value_range uses Tier A and B ONLY.
Every comp JSON object must include: town, same_town_as_subject, town_adjustment_ratio,
town_adjusted_price, town_adjustment_note.

AVM CONSUMER PERCEPTION ANALYSIS — REQUIRED (Listing Pricing & CMA)

Search for AVM estimates for the subject property from:
- Zillow (zillow.com) — Zestimate
- Redfin (redfin.com) — Redfin Estimate
- Realtor.com — Home Value
- Homes.com — Estimated Value

Record estimate, range low/high, trend, date. If unavailable: available=false with reason.
Compute: simple average, median, spread of available estimates.
Compare AVM composite to professional range: gap dollars, gap pct, direction (overvalue/undervalue/aligned +/-3%).
Identify 3-5 property-specific reasons AVMs miss THIS address.
Never attack platforms. Acknowledge buyers have already seen these numbers.

MIGRATION ANALYSIS:
1. 5-8 feeder markets scored 1-10 (volume 40%, price differential 30%, lifestyle/commute 20%, growth 10%)
2. Push/pull factors: economic, lifestyle, geographic ONLY — never demographic
3. Price psychology: stretching_up | cashing_out_equity | lateral_move | downsizing_into_quality
4. 6-14 employer targets with company, relevance, priority, target_roles, commute_time, office_location

BUYER ARCHETYPES:
1. 6-10 archetypes, estimated_pool_pct sums to ~100%
2. Names: lifestyle and financial descriptors only. Never protected class references.
3. Profile: 3-4 sentences, lifestyle/financial framing only
4. language_use: 3-5 phrases to USE in marketing copy
5. language_avoid: 3-5 phrases to AVOID
6. Condo required: Urban Downsizer, Young Professional First-Time, Pied-a-Terre Buyer, Investor/Rental Buyer

TIERED COMPS:
1. 12-18 total comps. If <12, set thin_comp_flag=true.
2. Comps >12 months old must be time-adjusted using local appreciation rate (max 5 yr cap).
3. Condo: within-building sales as sub-tier of Tier A; set within_building=true.
4. implied_value_range from Tier A adjusted PPSF x subject SF.

RECENCY BIAS — REQUIRED:
Weight comparable sales by recency when computing PPSF ranges and implied value:
- 0–6 months old: full weight (1.0x) — primary comps
- 7–12 months old: 0.75x weight — secondary comps
- 13–24 months old: 0.50x weight — context only, time-adjusted before use
When computing implied_value_range, anchor to the weighted average of Tier A PPSF with recency weights applied. If 0–6 month comps are available, they set the floor for the range — do not let older comps pull the midpoint below the most recent sales data.

BASEMENT / FINISHED AREA PPSF CORRECTION — REQUIRED:
Before computing PPSF for any comparable sale, verify whether the reported square footage is legal above-grade living area only, or if it includes a finished basement.

Rules:
- PPSF must be calculated on LEGAL ABOVE-GRADE LIVING AREA ONLY. Finished basements are NOT counted at full value.
- If a comp's reported sqft appears to include a finished basement (often indicated by "total finished area" or unusually high sqft for the bedroom/bathroom count), you must estimate and subtract the basement component.
- Finished basement sqft is valued at approximately 50% of above-grade living area per square foot. Apply this adjustment when computing a comp's effective PPSF.
- For the SUBJECT PROPERTY: confirm in the intake data whether the stated sqft is above-grade only. If the agent has noted a finished basement separately, exclude it from the PPSF denominator and note the adjustment.
- Flag any comp where basement inclusion is suspected but unconfirmed as "sqft_basis_uncertain": true in the comp JSON.
- Explicitly note in the valuation narrative whether the subject property sqft is above-grade only and how comps were normalized.

FAIR HOUSING COMPLIANCE — ALL OUTPUTS
NEVER reference protected classes: race, color, national origin, religion, sex, familial status,
disability, age, sexual orientation, gender identity, marital status, source of income, ancestry, veteran status.
Archetypes: life stage, property use, financial profile, lifestyle ONLY.
Migration data: geography and economic motivation ONLY.

REMINDER: Your ENTIRE response must be a single valid JSON object.
Start with { and end with }. No markdown. No text outside the JSON.`;

  return `You are PropPrompt™, an elite real estate AI analyst serving New England brokerages. Today's date is ${todayString}.\n\n${dataIntegrityRules}\n\n${prompt}\n\n${finalSelfCheck}`;
}

const ANTHROPIC_MODELS = {
  default: "claude-sonnet-4-20250514",
  agent:   "claude-sonnet-4-20250514",
};

async function callClaudeOnce(apiKey, prompt, keySource) {
  const model = keySource === "agent" ? ANTHROPIC_MODELS.agent : ANTHROPIC_MODELS.default;
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const systemPrompt = getExpandedSystemPrompt(today);
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 16000,
      messages: [{ role: "user", content: prompt }],
      system: systemPrompt,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err.error?.message || `Claude API error ${res.status}`;
    const isOverloaded = res.status === 529 || msg.toLowerCase().includes("overloaded");
    throw Object.assign(new Error(msg), { isOverloaded });
  }
  const data = await res.json();
  if (data.stop_reason === 'max_tokens') console.warn('[callClaude] WARNING: Analysis truncated at max_tokens');
  return {
    text: data.content?.[0]?.text || "",
    model,
    usage: { input_tokens: data.usage?.input_tokens || 0, output_tokens: data.usage?.output_tokens || 0 },
  };
}

async function callClaude(apiKey, prompt, keySource) {
  const maxRetries = 3;
  const delayMs = [3000, 8000, 15000];
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await callClaudeOnce(apiKey, prompt, keySource);
    } catch (err) {
      if (err.isOverloaded && attempt < maxRetries - 1) {
        console.warn(`[generateAnalysis] Claude overloaded, retry ${attempt + 1}/${maxRetries - 1} in ${delayMs[attempt]}ms...`);
        await new Promise(r => setTimeout(r, delayMs[attempt]));
      } else {
        throw err;
      }
    }
  }
}

async function callOpenAI(apiKey, prompt) {
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const systemPrompt = getExpandedSystemPrompt(today);
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o",
      max_tokens: 16000,
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenAI API error ${res.status}`);
  }
  const data = await res.json();
  if (data.choices?.[0]?.finish_reason === 'length') console.warn('[callOpenAI] WARNING: Analysis truncated at max_tokens');
  return {
    text: data.choices?.[0]?.message?.content || "",
    model: "gpt-4o",
    usage: { input_tokens: data.usage?.prompt_tokens || 0, output_tokens: data.usage?.completion_tokens || 0 },
  };
}

async function callGemini(apiKey, prompt) {
  const model = "gemini-2.0-flash";
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const systemPrompt = getExpandedSystemPrompt(today);
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 16000 },
      systemInstruction: { parts: [{ text: systemPrompt }] },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gemini API error ${res.status}`);
  }
  const data = await res.json();
  return {
    text: data.candidates?.[0]?.content?.parts?.[0]?.text || "",
    model,
    usage: { input_tokens: data.usageMetadata?.promptTokenCount || 0, output_tokens: data.usageMetadata?.candidatesTokenCount || 0 },
  };
}

async function callPerplexity(apiKey, prompt) {
  const model = "sonar-pro";
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const systemPrompt = getExpandedSystemPrompt(today);
  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      max_tokens: 16000,
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Perplexity API error ${res.status}`);
  }
  const data = await res.json();
  return {
    text: data.choices?.[0]?.message?.content || "",
    model,
    usage: { input_tokens: data.usage?.prompt_tokens || 0, output_tokens: data.usage?.completion_tokens || 0 },
  };
}

// ── AVM lookup helpers ────────────────────────────────────────────────────

function parseAvmJson(text, source) {
  try {
    let clean = (text || '').trim();
    if (clean.startsWith('```')) clean = clean.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (jsonMatch) clean = jsonMatch[0];
    return JSON.parse(clean);
  } catch (e) {
    console.warn(`[AVM ${source}] JSON parse failed:`, e.message, '| raw:', text?.slice(0, 200));
    return null;
  }
}

function mergeAvmResults(a, b) {
  if (!a && !b) return null;
  if (!a) return b;
  if (!b) return a;
  const platforms = ['zillow', 'redfin', 'realtor_com', 'homes_com'];
  const merged = {};
  for (const p of platforms) {
    const av = a[p] || {};
    const bv = b[p] || {};
    merged[p] = {
      estimate:   av.estimate   ?? bv.estimate   ?? null,
      range_low:  av.range_low  ?? bv.range_low  ?? null,
      range_high: av.range_high ?? bv.range_high ?? null,
      trend:      av.trend      ?? bv.trend      ?? null,
      as_of:      av.as_of      ?? bv.as_of      ?? null,
    };
  }
  return merged;
}

async function callPerplexityAVM(apiKey, address) {
  const systemPrompt = 'You are a real estate data researcher. Use your web search to look up current AVM estimates for the given property on Zillow, Redfin, Realtor.com, and Homes.com. Only report values you actually find via search. Return ONLY valid JSON with no markdown, no preamble.';
  const userPrompt = `What is the current Zestimate on Zillow for ${address}? Also search for the Redfin Estimate, Realtor.com home value, and Homes.com estimate for this same property. Search each platform and tell me exactly what dollar estimate you find. Return ONLY valid JSON (plain integers, no $ or commas), null for any platform with no value:
{"zillow":{"estimate":1126100,"range_low":1070000,"range_high":1190000,"trend":"stable","as_of":"April 2026"},"redfin":{"estimate":null,"range_low":null,"range_high":null,"trend":null,"as_of":null},"realtor_com":{"estimate":null,"range_low":null,"range_high":null,"trend":null,"as_of":null},"homes_com":{"estimate":null,"range_low":null,"range_high":null,"trend":null,"as_of":null}}`;

  const res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'sonar-pro',
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      search_context_size: 'high',
      return_images: false,
      return_related_questions: false,
    }),
  });
  if (!res.ok) throw new Error(`Perplexity AVM error ${res.status}`);
  const data = await res.json();
  const text = (data.choices?.[0]?.message?.content || '').trim();
  console.log('[callPerplexityAVM] raw:', text.slice(0, 300));
  return parseAvmJson(text, 'perplexity');
}

async function callOpenAIAVM(apiKey, address) {
  const userPrompt = `What is the current Zestimate on Zillow for ${address}? Also find the Redfin Estimate, Realtor.com home value, and Homes.com estimate for this same property. Search each platform. Return ONLY valid JSON (plain integers, no $ or commas), null for any platform with no value:
{"zillow":{"estimate":1126100,"range_low":1070000,"range_high":1190000,"trend":"stable","as_of":"April 2026"},"redfin":{"estimate":null,"range_low":null,"range_high":null,"trend":null,"as_of":null},"realtor_com":{"estimate":null,"range_low":null,"range_high":null,"trend":null,"as_of":null},"homes_com":{"estimate":null,"range_low":null,"range_high":null,"trend":null,"as_of":null}}`;

  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o', tools: [{ type: 'web_search_preview' }], input: userPrompt }),
  });
  if (!res.ok) throw new Error(`OpenAI AVM error ${res.status}`);
  const data = await res.json();
  let text = '';
  for (const item of (data.output || [])) {
    if (item.type === 'message') {
      for (const c of (item.content || [])) {
        if (c.type === 'output_text') text = c.text;
      }
    }
  }
  console.log('[callOpenAIAVM] raw:', text.slice(0, 300));
  return parseAvmJson(text, 'openai');
}

async function fetchAVMParallel(perpKey, openaiKey, address) {
  const tasks = [
    perpKey   ? callPerplexityAVM(perpKey, address).catch(e  => { console.warn('[AVM perplexity] failed:', e.message); return null; }) : Promise.resolve(null),
    openaiKey ? callOpenAIAVM(openaiKey, address).catch(e => { console.warn('[AVM openai] failed:', e.message); return null; }) : Promise.resolve(null),
  ];
  const [perpResult, openaiResult] = await Promise.all(tasks);
  console.log('[fetchAVMParallel] perplexity:', perpResult ? JSON.stringify(perpResult).slice(0, 150) : 'null');
  console.log('[fetchAVMParallel] openai:', openaiResult ? JSON.stringify(openaiResult).slice(0, 150) : 'null');
  const merged = mergeAvmResults(perpResult, openaiResult);
  console.log('[fetchAVMParallel] merged:', merged ? JSON.stringify(merged).slice(0, 200) : 'null');
  return merged;
}

// ── Perplexity helper (generic JSON fetch) ────────────────────────────────────

async function fetchPerplexityJson(perpKey, userContent, contextSize = 'low') {
  const res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${perpKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'sonar-pro',
      messages: [{ role: 'user', content: userContent }],
      search_context_size: contextSize,
    }),
  });
  if (!res.ok) throw new Error(`Perplexity ${res.status}`);
  const data = await res.json();
  return (data.choices?.[0]?.message?.content || '').trim();
}

function safeParseJson(text) {
  try {
    let clean = text.trim();
    if (clean.startsWith('```')) clean = clean.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    const match = clean.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch (e) { return null; }
}

// ── ALL enrichment in one parallel sweep ─────────────────────────────────────

async function fetchAllEnrichment(analysis, perpKey, openaiKey) {
  const addr = analysis.intake_data?.address || '';
  const town = (addr.split(',')[1] || '').trim() || addr;
  const assessmentType = analysis.assessment_type;
  const currentYear = new Date().getFullYear();

  const isAvmType        = ['listing_pricing', 'cma', 'client_portfolio'].includes(assessmentType);
  const isNeighborhood   = ['listing_pricing', 'cma', 'client_portfolio', 'buyer_intelligence'].includes(assessmentType);
  const isLocationCtx    = ['listing_pricing', 'cma', 'client_portfolio', 'buyer_intelligence', 'investment_analysis'].includes(assessmentType);
  const isTownIntel      = assessmentType === 'client_portfolio';

  const tasks = {
    avm:          (isAvmType && addr && (perpKey || openaiKey))
                    ? fetchAVMParallel(perpKey, openaiKey, addr).catch(e => { console.warn('[enrichment] AVM failed:', e.message); return null; })
                    : Promise.resolve(null),

    neighborhood: (isNeighborhood && perpKey && town)
                    ? fetchPerplexityJson(perpKey,
                        `For ${town}, Massachusetts real estate: What are the premium vs. average/below-average micro-neighborhoods, streets, or zones that affect single-family home values? Consider: MBTA/commuter rail proximity, school attendance zones within the town, historically desirable streets, commercial/highway noise zones, flood zones. Return ONLY valid JSON: {"median_ppsf": 625, "neighborhoods": [{"name": "area name", "premium_pct": 15, "tier": "premium", "reason": "brief reason"}]}`,
                        'medium'
                      ).catch(e => { console.warn('[enrichment] neighborhood failed:', e.message); return null; })
                    : Promise.resolve(null),

    walkability:  (isLocationCtx && perpKey && addr)
                    ? fetchPerplexityJson(perpKey,
                        `What is the Walk Score, Transit Score, and Bike Score for ${addr}? Search walkscore.com or any reliable source. Return ONLY valid JSON: {"walk_score": 72, "walk_label": "Very Walkable", "transit_score": 45, "transit_label": "Some Transit", "bike_score": 55, "bike_label": "Bikeable", "source": "Walk Score", "notes": "brief context"}`,
                        'low'
                      ).catch(e => { console.warn('[enrichment] walkability failed:', e.message); return null; })
                    : Promise.resolve(null),

    flood:        (isLocationCtx && perpKey && addr)
                    ? fetchPerplexityJson(perpKey,
                        `What is the FEMA flood zone designation for ${addr}? Search FEMA Flood Map Service Center (msc.fema.gov) or the local floodplain maps. Return ONLY valid JSON: {"flood_zone": "X", "flood_zone_description": "Minimal Flood Hazard", "panel_number": "25021C0234H", "effective_date": "2014-07-17", "insurance_required": false, "risk_level": "low", "notes": "brief context or caveats"}`,
                        'low'
                      ).catch(e => { console.warn('[enrichment] flood failed:', e.message); return null; })
                    : Promise.resolve(null),

    schools:      (isLocationCtx && perpKey && addr)
                    ? fetchPerplexityJson(perpKey,
                        `What are the assigned public schools (elementary, middle, high school) for a property at ${addr}? Also list any nearby highly-rated private or charter schools within 3 miles. Include GreatSchools ratings where available. Return ONLY valid JSON: {"assigned_schools": [{"name": "Lincoln Elementary", "type": "elementary", "grades": "K-5", "distance_miles": 0.4, "rating": 8, "rating_source": "GreatSchools"}], "nearby_notable": [{"name": "Brookline High", "type": "high", "grades": "9-12", "distance_miles": 1.2, "rating": 9, "rating_source": "GreatSchools", "public_private": "public"}]}`,
                        'medium'
                      ).catch(e => { console.warn('[enrichment] schools failed:', e.message); return null; })
                    : Promise.resolve(null),

    townIntel:    (isTownIntel && perpKey && town)
                    ? fetchPerplexityJson(perpKey,
                        `Research the following for ${town}, Massachusetts and Massachusetts statewide housing policy as of ${currentYear}:\n\n1. TOWN DEVELOPMENTS: What major development projects, infrastructure improvements, rezoning efforts, or town planning initiatives are recently approved, under construction, or proposed in ${town}, MA?\n\n2. MA HOUSING POLICY: What recent or upcoming Massachusetts state housing laws, policies, or mandates are affecting residential property owners and values?\n\nReturn ONLY valid JSON:\n{"town_developments":[{"project":"name","type":"infrastructure|commercial|rezoning|school|transit|park|employer|other","status":"approved|under_construction|proposed|completed","description":"2 sentence description","value_impact":"positive|negative|neutral|mixed","impact_reason":"1 sentence","timeline":"e.g. 2026","impact_magnitude":"high|medium|low"}],"ma_housing_policies":[{"policy":"name","category":"zoning|tax|rental|energy|adu|foreclosure|assessment|other","status":"enacted|pending|proposed","effective_date":"e.g. January 2025","description":"2 sentence plain-English explanation","owner_impact":"positive|negative|neutral|mixed","impact_reason":"1 sentence","action_required":true,"action_note":"what action or null"}],"overall_outlook":"bullish|cautious|neutral","outlook_summary":"2-3 sentence summary"}`,
                        'medium'
                      ).catch(e => { console.warn('[enrichment] townIntel failed:', e.message); return null; })
                    : Promise.resolve(null),
  };

  console.log('[generateAnalysis] Starting parallel enrichment sweep:', Object.keys(tasks).filter(k => tasks[k] !== Promise.resolve(null)).join(', '));
  const startEnrichment = Date.now();

  const [avm, neighborhood, walkability, flood, schools, townIntel] = await Promise.all([
    tasks.avm, tasks.neighborhood, tasks.walkability, tasks.flood, tasks.schools, tasks.townIntel,
  ]);

  console.log(`[generateAnalysis] Enrichment sweep complete in ${((Date.now() - startEnrichment)/1000).toFixed(1)}s`);

  return { avm, neighborhood, walkability, flood, schools, townIntel };
}

// ── Build enrichment injection blocks from results ───────────────────────────

function buildEnrichmentBlocks(enrichment, analysis) {
  const { avm, neighborhood, walkability, flood, schools, townIntel } = enrichment;
  const addr = analysis.intake_data?.address || '';
  const town = (addr.split(',')[1] || '').trim() || addr;
  let blocks = '';

  // AVM
  if (avm && ['listing_pricing', 'cma', 'client_portfolio'].includes(analysis.assessment_type)) {
    blocks += `\n\nAVM PERCEPTION DATA (from live Perplexity search — use ONLY these values, do NOT invent or guess):\n${JSON.stringify(avm, null, 2)}\n\nBuild the avm_perception object in the output JSON from this data.`;
  } else if (['listing_pricing', 'cma', 'client_portfolio'].includes(analysis.assessment_type)) {
    blocks += `\n\nAVM PERCEPTION DATA: null (live search unavailable)\nSet avm_perception to null in the output JSON.`;
  }

  // Micro-neighborhood
  const nJson = safeParseJson(neighborhood);
  if (nJson?.neighborhoods?.length > 0) {
    blocks += `\n\nMICRO-NEIGHBORHOOD INTELLIGENCE FOR ${town.toUpperCase()} (Perplexity research):
Town median PPSF: ~$${nJson.median_ppsf || 'unknown'}/SF
Neighborhood tiers:
${nJson.neighborhoods.map(n => `  • ${n.name}: ${n.premium_pct > 0 ? '+' : ''}${n.premium_pct}% (${n.tier}) — ${n.reason}`).join('\n')}

CRITICAL: Determine which micro-neighborhood the subject property at ${addr} is in. Apply the appropriate premium or discount to the PPSF when computing the implied value range. State the neighborhood tier in the valuation narrative.`;
    console.log('[generateAnalysis] Micro-neighborhood injected:', nJson.neighborhoods.length, 'zones');
  }

  // Walkability
  const wJson = safeParseJson(walkability);
  if (wJson?.walk_score != null) {
    blocks += `\n\nWALKABILITY SCORES:
Walk Score: ${wJson.walk_score}/100 — ${wJson.walk_label || ''}
Transit Score: ${wJson.transit_score != null ? wJson.transit_score + '/100' : 'N/A'} — ${wJson.transit_label || ''}
Bike Score: ${wJson.bike_score != null ? wJson.bike_score + '/100' : 'N/A'} — ${wJson.bike_label || ''}
${wJson.notes ? 'Notes: ' + wJson.notes : ''}
Include in output JSON as: "property_context": { "walkability": { "walk_score": N, "walk_label": "...", "transit_score": N, "transit_label": "...", "bike_score": N, "bike_label": "...", "notes": "..." } }`;
    console.log('[generateAnalysis] Walk Score injected:', wJson.walk_score);
  }

  // Flood zone
  const fJson = safeParseJson(flood);
  if (fJson?.flood_zone) {
    blocks += `\n\nFEMA FLOOD ZONE DATA:
Zone: ${fJson.flood_zone} — ${fJson.flood_zone_description || ''}
Risk Level: ${fJson.risk_level || 'unknown'}
Flood Insurance Required: ${fJson.insurance_required ? 'YES — mandatory for federally-backed mortgages' : 'No (standard zone)'}
FIRM Panel: ${fJson.panel_number || 'unknown'} | Effective: ${fJson.effective_date || 'unknown'}
${fJson.notes ? 'Notes: ' + fJson.notes : ''}
Include in output JSON as: "property_context": { ..., "flood_zone": { "flood_zone": "X", "flood_zone_description": "...", "risk_level": "low|moderate|high", "insurance_required": false, "panel_number": "...", "effective_date": "...", "notes": "..." } }`;
    console.log('[generateAnalysis] Flood zone injected:', fJson.flood_zone);
  }

  // Schools
  const sJson = safeParseJson(schools);
  if (sJson && (sJson.assigned_schools?.length > 0 || sJson.nearby_notable?.length > 0)) {
    const assigned = sJson.assigned_schools || [];
    const notable  = sJson.nearby_notable  || [];
    const schoolLines = [
      ...assigned.map(s => `  [ASSIGNED] ${s.name} (${s.type}, ${s.grades}) — ${s.distance_miles} mi${s.rating ? ' | GreatSchools: ' + s.rating + '/10' : ''}`),
      ...notable.map(s  => `  [NEARBY] ${s.name} (${s.public_private || s.type}, ${s.grades}) — ${s.distance_miles} mi${s.rating ? ' | GreatSchools: ' + s.rating + '/10' : ''}`),
    ];
    blocks += `\n\nSCHOOL DISTRICT & NEARBY SCHOOLS:\n${schoolLines.join('\n')}
Include in output JSON as: "property_context": { ..., "schools": { "assigned_schools": [...], "nearby_notable": [...] } }`;
    console.log('[generateAnalysis] Schools injected:', assigned.length, 'assigned,', notable.length, 'notable');
  }

  // Town intelligence (client_portfolio only)
  const tiJson = safeParseJson(townIntel);
  if (tiJson && (tiJson.town_developments?.length > 0 || tiJson.ma_housing_policies?.length > 0)) {
    const devLines    = (tiJson.town_developments || []).map(d => `  [${(d.status || 'PROJECT').toUpperCase()}] ${d.project} (${d.type}) — ${(d.value_impact || '').toUpperCase()} impact (${d.impact_magnitude}) — ${d.impact_reason} | Timeline: ${d.timeline || 'unknown'}`);
    const policyLines = (tiJson.ma_housing_policies || []).map(p => `  [${(p.status || 'POLICY').toUpperCase()}] ${p.policy} (${p.category}) — ${(p.owner_impact || '').toUpperCase()} impact — ${p.impact_reason}${p.action_required ? ' ⚠ ACTION REQUIRED: ' + p.action_note : ''}`);
    blocks += `\n\nTOWN DEVELOPMENT & MA HOUSING POLICY INTELLIGENCE (Perplexity live research for ${town}):

ACTIVE & UPCOMING TOWN DEVELOPMENTS:
${devLines.length ? devLines.join('\n') : '  No major developments found'}

MASSACHUSETTS HOUSING POLICIES AFFECTING THIS OWNER:
${policyLines.length ? policyLines.join('\n') : '  No major new policies found'}

OVERALL OUTLOOK: ${(tiJson.overall_outlook || 'NEUTRAL').toUpperCase()} — ${tiJson.outlook_summary || ''}

CRITICAL INSTRUCTION: Include a "local_impact" object in the output JSON with town, overall_outlook, outlook_summary, town_developments array, ma_housing_policies array, and agent_briefing (3-4 sentences).`;
    console.log('[generateAnalysis] Town intelligence injected:', tiJson.town_developments?.length, 'developments,', tiJson.ma_housing_policies?.length, 'policies');
  }

  return blocks;
}

// ── Wrap with timeout ─────────────────────────────────────────────────────────

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { analysisId, orgId } = await req.json();
    if (!analysisId) return Response.json({ error: "analysisId required" }, { status: 400 });

    // Load analysis + PlatformConfig in parallel (single round-trip)
    const [records, configs] = await Promise.all([
      base44.asServiceRole.entities.Analysis.filter({ id: analysisId }),
      base44.asServiceRole.entities.PlatformConfig.filter({}).catch(() => []),
    ]);

    const analysis = records[0];
    if (!analysis) return Response.json({ error: "Analysis not found" }, { status: 404 });

    if (analysis.run_by_email !== user.email && analysis.on_behalf_of_email !== user.email && user.role !== 'admin') {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Return cached result
    if (analysis.status === "complete" && analysis.output_text) {
      return Response.json({ output: analysis.output_text, model: analysis.ai_model, keySource: "cached", outputJson: !!analysis.output_json });
    }

    // Dedup guard
    if (analysis.status === "in_progress") {
      console.log('[generateAnalysis] Already in_progress — skipping duplicate run for:', analysisId);
      return Response.json({ status: "in_progress", message: "Analysis already running" });
    }

    // Resolve keys from already-loaded PlatformConfig (no extra DB call)
    const cfg = configs[0] || {};
    const PLATFORM_ENV_VARS   = { claude: "ANTHROPIC_API_KEY", chatgpt: "OPENAI_API_KEY", gemini: "GEMINI_API_KEY", perplexity: "PERPLEXITY_API_KEY", grok: "GROK_API_KEY" };
    const PLATFORM_CFG_FIELDS = { claude: "anthropic_api_key",  chatgpt: "openai_api_key",  gemini: "google_api_key",     perplexity: "perplexity_api_key", grok: "grok_api_key" };

    const aiPlatform = analysis.ai_platform || 'claude';
    const cfgField   = PLATFORM_CFG_FIELDS[aiPlatform];
    let apiKey       = (cfgField && cfg[cfgField]) ? cfg[cfgField] : (Deno.env.get(PLATFORM_ENV_VARS[aiPlatform]) || null);
    let keySource    = cfgField && cfg[cfgField] ? 'sc_platform' : 'env';

    if (!apiKey) return Response.json({ error: `No API key configured for platform: ${aiPlatform}` }, { status: 402 });

    const perpKey   = cfg.perplexity_api_key || Deno.env.get("PERPLEXITY_API_KEY") || null;
    const openaiKey = cfg.openai_api_key     || Deno.env.get("OPENAI_API_KEY")     || null;
    const getKey    = (platform) => {
      const cfgF = PLATFORM_CFG_FIELDS[platform];
      return (cfgF && cfg[cfgF]) ? cfg[cfgF] : (Deno.env.get(PLATFORM_ENV_VARS[platform] || '') || null);
    };

    // ── AUTO-FETCH COMPS (if none provided) + TIER LOOKUP + PROMPT LIBRARY — all parallel ──
    let agentComps = analysis.agent_comps || [];
    const needsComps = agentComps.length === 0 && analysis.intake_data?.address &&
      ['listing_pricing', 'cma', 'investment_analysis', 'client_portfolio'].includes(analysis.assessment_type);

    const [compsResult, subsResult, allLibraryPrompts] = await Promise.all([
      // Auto-fetch comps if needed
      needsComps ? (async () => {
        const rentcastKey = Deno.env.get('RENTCAST_API_KEY');
        if (!rentcastKey) return null;
        const d = analysis.intake_data;
        const rcParams = new URLSearchParams({
          address: d.address,
          propertyType: { single_family: 'Single Family', condo: 'Condo', multi_family: 'Multi-Family', land: 'Land' }[analysis.property_type] || 'Single Family',
          compCount: '10',
          daysOld: '730',
        });
        if (d.bedrooms)  rcParams.set('bedrooms',      String(Number(d.bedrooms)));
        if (d.bathrooms) rcParams.set('bathrooms',     String(Number(d.bathrooms)));
        if (d.sqft)      rcParams.set('squareFootage', String(Number(d.sqft)));
        const rcRes = await fetch(`https://api.rentcast.io/v1/avm/value?${rcParams.toString()}`, {
          headers: { 'X-Api-Key': rentcastKey, 'Accept': 'application/json' },
        });
        if (!rcRes.ok) { console.warn('[generateAnalysis] RentCast error:', rcRes.status); return null; }
        const rcData = await rcRes.json();
        return (rcData.comparables || []).filter(c => c.price && c.formattedAddress).map(c => {
          const price = Number(c.price);
          const sqftVal = Number(c.squareFootage) || null;
          return {
            address: c.formattedAddress, sale_price: price || null,
            sale_date: (c.lastSaleDate || c.listedDate || '').slice(0, 10) || null,
            sqft: sqftVal, bedrooms: c.bedrooms ? Number(c.bedrooms) : null,
            bathrooms: c.bathrooms ? Number(c.bathrooms) : null,
            price_per_sqft: (price && sqftVal) ? Math.round(price / sqftVal) : null,
            source: 'rentcast', agent_excluded: false, agent_notes: '',
          };
        });
      })().catch(e => { console.warn('[generateAnalysis] Comps fetch failed:', e.message); return null; })
      : Promise.resolve(null),

      // Tier lookup
      base44.asServiceRole.entities.TerritorySubscription.filter({ user_id: user.id })
        .catch(() => []),

      // PromptLibrary
      base44.asServiceRole.entities.PromptLibrary.filter({ is_active: true })
        .catch(() => []),
    ]);

    // Resolve comps
    if (compsResult && compsResult.length > 0) {
      agentComps = compsResult;
      console.log(`[generateAnalysis] Auto-fetched ${agentComps.length} comps from RentCast`);
      await base44.asServiceRole.entities.Analysis.update(analysisId, {
        agent_comps: agentComps, raw_batchdata_comps: agentComps,
        comps_fetched_at: new Date().toISOString(), comps_search_tier: 'rentcast', comps_source: 'api_verified',
      }).catch(() => {});
    }

    // Resolve tier
    let tier = 'starter';
    try {
      const activeSub = subsResult.find(s => s.status === 'active');
      if (activeSub?.tier) tier = activeSub.tier;
    } catch (e) { /* default */ }
    if (user.role === 'platform_owner' || user.role === 'admin') tier = 'team';
    const isPro = ['pro', 'team', 'broker', 'brokerage', 'enterprise'].includes(tier);

    // ── MARK IN_PROGRESS before starting AI work ─────────────────────────────
    await base44.asServiceRole.entities.Analysis.update(analysisId, { status: "in_progress" });

    // ── ALL ENRICHMENT IN PARALLEL (AVM + neighborhood + walk + flood + schools + town-intel) ──
    const enrichmentTimeout = analysis.assessment_type === 'client_portfolio' ? 35000 : 25000;
    const enrichment = await withTimeout(
      fetchAllEnrichment(analysis, perpKey, openaiKey),
      enrichmentTimeout,
      'enrichment-sweep'
    ).catch(e => {
      console.warn('[generateAnalysis] Enrichment sweep timed out or failed:', e.message);
      return { avm: null, neighborhood: null, walkability: null, flood: null, schools: null, townIntel: null };
    });

    // ── PHOTO ANALYSIS (if photos provided) — run after enrichment since it uses base44 integration ──
    let photoPromptBlock = '';
    const listingPhotos = analysis.listing_photos || analysis.intake_data?.listing_photos || [];
    const conditionOverride = analysis.condition_override || analysis.intake_data?.condition_override || null;
    if (listingPhotos.length > 0) {
      console.log(`[generateAnalysis] Analyzing ${listingPhotos.length} listing photo(s)`);
      try {
        const photoAnalysis = await base44.integrations.Core.InvokeLLM({
          prompt: `You are a professional real estate appraiser reviewing listing photos for ${analysis.intake_data?.address || 'this property'}. Analyze these listing photos and provide a condition assessment. Return ONLY valid JSON: {"overall_condition":"excellent|good|average|below_average|poor","condition_vs_market":"superior|similar|inferior","renovation_level":"fully_renovated|updated|original_good|needs_updating|needs_work","finish_quality":"luxury|above_average|standard|below_standard","key_positives":["feature"],"key_concerns":["issue"],"ppsf_adjustment_recommendation":12,"confidence":"high|medium|low","notes":"Brief summary"}`,
          file_urls: listingPhotos.slice(0, 6),
          model: 'claude_sonnet_4_6',
          response_json_schema: {
            type: "object",
            properties: {
              overall_condition: { type: "string" }, condition_vs_market: { type: "string" },
              renovation_level: { type: "string" }, finish_quality: { type: "string" },
              key_positives: { type: "array", items: { type: "string" } },
              key_concerns: { type: "array", items: { type: "string" } },
              ppsf_adjustment_recommendation: { type: "number" },
              confidence: { type: "string" }, notes: { type: "string" },
            }
          }
        });
        if (photoAnalysis?.overall_condition) {
          photoPromptBlock = `\n\nLISTING PHOTO ANALYSIS (AI Vision — ${listingPhotos.length} photos analyzed):
Condition: ${photoAnalysis.overall_condition} | vs Market: ${photoAnalysis.condition_vs_market} | Renovation: ${photoAnalysis.renovation_level} | Finish: ${photoAnalysis.finish_quality}
Positives: ${(photoAnalysis.key_positives || []).join(', ')}
Concerns: ${(photoAnalysis.key_concerns || []).join(', ') || 'None noted'}
PPSF Adjustment Recommendation: ${photoAnalysis.ppsf_adjustment_recommendation > 0 ? '+' : ''}${photoAnalysis.ppsf_adjustment_recommendation}% vs similar comps
Notes: ${photoAnalysis.notes}
CRITICAL: Use this photo analysis to weight comparable sales appropriately.`;
          console.log('[generateAnalysis] Photo analysis complete:', photoAnalysis.condition_vs_market, 'adj:', photoAnalysis.ppsf_adjustment_recommendation);
        }
      } catch (photoErr) {
        console.warn('[generateAnalysis] Photo analysis failed (non-fatal):', photoErr.message);
      }
    } else if (conditionOverride) {
      const conditionMap = {
        fully_renovated: { label: 'Fully Renovated', adjustment: '+15%', comp_weight: 'Weight toward superior comps' },
        updated:         { label: 'Updated / Improved', adjustment: '+8%', comp_weight: 'Weight toward upper-middle comps' },
        original_good:   { label: 'Original — Good Condition', adjustment: '0%', comp_weight: 'Weight toward similar comps' },
        needs_work:      { label: 'Needs Work', adjustment: '-10%', comp_weight: 'Weight toward inferior comps' },
      };
      const cm = conditionMap[conditionOverride] || {};
      photoPromptBlock = `\n\nAGENT CONDITION OVERRIDE (no photos provided):
Condition: ${cm.label || conditionOverride}
Recommended PPSF adjustment: ${cm.adjustment || 'neutral'}
Instruction: ${cm.comp_weight || 'Use agent-provided condition to weight comps appropriately.'}`;
    }

    // ── BUILD BASELINE PROMPT ─────────────────────────────────────────────────
    const d = analysis.intake_data || {};
    const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    let prompt = `ASSESSMENT TYPE: ${analysis.assessment_type?.replace(/_/g, " ").toUpperCase()}\nPROPERTY TYPE: ${analysis.property_type?.replace(/_/g, " ")}\nADDRESS: ${d.address || "Not provided"}\nLOCATION CLASS: ${analysis.location_class || "unknown"}\nCLIENT RELATIONSHIP: ${d.client_relationship || "buyer's agent"}\nTODAY'S DATE: ${today}\n\nINTAKE DATA:\n${JSON.stringify(d, null, 2)}\n\nPerform a complete PropPrompt™ analysis for the above property. Follow the JSON schema and all instructions in the system prompt exactly.`;

    // Try PromptLibrary override
    try {
      const match = allLibraryPrompts.find(p => p.ai_platform === aiPlatform && p.assessment_type === analysis.assessment_type && p.prompt_section === 'full_assembled')
        || allLibraryPrompts.find(p => p.ai_platform === aiPlatform && p.prompt_section === 'full_assembled')
        || allLibraryPrompts.find(p => p.ai_platform === 'generic');
      if (match?.prompt_text && !match.prompt_text.startsWith('ENC:') && !match.prompt_text.startsWith('FILE:')) {
        prompt = match.prompt_text;
      }
    } catch (e) { /* use baseline */ }

    // ── DATA QUALITY + COMP INJECTION ────────────────────────────────────────
    const valuationConsistencyRule = `\n\nVALUATION ACCURACY RULES — CRITICAL:
1. IMPLIED VALUE RANGE: Must be derived ONLY from Tier A (same-town) comps using adjusted PPSF × subject sqft, with recency weighting. Tier C comps are REFERENCE ONLY.
2. DO NOT DISCOUNT FOR REPORT TYPE: A portfolio review MUST produce the same value range as a listing pricing analysis for the same property and comp set.
3. DO NOT INVENT DOWNWARD ADJUSTMENTS without comp-supported reason.
4. AVM AS SANITY CHECK: If your implied_value_range is more than 10% below ALL AVM estimates with no data-supported reason, you are undervaluing. Recalibrate.
5. RECENCY ANCHOR: Recent Tier A comps (last 6 months) set the floor for implied_value_range.`;

    if (agentComps.length >= 3) {
      prompt += `\n\nDATA QUALITY: green\nCOMP COUNT: ${agentComps.length}\nSet data_quality_flag to 'green'.${valuationConsistencyRule}`;
    } else if (agentComps.length > 0) {
      prompt += `\n\nDATA QUALITY: yellow\nCOMP COUNT: ${agentComps.length}\nNote: Limited comps. Set confidence_level to 'low'. Set data_quality_flag to 'yellow'.${valuationConsistencyRule}`;
    } else {
      prompt += `\n\nDATA QUALITY: red\n⚠️ ZERO COMPS — Set data_quality_flag to 'red', implied_value_range to null, confidence_level to 'insufficient_data'. Do NOT write speculative valuation language. Generate all other sections fully.`;
    }

    if (agentComps.length > 0) {
      prompt += `\n\nCOMPARABLE SALES (Use ONLY these — do not invent or substitute):\n${JSON.stringify(agentComps, null, 2)}`;
    }

    if (analysis.prior_sale_price || analysis.prior_sale_year) {
      prompt += `\n\nPRIOR SALE HISTORY:\n  Last known sale price: ${analysis.prior_sale_price ? '$' + Number(analysis.prior_sale_price).toLocaleString() : 'unknown'}\n  Year of last sale: ${analysis.prior_sale_year || 'unknown'}\nUse this to cross-check valuation.`;
    }

    // ── EQUITY OPTIONS (client_portfolio) ────────────────────────────────────
    if (analysis.assessment_type === 'client_portfolio') {
      prompt += `\n\nEQUITY OPTIONS ANALYSIS — REQUIRED FOR CLIENT PORTFOLIO:
You MUST include an "equity_options" array with EXACTLY these 5 options, each customized to this property:
move_up (Move Up/Upgrade), downsize (Downsize & Cash Out), heloc (HELOC/Home Equity Line), refinance (Cash-Out Refinance), renovate (Renovate & Hold).
Each option must include: id, title, tagline, estimated_equity, option_summary, financial_snapshot (with estimated_home_value, estimated_mortgage_balance, estimated_gross_equity, closing_costs_estimate, net_equity_available, notes), pros, cons, ideal_if, market_timing (favorable|neutral|unfavorable), market_timing_reason.
Address ${d.address || 'this property'} specifically in each option narrative.`;

      const currentYear = new Date().getFullYear();
      prompt += `\n\nDESIGN & RENOVATION TRENDS — REQUIRED FOR CLIENT PORTFOLIO:
Include a "design_trends" object with: trend_year (${currentYear}), intro, kitchen_styles (2-3 items with trend/description/roi_estimate/cost_range/relevance_to_subject), paint_colors (4-6 items with color_name/brand_swatch/hex_approx/mood/best_for/why_now), popular_renovations (5-7 items ranked by ROI with renovation/avg_cost/avg_roi/time_to_complete/impact/description/priority/relevant_to_subject), staging_tips (4 items), agent_talking_points (2 items). Make all recommendations specific to New England/Northeast market.`;
    }

    // ── INJECT ENRICHMENT BLOCKS ──────────────────────────────────────────────
    prompt += photoPromptBlock;
    prompt += buildEnrichmentBlocks(enrichment, analysis);

    // ── PIPELINE PATH (Pro/Team) ──────────────────────────────────────────────
    const pipelinePrompts = allLibraryPrompts
      .filter(p => p.ensemble_order != null && p.assessment_type === (analysis.assessment_type || 'listing_pricing'))
      .sort((a, b) => a.ensemble_order - b.ensemble_order);

    const hasPipeline = pipelinePrompts.length > 0;

    if (isPro && hasPipeline) {
      console.log(`[generateAnalysis] Running ${tier} pipeline with ${pipelinePrompts.length} steps`);
      const startTime = Date.now();

      const callProvider = async (platform, key, p) => {
        if (!key) throw new Error(`No API key for ${platform}`);
        if (platform === 'claude')      return callClaude(key, p, 'platform');
        if (platform === 'chatgpt')     return callOpenAI(key, p);
        if (platform === 'gemini')      return callGemini(key, p);
        if (platform === 'perplexity')  return callPerplexity(key, p);
        return callClaude(key, p, 'platform');
      };

      const extras = { perplexity_data: null, gemini_data: null, registry_data: null };
      const sectionOutputs = {};

      await base44.asServiceRole.entities.Analysis.update(analysisId, {
        ensemble_mode_used: true, assembly_status: 'in_progress', sections_total: pipelinePrompts.length,
      });

      for (const promptRecord of pipelinePrompts) {
        const section = promptRecord.prompt_section;
        console.log(`[pipeline] step ${promptRecord.ensemble_order}: ${section} via ${promptRecord.ai_platform}`);

        let stepPrompt = (promptRecord.prompt_text || '')
          .replace(/\[ADDRESS\]/g,           d.address || '')
          .replace(/\[PROPERTY_TYPE\]/g,     analysis.property_type || '')
          .replace(/\[ASSESSMENT_TYPE\]/g,   analysis.assessment_type || '')
          .replace(/\[LOCATION_CLASS\]/g,    analysis.location_class || '')
          .replace(/\[CLIENT_RELATIONSHIP\]/g, d.client_relationship || '')
          .replace(/\[OUTPUT_FORMAT\]/g,     analysis.output_format || 'narrative')
          .replace(/\[AGENT_EMAIL\]/g,       analysis.run_by_email || '')
          .replace(/\[INTAKE_JSON\]/g,       JSON.stringify(d, null, 2))
          .replace(/\[PERPLEXITY_DATA\]/g,   extras.perplexity_data ? JSON.stringify(extras.perplexity_data, null, 2) : '(not yet available)')
          .replace(/\[GEMINI_DATA\]/g,       extras.gemini_data     ? JSON.stringify(extras.gemini_data, null, 2)     : '(not yet available)')
          .replace(/\[REGISTRY_DATA\]/g,     extras.registry_data   ? JSON.stringify(extras.registry_data, null, 2)   : '(not yet available)');

        // Inject enrichment into report_assembly step
        if (section === 'report_assembly') {
          stepPrompt += buildEnrichmentBlocks(enrichment, analysis);
        }

        try {
          const stepKey    = getKey(promptRecord.ai_platform);
          const stepResult = await callProvider(promptRecord.ai_platform, stepKey, stepPrompt);
          sectionOutputs[section] = stepResult.text;
          if (section === 'market_research')      extras.perplexity_data = stepResult.text;
          if (section === 'neighborhood_snapshot') extras.gemini_data    = stepResult.text;

          try {
            const stepUsage = stepResult.usage || {};
            const prov = promptRecord.ai_platform === 'chatgpt' ? 'openai' : promptRecord.ai_platform === 'gemini' ? 'google' : promptRecord.ai_platform;
            await createAITokenLog(base44, {
              analysis_id: analysisId, agent_id: user?.id || null, provider: prov,
              model: stepResult.model || '', task: SECTION_TO_TASK[section] || 'other',
              report_type: analysis.assessment_type || null,
              input_tokens: stepUsage.input_tokens || 0, output_tokens: stepUsage.output_tokens || 0,
              cost_cents: calculateCostCents(prov, stepResult.model || '', stepUsage.input_tokens || 0, stepUsage.output_tokens || 0),
              agent_tier: tier,
            });
          } catch (logError) { console.warn('[generateAnalysis] AITokenLog failed:', logError.message); }

          await base44.asServiceRole.entities.Analysis.update(analysisId, {
            sections_completed: Object.keys(sectionOutputs).length,
            ensemble_section_outputs: { ...sectionOutputs },
          });
        } catch (e) {
          console.warn(`[pipeline] step ${section} failed:`, e.message);
          sectionOutputs[section] = `[Section unavailable: ${e.message}]`;
        }
      }

      const rawFinalOutput = sectionOutputs['report_assembly'] || sectionOutputs['narrative_layer'] || Object.values(sectionOutputs).join('\n\n---\n\n');
      const { cleanText: pipelineCleanText, outputJson: pipelineOutputJson } = extractJsonOutput(rawFinalOutput);
      const finalOutput = pipelineCleanText || rawFinalOutput;

      const generationEnd  = Date.now();
      const generationTime = generationEnd - startTime;
      const durationSeconds = Math.round(generationTime / 10) / 100;
      console.log('[PropPrompt Timing]', { analysis_id: analysisId, tier, report_type: analysis.assessment_type, duration_s: durationSeconds });

      try {
        await base44.asServiceRole.entities.GenerationTimingLog.create({
          analysis_id: analysisId, report_type: analysis.assessment_type || 'unknown',
          subscription_tier: tier,
          generation_start: new Date(startTime).toISOString(), generation_end: new Date(generationEnd).toISOString(),
          duration_ms: generationTime, duration_seconds: durationSeconds,
          threshold_exceeded: durationSeconds > 60, alert_sent: false, model_pipeline: 'ensemble-pipeline',
        });
      } catch (e) { console.warn('[generateAnalysis] TimingLog failed:', e.message); }

      if (pipelineOutputJson) {
        const pipelineValidation = runValidation({ reportJSON: pipelineOutputJson, prior_sale_price: analysis.prior_sale_price ?? null, prior_sale_year: analysis.prior_sale_year ?? null });
        if (!pipelineValidation.valid) {
          await base44.asServiceRole.entities.Analysis.update(analysisId, {
            status: 'anomaly_flagged', valuation_anomaly: pipelineValidation,
            output_json: pipelineOutputJson, output_text: finalOutput,
          });
          return Response.json({ anomaly: pipelineValidation, model: `pipeline-${tier}` });
        }
      }

      let pipelineOutputText = finalOutput;
      if (finalOutput && finalOutput.length > 15000) {
        try {
          const blob = new Blob([finalOutput], { type: 'text/plain' });
          const file = new File([blob], `analysis_${analysisId}_pipeline.txt`, { type: 'text/plain' });
          const uploadRes = await base44.asServiceRole.integrations.Core.UploadFile({ file });
          pipelineOutputText = uploadRes?.file_url || finalOutput.slice(0, 15000);
        } catch (uploadErr) {
          pipelineOutputText = finalOutput.slice(0, 15000);
        }
      }

      const pipelineSaveData = {
        status: 'complete', output_text: pipelineOutputText, completed_at: new Date().toISOString(),
        ai_model: `pipeline-${tier}`, assembly_status: 'complete',
        sections_completed: Object.keys(sectionOutputs).length, ensemble_mode_used: true,
        generation_time_ms: generationTime,
      };
      if (pipelineOutputJson) pipelineSaveData.output_json = pipelineOutputJson;
      await base44.asServiceRole.entities.Analysis.update(analysisId, pipelineSaveData);

      try { await base44.functions.invoke('deductAnalysisQuota', { analysisId, orgId: analysis.org_id }); } catch (e) { console.warn('[generateAnalysis] quota deduction failed:', e.message); }
      if (analysis.assessment_type === 'listing_pricing' && pipelineOutputJson) {
        try { await base44.functions.invoke('calculateNetProceeds', { analysisId }); } catch (e) { /* non-fatal */ }
      }

      return Response.json({ output: finalOutput, outputJson: !!pipelineOutputJson, model: `pipeline-${tier}`, keySource: 'platform', sectionsCompleted: Object.keys(sectionOutputs).length, generationTimeMs: generationTime });
    }

    // ── STARTER / FALLBACK: Single-model path ─────────────────────────────────
    const starterGenStart = Date.now();
    let result;
    const platform = analysis.ai_platform;
    if      (platform === "claude")      result = await callClaude(apiKey, prompt, keySource);
    else if (platform === "chatgpt")     result = await callOpenAI(apiKey, prompt);
    else if (platform === "gemini")      result = await callGemini(apiKey, prompt);
    else if (platform === "perplexity")  result = await callPerplexity(apiKey, prompt);
    else                                 result = await callClaude(apiKey, prompt, keySource);

    const lastChar = result.text.trim().slice(-1);
    if (lastChar !== '}' && lastChar !== '"') {
      console.warn('[generateAnalysis] WARNING: response may be truncated. Last char:', JSON.stringify(lastChar));
    }

    const providerKey = platform === 'chatgpt' ? 'openai' : platform === 'gemini' ? 'google' : platform;
    try {
      const resultUsage = result.usage || {};
      await createAITokenLog(base44, {
        analysis_id: analysisId, agent_id: user?.id || null, provider: providerKey,
        model: result.model || '', task: 'other', report_type: analysis.assessment_type || null,
        input_tokens: resultUsage.input_tokens || 0, output_tokens: resultUsage.output_tokens || 0,
        cost_cents: calculateCostCents(providerKey, result.model || '', resultUsage.input_tokens || 0, resultUsage.output_tokens || 0),
        agent_tier: tier,
      });
    } catch (logError) { console.warn('[generateAnalysis] AITokenLog failed:', logError.message); }

    const starterGenEnd   = Date.now();
    const starterDurationMs  = starterGenEnd - starterGenStart;
    const starterDurationSec = Math.round(starterDurationMs / 10) / 100;
    console.log('[PropPrompt Timing]', { analysis_id: analysisId, tier, report_type: analysis.assessment_type, duration_s: starterDurationSec });
    try {
      await base44.asServiceRole.entities.GenerationTimingLog.create({
        analysis_id: analysisId, report_type: analysis.assessment_type || 'unknown',
        subscription_tier: tier, generation_start: new Date(starterGenStart).toISOString(),
        generation_end: new Date(starterGenEnd).toISOString(),
        duration_ms: starterDurationMs, duration_seconds: starterDurationSec,
        threshold_exceeded: starterDurationSec > 45, alert_sent: false, model_pipeline: 'single-model',
      });
    } catch (e) { console.warn('[generateAnalysis] TimingLog failed:', e.message); }

    const { cleanText, outputJson } = extractJsonOutput(result.text);

    if (outputJson) {
      const validationResult = runValidation({ reportJSON: outputJson, prior_sale_price: analysis.prior_sale_price ?? null, prior_sale_year: analysis.prior_sale_year ?? null });
      if (!validationResult.valid) {
        await base44.asServiceRole.entities.Analysis.update(analysisId, {
          status: 'anomaly_flagged', valuation_anomaly: validationResult, output_json: outputJson,
        });
        return Response.json({ anomaly: validationResult, model: result.model });
      }
    }

    let outputTextToSave = cleanText;
    if (cleanText && cleanText.length > 15000) {
      try {
        const blob = new Blob([cleanText], { type: 'text/plain' });
        const file = new File([blob], `analysis_${analysisId}.txt`, { type: 'text/plain' });
        const uploadRes = await base44.asServiceRole.integrations.Core.UploadFile({ file });
        outputTextToSave = uploadRes?.file_url || cleanText.slice(0, 15000);
      } catch (uploadErr) {
        outputTextToSave = cleanText.slice(0, 15000);
      }
    }

    const saveData = { status: "complete", output_text: outputTextToSave, completed_at: new Date().toISOString(), ai_model: result.model };
    if (outputJson) saveData.output_json = outputJson;
    await base44.asServiceRole.entities.Analysis.update(analysisId, saveData);

    try { await base44.functions.invoke("deductAnalysisQuota", { analysisId, orgId: analysis.org_id }); } catch (e) { console.warn("[generateAnalysis] quota deduction failed:", e.message); }
    if (analysis.assessment_type === 'listing_pricing' && outputJson) {
      try { await base44.functions.invoke('calculateNetProceeds', { analysisId }); } catch (e) { /* non-fatal */ }
    }

    return Response.json({ output: cleanText, outputJson: !!outputJson, model: result.model, keySource });

  } catch (error) {
    console.error("[generateAnalysis] error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});