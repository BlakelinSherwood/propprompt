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

async function callClaude(apiKey, prompt, keySource) {
  const model = keySource === "agent" ? ANTHROPIC_MODELS.agent : ANTHROPIC_MODELS.default;
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
      system: "You are PropPrompt™, an elite real estate AI analyst serving New England brokerages. Provide thorough, data-driven analysis with professional narrative quality. Use markdown formatting.",
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Claude API error ${res.status}`);
  }
  const data = await res.json();
  return { text: data.content?.[0]?.text || "", model };
}

async function callOpenAI(apiKey, prompt) {
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
        { role: "system", content: "You are PropPrompt™, an elite real estate AI analyst serving New England brokerages. Provide thorough, data-driven analysis with professional narrative quality. Use markdown formatting." },
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
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 4096 },
      systemInstruction: { parts: [{ text: "You are PropPrompt™, an elite real estate AI analyst serving New England brokerages. Provide thorough, data-driven analysis with professional narrative quality. Use markdown formatting." }] },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gemini API error ${res.status}`);
  }
  const data = await res.json();
  return { text: data.candidates?.[0]?.content?.parts?.[0]?.text || "", model };
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

    // Call the appropriate AI provider
    let result;
    const platform = analysis.ai_platform;
    if (platform === "claude") {
      result = await callClaude(apiKey, prompt, keySource);
    } else if (platform === "chatgpt") {
      result = await callOpenAI(apiKey, prompt);
    } else if (platform === "gemini") {
      result = await callGemini(apiKey, prompt);
    } else {
      // Default to Claude for other platforms (perplexity/grok) — extend as needed
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