/**
 * generateAnalysis — Non-streaming analysis generator.
 * Resolves API key → assembles prompt → calls Claude/OpenAI/Gemini → saves & returns output.
 * Used by AnalysisRun page via SDK invoke (avoids SSE auth issues).
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// Inline section matrix (must match assemblePrompt)
function getRequiredSections(assessmentType, analysis) {
  const matrix = {
    listing_pricing: {
      base: ['migration_analysis', 'buyer_archetype', 'tiered_comps', 'listing_timing', 'attribute_alignment_grid', 'location_priority_characteristics'],
    },
    cma: {
      base: ['tiered_comps', 'location_priority_characteristics'],
      migration_opt: ['migration_analysis'],
      archetype_opt: ['buyer_archetype'],
    },
    buyer_intelligence: {
      base: ['migration_analysis', 'buyer_archetype', 'listing_timing', 'attribute_alignment_grid', 'location_priority_characteristics'],
    },
    investment_analysis: {
      base: ['tiered_comps', 'location_priority_characteristics', 'rate_environment'],
      migration_opt: ['migration_analysis'],
      archetype_opt: ['buyer_archetype'],
    },
    rental_analysis: { base: [] },
    client_portfolio: {
      base: ['tiered_comps', 'portfolio_options', 'adu_option', 'location_priority_characteristics', 'rate_environment'],
    },
    custom: { base: analysis.selected_modules || [] },
  };

  const config = matrix[assessmentType] || { base: [] };
  const sections = new Set([...config.base]);
  if (analysis.include_migration && config.migration_opt) config.migration_opt.forEach(s => sections.add(s));
  if (analysis.include_archetypes && config.archetype_opt) config.archetype_opt.forEach(s => sections.add(s));
  return sections;
}

// Parse AI JSON-only response; extract narrative text from JSON fields for output_text
function extractJsonOutput(rawText) {
  // Strip markdown fences if present
  let text = rawText.trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  }

  // Attempt full-response parse (JSON-only mode)
  try {
    const outputJson = JSON.parse(text);
    // Build readable output_text from narrative fields inside the JSON
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

  // Fallback: delimiter-based extraction
  const START = '---BEGIN_JSON_OUTPUT---';
  const END = '---END_JSON_OUTPUT---';
  const startIdx = text.indexOf(START);
  const endIdx = text.indexOf(END);
  if (startIdx !== -1 && endIdx !== -1) {
    const jsonStr = text.slice(startIdx + START.length, endIdx).trim();
    const cleanText = (text.slice(0, startIdx) + text.slice(endIdx + END.length)).trim();
    try {
      return { cleanText, outputJson: JSON.parse(jsonStr) };
    } catch (e2) {
      console.warn('[extractJsonOutput] Delimiter JSON parse also failed:', e2.message);
    }
  }

  // Nothing worked — return raw text, no JSON
  return { cleanText: rawText, outputJson: null };
}

function getExpandedSystemPrompt(todayString) {
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

COMP SOURCING RULES — STRICTLY ENFORCED

TIER A comps MUST be from the SAME TOWN as the subject property. No exceptions.
Priority: same street/building > same neighborhood > same town, similar type/vintage.

TIER B comps MUST also be from the SAME TOWN. Expand radius within town only.

TIER C may include ADJACENT TOWNS for market context ONLY. Every Tier C comp from a
different town MUST include a town premium/discount adjustment:
  Ratio = subject_town_median_ppsf / comp_town_median_ppsf
  Town-adjusted price = comp_sale_price × ratio
  Label: "Town-adjusted from [CompTown] to [SubjectTown] using X.XXX ratio"

Tier C comps are REFERENCE ONLY. implied_value_range uses Tier A and B ONLY.
Every comp JSON object must include: town, same_town_as_subject, town_adjustment_ratio,
town_adjusted_price, town_adjustment_note.

AVM CONSUMER PERCEPTION ANALYSIS — REQUIRED (Listing Pricing & CMA)

Search for AVM estimates for the subject property from:
- Zillow (zillow.com) — "Zestimate"
- Redfin (redfin.com) — "Redfin Estimate"
- Realtor.com — "Home Value"
- Homes.com — "Estimated Value"

Record estimate, range low/high, trend, date. If unavailable: available=false with reason.
Compute: simple average, median, spread of available estimates.
Compare AVM composite to professional range: gap dollars, gap pct, direction (overvalue/undervalue/aligned ±3%).
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
6. Condo required: Urban Downsizer, Young Professional First-Time, Pied-à-Terre Buyer, Investor/Rental Buyer

TIERED COMPS:
1. 12-18 total comps. If <12, set thin_comp_flag=true.
2. Comps >12 months old must be time-adjusted (local appreciation rate, max 5 yr cap)
3. Condo: within-building sales as sub-tier of Tier A; set within_building=true
4. implied_value_range from Tier A adjusted PPSF × subject SF

FAIR HOUSING COMPLIANCE — ALL OUTPUTS
NEVER reference protected classes: race, color, national origin, religion, sex, familial status,
disability, age, sexual orientation, gender identity, marital status, source of income, ancestry, veteran status.
Archetypes: life stage, property use, financial profile, lifestyle ONLY.
Migration data: geography and economic motivation ONLY.

REMINDER: Your ENTIRE response must be a single valid JSON object.
Start with { and end with }. No markdown. No text outside the JSON.`;

  return `You are PropPrompt™, an elite real estate AI analyst serving New England brokerages. Today's date is ${todayString}.\n\n${prompt}`;
}

const ANTHROPIC_MODELS = {
  default: "claude-opus-4-5",
  agent:   "claude-3-5-sonnet-20241022",
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
  return { text: data.content?.[0]?.text || "", model };
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
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      max_tokens: 16000,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenAI API error ${res.status}`);
  }
  const data = await res.json();
  return { text: data.choices?.[0]?.message?.content || "", model: "gpt-4o" };
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
  return { text: data.candidates?.[0]?.content?.parts?.[0]?.text || "", model };
}

async function callPerplexity(apiKey, prompt) {
  const model = "sonar-pro";
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const systemPrompt = getExpandedSystemPrompt(today);
  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 16000,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Perplexity API error ${res.status}`);
  }
  const data = await res.json();
  return { text: data.choices?.[0]?.message?.content || "", model };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { analysisId, orgId } = await req.json();
    if (!analysisId) return Response.json({ error: "analysisId required" }, { status: 400 });

    // Load analysis
    const records = await base44.asServiceRole.entities.Analysis.filter({ id: analysisId });
    const analysis = records[0];
    if (!analysis) return Response.json({ error: "Analysis not found" }, { status: 404 });

    // Ownership check
    if (analysis.run_by_email !== user.email && analysis.on_behalf_of_email !== user.email && user.role !== 'admin') {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // If already complete with output_text, return cached (don't re-run)
    if (analysis.status === "complete" && analysis.output_text) {
      return Response.json({ output: analysis.output_text, model: analysis.ai_model, keySource: "cached", outputJson: !!analysis.output_json });
    }

    // Resolve API key
    const keyRes = await base44.functions.invoke("resolveApiKey", {
      platform: analysis.ai_platform,
      orgId: analysis.org_id || orgId,
      agentEmail: analysis.run_by_email,
    });
    if (!keyRes.data?.apiKey) {
      return Response.json({ error: keyRes.data?.error || `No API key for platform: ${analysis.ai_platform}` }, { status: 402 });
    }
    const { apiKey, source: keySource } = keyRes.data;

    // Assemble prompt
    const promptRes = await base44.functions.invoke("assemblePrompt", { analysisId });
    const prompt = promptRes.data?.prompt || `Analyze this property for a PropPrompt™ listing pricing analysis: ${JSON.stringify(analysis.intake_data)}`;

    // Mark as in_progress
    await base44.asServiceRole.entities.Analysis.update(analysisId, { status: "in_progress" });

    // ── TIER-BASED ROUTING ──────────────────────────────────────────────────
    let tier = 'starter';
    try {
      const subs = await base44.asServiceRole.entities.TerritorySubscription.filter({ user_id: user.id });
      const activeSub = subs.find(s => s.status === 'active');
      if (activeSub?.tier) tier = activeSub.tier;
      else {
        const orgs = await base44.asServiceRole.entities.Organization.filter({ id: analysis.org_id });
        tier = orgs[0]?.subscription_plan || 'starter';
      }
    } catch (e) {
      console.warn('[generateAnalysis] tier lookup failed, defaulting to starter:', e.message);
    }

    const isPro = tier === 'pro' || tier === 'team' || tier === 'broker' || tier === 'brokerage' || tier === 'enterprise';

    // Fetch PromptLibrary pipeline prompts if pro+
    const allLibraryPrompts = await base44.asServiceRole.entities.PromptLibrary.filter({ is_active: true });
    const pipelinePrompts = allLibraryPrompts
      .filter(p => p.ensemble_order != null && p.assessment_type === (analysis.assessment_type || 'listing_pricing'))
      .sort((a, b) => a.ensemble_order - b.ensemble_order);

    const hasPipeline = pipelinePrompts.length > 0;

    if (isPro && hasPipeline) {
      // ── PRO/TEAM: PromptLibrary ensemble pipeline ─────────────────────────
      console.log(`[generateAnalysis] Running ${tier} pipeline with ${pipelinePrompts.length} steps`);
      const startTime = Date.now();

      const getKey = async (platform) => {
        const r = await base44.functions.invoke('resolveApiKey', {
          platform, orgId: analysis.org_id, agentEmail: analysis.run_by_email,
        });
        return r.data?.apiKey || null;
      };

      const callProvider = async (platform, key, p) => {
        if (!key) throw new Error(`No API key for ${platform}`);
        if (platform === 'claude') return callClaude(key, p, 'platform');
        if (platform === 'chatgpt') return callOpenAI(key, p);
        if (platform === 'gemini') return callGemini(key, p);
        if (platform === 'perplexity') return callPerplexity(key, p);
        return callClaude(key, p, 'platform');
      };

      const extras = { perplexity_data: null, gemini_data: null, registry_data: null };
      const sectionOutputs = {};

      await base44.asServiceRole.entities.Analysis.update(analysisId, {
        ensemble_mode_used: true,
        assembly_status: 'in_progress',
        sections_total: pipelinePrompts.length,
      });

      for (const promptRecord of pipelinePrompts) {
        const section = promptRecord.prompt_section;
        console.log(`[pipeline] step ${promptRecord.ensemble_order}: ${section} via ${promptRecord.ai_platform}`);

        let stepPrompt = promptRecord.prompt_text || '';
        const d = analysis.intake_data || {};
        stepPrompt = stepPrompt
          .replace(/\[ADDRESS\]/g, d.address || '')
          .replace(/\[PROPERTY_TYPE\]/g, analysis.property_type || '')
          .replace(/\[ASSESSMENT_TYPE\]/g, analysis.assessment_type || '')
          .replace(/\[LOCATION_CLASS\]/g, analysis.location_class || '')
          .replace(/\[CLIENT_RELATIONSHIP\]/g, d.client_relationship || '')
          .replace(/\[OUTPUT_FORMAT\]/g, analysis.output_format || 'narrative')
          .replace(/\[AGENT_EMAIL\]/g, analysis.run_by_email || '')
          .replace(/\[INTAKE_JSON\]/g, JSON.stringify(d, null, 2))
          .replace(/\[PERPLEXITY_DATA\]/g, extras.perplexity_data ? JSON.stringify(extras.perplexity_data, null, 2) : '(not yet available)')
          .replace(/\[GEMINI_DATA\]/g, extras.gemini_data ? JSON.stringify(extras.gemini_data, null, 2) : '(not yet available)')
          .replace(/\[REGISTRY_DATA\]/g, extras.registry_data ? JSON.stringify(extras.registry_data, null, 2) : '(not yet available)');

        try {
          const stepKey = await getKey(promptRecord.ai_platform);
          const stepResult = await callProvider(promptRecord.ai_platform, stepKey, stepPrompt);
          sectionOutputs[section] = stepResult.text;
          if (section === 'market_research') extras.perplexity_data = stepResult.text;
          if (section === 'neighborhood_snapshot') extras.gemini_data = stepResult.text;
          await base44.asServiceRole.entities.Analysis.update(analysisId, {
            sections_completed: Object.keys(sectionOutputs).length,
            ensemble_section_outputs: { ...sectionOutputs },
          });
        } catch (e) {
          console.warn(`[pipeline] step ${section} failed:`, e.message);
          sectionOutputs[section] = `[Section unavailable: ${e.message}]`;
        }
      }

      const finalOutput = sectionOutputs['report_assembly']
        || sectionOutputs['narrative_layer']
        || Object.values(sectionOutputs).join('\n\n---\n\n');

      const generationTime = Date.now() - startTime;

      await base44.asServiceRole.entities.Analysis.update(analysisId, {
        status: 'complete',
        output_text: finalOutput,
        completed_at: new Date().toISOString(),
        ai_model: `pipeline-${tier}`,
        assembly_status: 'complete',
        sections_completed: Object.keys(sectionOutputs).length,
        ensemble_mode_used: true,
        generation_time_ms: generationTime,
      });

      try {
        await base44.functions.invoke('deductAnalysisQuota', { analysisId, orgId: analysis.org_id });
      } catch (e) {
        console.warn('[generateAnalysis] quota deduction failed:', e.message);
      }

      return Response.json({
        output: finalOutput,
        model: `pipeline-${tier}`,
        keySource: 'platform',
        sectionsCompleted: Object.keys(sectionOutputs).length,
        generationTimeMs: generationTime,
      });
    }

    // ── STARTER / FALLBACK: Single-model path ────────────────────────────────
    let result;
    const platform = analysis.ai_platform;
    if (platform === "claude") {
      result = await callClaude(apiKey, prompt, keySource);
    } else if (platform === "chatgpt") {
      result = await callOpenAI(apiKey, prompt);
    } else if (platform === "gemini") {
      result = await callGemini(apiKey, prompt);
    } else if (platform === "perplexity") {
      result = await callPerplexity(apiKey, prompt);
    } else {
      result = await callClaude(apiKey, prompt, keySource);
    }

    // Truncation check
    const lastChar = result.text.trim().slice(-1);
    const looksComplete = lastChar === '}' || lastChar === '"';
    if (!looksComplete) {
      console.warn('[generateAnalysis] WARNING: response may be truncated. Last char:', JSON.stringify(lastChar), '| length:', result.text.length);
    }

    // Extract structured JSON from AI response
    const { cleanText, outputJson } = extractJsonOutput(result.text);
    console.log('[generateAnalysis] output_json populated:', !!outputJson, '| response length:', result.text.length);

    // Persist output
    const saveData = {
      status: "complete",
      output_text: cleanText,
      completed_at: new Date().toISOString(),
      ai_model: result.model,
    };
    if (outputJson) saveData.output_json = outputJson;
    await base44.asServiceRole.entities.Analysis.update(analysisId, saveData);

    // Deduct quota (best-effort)
    try {
      await base44.functions.invoke("deductAnalysisQuota", { analysisId, orgId: analysis.org_id });
    } catch (e) {
      console.warn("[generateAnalysis] quota deduction failed:", e.message);
    }

    return Response.json({ output: cleanText, outputJson: !!outputJson, model: result.model, keySource });

  } catch (error) {
    console.error("[generateAnalysis] error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});