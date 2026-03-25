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
    rental_analysis: {
      base: [],
    },
    client_portfolio: {
      base: ['tiered_comps', 'portfolio_options', 'adu_option', 'location_priority_characteristics', 'rate_environment'],
    },
    custom: {
      base: analysis.selected_modules || [],
    },
  };
  
  const config = matrix[assessmentType] || { base: [] };
  const sections = new Set([...config.base]);
  
  if (analysis.include_migration && config.migration_opt) {
    config.migration_opt.forEach(s => sections.add(s));
  }
  if (analysis.include_archetypes && config.archetype_opt) {
    config.archetype_opt.forEach(s => sections.add(s));
  }
  
  return sections;
}

// Extract structured JSON from AI response and separate from narrative text
function extractJsonOutput(text) {
  const START = '---BEGIN_JSON_OUTPUT---';
  const END = '---END_JSON_OUTPUT---';
  const startIdx = text.indexOf(START);
  const endIdx = text.indexOf(END);
  if (startIdx === -1 || endIdx === -1) return { cleanText: text, outputJson: null };
  const jsonStr = text.slice(startIdx + START.length, endIdx).trim();
  const cleanText = (text.slice(0, startIdx) + text.slice(endIdx + END.length)).trim();
  try {
    return { cleanText, outputJson: JSON.parse(jsonStr) };
  } catch (e) {
    console.warn('[extractJsonOutput] JSON parse failed:', e.message, '| snippet:', jsonStr.slice(0, 200));
    return { cleanText: text, outputJson: null };
  }
}

// Expanded analysis instructions (inlined to avoid import path issues in Deno)
function getExpandedSystemPrompt(todayString, requiredSections) {
  const ANALYSIS_SYSTEM_PROMPT = `
────────────────────────────────────────────────────────────────
EXPANDED ANALYSIS INSTRUCTIONS — ALL ANALYSIS TYPES
────────────────────────────────────────────────────────────────

OUTPUT STRUCTURE:

All analyses produce TWO outputs simultaneously:
1. output_text: Narrative markdown report (existing behavior)
2. output_json: Structured JSON with analysis data (new, detailed below)

The JSON output feeds directly into templates for rendering tables, 
grids, and data-driven visualizations. The narrative is fallback.

────────────────────────────────────────────────────────────────
FOR MIGRATION ANALYSIS (Listing Pricing, Buyer Intelligence, CMA)
────────────────────────────────────────────────────────────────

EXPANDED MIGRATION ANALYSIS INSTRUCTIONS:

1. GEOGRAPHIC ORIGIN: Identify 5-8 feeder markets based on location class, property type, and price point. Use general knowledge of regional migration patterns.

2. MIGRATION SCORING: Assign each market a score (1-10) based on: volume (40%), price differential (30%), lifestyle/commute (20%), growth trend (10%).

3. PUSH/PULL FRAMEWORK: Identify push factors (why they leave) and pull factors (why they target this submarket). Must be economic, lifestyle, or geographic — never demographic.

4. PRICE PSYCHOLOGY: Categorize as stretching_up, cashing_out_equity, lateral_move, or downsizing_into_quality.

5. EMPLOYER TARGETING: Generate 6-14 employer targets with company name, relevance, priority, target roles, commute time, office location. Source from general knowledge — never fabricate specific hiring data. NEVER reference employee demographics.

6. MARKETING CHANNELS: Recommend 4-6 channels with specific targeting rationale tied to feeder markets.

LOCATION-TYPE MIGRATION TEMPLATES:

URBAN: Same neighborhood (upgrade), adjacent neighborhoods (lateral), suburban downsizers, out-of-state relocations, renter-to-buyer
SUBURBAN: Urban core families, adjacent suburbs, same-town move-ups, corporate transfers, remote workers
COASTAL/HISTORIC: Inner suburbs (lifestyle change), urban core (second home), same-town moves, lifestyle buyers, retirees
RURAL: Closer suburbs (priced out), same-region move-ups, remote workers, retirees, agricultural/lifestyle buyers

────────────────────────────────────────────────────────────────
FOR ARCHETYPE GENERATION (All Analysis Types)
────────────────────────────────────────────────────────────────

EXPANDED ARCHETYPE GENERATION INSTRUCTIONS:

1. Generate 6-10 buyer archetypes per analysis with full JSON schema.

2. ARCHETYPE NAMING: Use lifestyle and financial descriptors only. Good: Remote-Flex Professional, Move-Up Family, Downsizing Empty Nester. Bad: Any protected class references.

3. DEEP PROFILE: 3-4 sentences on who they are, why property fits, must-haves, concerns. Lifestyle/financial framing only.

4. LANGUAGE CALIBRATION: 3-5 phrases to AVOID and 3-5 phrases to USE. These feed into listing remarks and marketing copy.

5. ATTRIBUTE RESONANCE: Score each archetype (0-3) against property attributes. 3=Decisive, 2=Important, 1=Noted, 0=Not relevant.

6. PROPERTY-TYPE REQUIREMENTS:
   Multi-family: Local Value-Add Investor, 1031 Exchange Buyer, Owner-Occupant House Hacker, Passive/Remote Investor
   Condo: Urban Downsizer, Young Professional First-Time, Pied-à-Terre Buyer, Investor/Rental Buyer
   Single-family: At least 2 family + 2 non-family archetypes

7. PERCENTAGE: estimated_pool_pct must sum to ~100% (95-105% acceptable).

────────────────────────────────────────────────────────────────
FOR TIERED COMP ANALYSIS (Listing Pricing, CMA, Client Portfolio)
────────────────────────────────────────────────────────────────

TIERED COMP INSTRUCTIONS:

1. THREE TIERS:
   TIER A (Direct): Same street/subdivision/closest match. 3-6 comps, 12 months preferred. Weight: PRIMARY
   TIER B (Nearby): Same town, ±20% size, ±15 years age. 3-6 comps. Weight: SECONDARY
   TIER C (Context): Different part of town/new construction. 3-6 comps. Weight: REFERENCE_ONLY

2. TOTAL: 12-18 across all tiers. If <12, set thin_comp_flag=true.

3. TIME ADJUSTMENT: Comps >12 months old must be adjusted. Use local appreciation rate. Cap: 5 years max.

4. CONDO: Within-building sales as sub-tier of Tier A. Set within_building=true.

5. MULTI-FAMILY: Include both sale price AND income comps (cap rate/GRM).

6. CONDITION: Assess vs. subject as Superior/Similar/Inferior with key differences.

7. IMPLIED VALUE: Tier A adjusted PPSF range × subject SF.

────────────────────────────────────────────────────────────────
FOR CLIENT PORTFOLIO ANALYSIS ONLY
────────────────────────────────────────────────────────────────

PORTFOLIO OPTIONS GENERATION:

Generate ALL SEVEN OPTIONS (A-G) + conditional ADU for every Client Portfolio Analysis.

CRITICAL:
1. NOT a listing presentation. Never recommend selling.
2. Never use: "you should list", "now is the time to sell". Frame as: "if you were to sell today..."
3. All financial figures carry labels: [REGISTRY-CONFIRMED], [ESTIMATED], [CLIENT-PROVIDED], [AVM-RETRIEVED {date}]
4. Mortgage balance: Estimate from public records if not provided. Label as estimated.
5. Rates: Use current Freddie Mac PMMS data for 30-yr fixed. If unavailable, note date.
6. ADU TRIGGER: Single-family, ≥5,000 SF, no zoning disqualifiers. If false, explain why.
7. Value-Add: Use Remodeling Magazine Cost vs. Value benchmarks. If unavailable, use national averages.

OPTIONS A & B: Hold vs. Refinance comparison
OPTION C: HELOC (bridge to D & G)
OPTION D: Value-Add (6-8 improvements with ROI)
OPTIONS E & F: Move-Up (shows rate shock) & Right-Size (shows equity freed)
OPTION G: Leverage for 2nd property (investment + second home)

TONE: Warm, honest, data-grounded, forward-looking.

────────────────────────────────────────────────────────────────
FAIR HOUSING COMPLIANCE — APPLIES TO ALL OUTPUTS
────────────────────────────────────────────────────────────────

NEVER reference or imply targeting/avoiding protected classes:
Federal: race, color, national origin, religion, sex, familial status, disability
State (ME, NH, VT, MA): age, sexual orientation, gender identity, marital status, source of income, ancestry, veteran status

ARCHETYPES: Define by life stage, property use, financial profile, lifestyle preference, migration motivation ONLY.
NEVER: Protected characteristics or demographic makeup.

MIGRATION DATA: Reference geography and economic motivation only.
NEVER: Ethnic/cultural/religious composition of feeder markets.

If output could constitute steering, blockbusting, or redlining, flag it.
Set compliance_flagged = true on analysis record.

Property descriptions: Target features and amenities only (SF, finishes, outdoor space, home office potential).
Focus on lifestyle fit without implying buyer demographic.
Never steer toward/away from protected classes.
`;

  let filtered = ANALYSIS_SYSTEM_PROMPT;
  if (!requiredSections || !requiredSections.has('migration_analysis')) {
    filtered = filtered.replace(/FOR MIGRATION ANALYSIS \(Listing Pricing.*?(?=FOR ARCHETYPE|FOR TIERED|FOR CLIENT|FAIR HOUSING)/s, '');
  }
  if (!requiredSections || !requiredSections.has('buyer_archetype')) {
    filtered = filtered.replace(/FOR ARCHETYPE GENERATION \(All.*?(?=FOR TIERED|FOR CLIENT|FAIR HOUSING)/s, '');
  }
  if (!requiredSections || !requiredSections.has('portfolio_options')) {
    filtered = filtered.replace(/FOR CLIENT PORTFOLIO ANALYSIS ONLY.*?(?=FAIR HOUSING)/s, '');
  }
  if (!requiredSections || !requiredSections.has('tiered_comps')) {
    filtered = filtered.replace(/FOR TIERED COMP ANALYSIS \(Listing Pricing.*?(?=FOR CLIENT|FAIR HOUSING)/s, '');
  }

  return `You are PropPrompt™, an elite real estate AI analyst serving New England brokerages. Today's date is ${todayString}. All market analysis, pricing, and trends reflect current conditions as of this date. Write your full narrative analysis in markdown. After completing all narrative sections, append the structured JSON block exactly as specified in the JSON OUTPUT section above.

${filtered}`;
}

const ANTHROPIC_MODELS = {
  default: "claude-opus-4-5",
  agent:   "claude-3-5-sonnet-20241022",
};

async function callClaudeOnce(apiKey, prompt, keySource, requiredSections) {
  const model = keySource === "agent" ? ANTHROPIC_MODELS.agent : ANTHROPIC_MODELS.default;
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const systemPrompt = getExpandedSystemPrompt(today, requiredSections);
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 8000,
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

async function callClaude(apiKey, prompt, keySource, requiredSections) {
  const maxRetries = 3;
  const delayMs = [3000, 8000, 15000];
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await callClaudeOnce(apiKey, prompt, keySource, requiredSections);
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
      max_tokens: 4096,
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
      generationConfig: { maxOutputTokens: 4096 },
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
      max_tokens: 4096,
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

    // If already complete, return stored output
    if (analysis.status === "complete" && analysis.output_text) {
      return Response.json({ output: analysis.output_text, model: analysis.ai_model, keySource: "cached" });
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
    const prompt = promptRes.data?.prompt || `You are a PropPrompt™ real estate AI. Analyze this property: ${JSON.stringify(analysis.intake_data)}`;

    // Mark as in_progress
    await base44.asServiceRole.entities.Analysis.update(analysisId, { status: "in_progress" });

    // ── Resolve required sections based on analysis type ────────────────────────
    const requiredSections = getRequiredSections(analysis.assessment_type, analysis);
    console.log('[generateAnalysis] required sections:', Array.from(requiredSections));
    
    // ── TIER-BASED ROUTING ────────────────────────────────────────────────────
    const configs = await base44.asServiceRole.entities.PlatformConfig.filter({});
    const config = configs[0] || {};

    // Resolve user tier from TerritorySubscription or Org
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
      // ── PRO/TEAM/BROKER: PromptLibrary ensemble pipeline ──────────────────
      console.log(`[generateAnalysis] Running ${tier} pipeline with ${pipelinePrompts.length} steps`);
      const startTime = Date.now();

      // Helper: resolve API key for a platform
      const getKey = async (platform) => {
        const r = await base44.functions.invoke('resolveApiKey', {
          platform,
          orgId: analysis.org_id,
          agentEmail: analysis.run_by_email,
        });
        return r.data?.apiKey || null;
      };

      // Helper: call the right provider
      const callProvider = async (platform, apiKey, prompt) => {
        if (!apiKey) throw new Error(`No API key for ${platform}`);
        if (platform === 'claude') return callClaude(apiKey, prompt, 'platform');
        if (platform === 'chatgpt') return callOpenAI(apiKey, prompt);
        if (platform === 'gemini') return callGemini(apiKey, prompt);
        if (platform === 'perplexity') return callPerplexity(apiKey, prompt);
        return callClaude(apiKey, prompt, 'platform'); // fallback
      };

      // Token extras accumulate as pipeline runs
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

        // Substitute tokens into this step's prompt (including outputs from prior steps)
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

          // Store outputs into extras for downstream token substitution
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
    // Call the appropriate AI provider
    let result;
    const platform = analysis.ai_platform;
    if (platform === "claude") {
      result = await callClaude(apiKey, prompt, keySource, requiredSections);
    } else if (platform === "chatgpt") {
      result = await callOpenAI(apiKey, prompt);
    } else if (platform === "gemini") {
      result = await callGemini(apiKey, prompt);
    } else if (platform === "perplexity") {
      result = await callPerplexity(apiKey, prompt);
    } else {
      result = await callClaude(apiKey, prompt, keySource);
    }

    // Extract structured JSON from AI response
    const { cleanText, outputJson } = extractJsonOutput(result.text);
    console.log('[generateAnalysis] output_json populated:', !!outputJson);

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