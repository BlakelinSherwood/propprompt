/**
 * generateAnalysis — Non-streaming analysis generator.
 * Resolves API key → assembles prompt → calls Claude/OpenAI/Gemini → saves & returns output.
 * Used by AnalysisRun page via SDK invoke (avoids SSE auth issues).
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const ANTHROPIC_MODELS = {
  default: "claude-opus-4-5",
  agent:   "claude-3-5-sonnet-20241022",
};

async function callClaudeOnce(apiKey, prompt, keySource) {
  const model = keySource === "agent" ? ANTHROPIC_MODELS.agent : ANTHROPIC_MODELS.default;
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
      system: `You are PropPrompt™, an elite real estate AI analyst serving New England brokerages. Today's date is ${today}. All market analysis, pricing, and trends should reflect current conditions as of this date. Provide thorough, data-driven analysis with professional narrative quality. Use markdown formatting.`,
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
        { role: "system", content: `You are PropPrompt™, an elite real estate AI analyst serving New England brokerages. Today's date is ${today}. All market analysis, pricing, and trends should reflect current conditions as of this date. Provide thorough, data-driven analysis with professional narrative quality. Use markdown formatting.` },
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
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 4096 },
      systemInstruction: { parts: [{ text: `You are PropPrompt™, an elite real estate AI analyst serving New England brokerages. Today's date is ${today}. All market analysis, pricing, and trends should reflect current conditions as of this date. Provide thorough, data-driven analysis with professional narrative quality. Use markdown formatting.` }] },
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
        { role: "system", content: `You are PropPrompt™, a real estate market research AI. Today's date is ${today}. Provide current, data-rich market research grounded in real conditions.` },
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

    // Persist output
    await base44.asServiceRole.entities.Analysis.update(analysisId, {
      status: "complete",
      output_text: result.text,
      completed_at: new Date().toISOString(),
      ai_model: result.model,
    });

    // Deduct quota (best-effort)
    try {
      await base44.functions.invoke("deductAnalysisQuota", { analysisId, orgId: analysis.org_id });
    } catch (e) {
      console.warn("[generateAnalysis] quota deduction failed:", e.message);
    }

    return Response.json({ output: result.text, model: result.model, keySource });

  } catch (error) {
    console.error("[generateAnalysis] error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});