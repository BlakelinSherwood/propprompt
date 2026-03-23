import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const PLATFORM_KEY_FIELDS = {
  claude:     "anthropic_api_key",
  chatgpt:    "openai_api_key",
  gemini:     "google_api_key",
  perplexity: "perplexity_api_key",
  grok:       "grok_api_key",
  groq:       "groq_api_key",
};

function getApiKey(config, provider) {
  const field = PLATFORM_KEY_FIELDS[provider];
  return field ? config[field] : null;
}

async function callProvider(provider, model, apiKey, sectionPrompt) {
  const TIMEOUT = 15000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  const signal = controller.signal;

  try {
    let url, headers, body;

    if (provider === "claude") {
      url = "https://api.anthropic.com/v1/messages";
      headers = {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      };
      body = JSON.stringify({
        model: model || "claude-opus-4-5",
        max_tokens: 4096,
        messages: [{ role: "user", content: sectionPrompt }],
        system: "You are PropPrompt™, an elite real estate AI analyst serving New England brokerages. Provide thorough, data-driven analysis with professional narrative quality. Use markdown formatting.",
      });

    } else if (provider === "chatgpt") {
      url = "https://api.openai.com/v1/chat/completions";
      headers = { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" };
      body = JSON.stringify({
        model: model || "gpt-4o",
        max_tokens: 4096,
        messages: [
          { role: "system", content: "You are PropPrompt™, an elite real estate AI analyst serving New England brokerages. Provide thorough, data-driven analysis with professional narrative quality. Use markdown formatting." },
          { role: "user", content: sectionPrompt },
        ],
      });

    } else if (provider === "groq") {
      url = "https://api.groq.com/openai/v1/chat/completions";
      headers = { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" };
      body = JSON.stringify({
        model: model || "llama-3.3-70b-versatile",
        max_tokens: 4096,
        messages: [
          { role: "system", content: "You are PropPrompt™, an elite real estate AI analyst." },
          { role: "user", content: sectionPrompt },
        ],
      });

    } else if (provider === "gemini") {
      url = `https://generativelanguage.googleapis.com/v1beta/models/${model || "gemini-2.0-flash"}:generateContent?key=${apiKey}`;
      headers = { "Content-Type": "application/json" };
      body = JSON.stringify({
        contents: [{ parts: [{ text: sectionPrompt }] }],
        generationConfig: { maxOutputTokens: 4096 },
        systemInstruction: { parts: [{ text: "You are PropPrompt™, an elite real estate AI analyst serving New England brokerages." }] },
      });

    } else if (provider === "perplexity") {
      url = "https://api.perplexity.ai/chat/completions";
      headers = { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" };
      body = JSON.stringify({
        model: model || "sonar-pro",
        max_tokens: 4096,
        messages: [
          { role: "system", content: "You are PropPrompt™, an elite real estate AI analyst." },
          { role: "user", content: sectionPrompt },
        ],
      });

    } else if (provider === "grok") {
      url = "https://api.x.ai/v1/chat/completions";
      headers = { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" };
      body = JSON.stringify({
        model: model || "grok-3",
        max_tokens: 4096,
        messages: [
          { role: "system", content: "You are PropPrompt™, an elite real estate AI analyst serving New England brokerages. Leverage real-time knowledge for sharp, current analysis." },
          { role: "user", content: sectionPrompt },
        ],
        temperature: 0.35,
      });

    } else {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    const res = await fetch(url, { method: "POST", headers, body, signal });
    clearTimeout(timer);

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errText.slice(0, 300)}`);
    }

    const data = await res.json();

    if (provider === "claude") {
      return data.content?.[0]?.text || "";
    } else if (provider === "gemini") {
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } else {
      return data.choices?.[0]?.message?.content || "";
    }

  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { analysisId, sectionKey, sectionPrompt, provider, model, fallbackProvider, fallbackModel } = await req.json();

    if (!sectionKey || !sectionPrompt || !provider) {
      return Response.json({ error: "sectionKey, sectionPrompt, and provider are required" }, { status: 400 });
    }

    // Load PlatformConfig for API keys
    const configs = await base44.asServiceRole.entities.PlatformConfig.filter({});
    const config = configs[0] || {};

    let output = "";
    let usedProvider = provider;
    let usedModel = model;
    let wasFallback = false;

    // Attempt 1: Primary provider
    const primaryKey = getApiKey(config, provider);
    if (primaryKey) {
      try {
        output = await callProvider(provider, model, primaryKey, sectionPrompt);
      } catch (err) {
        console.warn(`runEnsembleSection [${sectionKey}] primary provider ${provider} failed:`, err.message);
        output = "";
      }
    } else {
      console.warn(`runEnsembleSection [${sectionKey}] no API key for primary provider ${provider}`);
    }

    // Attempt 2: Fallback provider
    if (!output && fallbackProvider && fallbackProvider !== provider) {
      const fallbackKey = getApiKey(config, fallbackProvider);
      if (fallbackKey) {
        try {
          output = await callProvider(fallbackProvider, fallbackModel, fallbackKey, sectionPrompt);
          if (output) {
            usedProvider = fallbackProvider;
            usedModel = fallbackModel;
            wasFallback = true;
          }
        } catch (err) {
          console.warn(`runEnsembleSection [${sectionKey}] fallback provider ${fallbackProvider} failed:`, err.message);
          output = "";
        }
      }
    }

    // Attempt 3: Claude safety net
    if (!output && usedProvider !== "claude" && fallbackProvider !== "claude") {
      const claudeKey = getApiKey(config, "claude");
      if (claudeKey) {
        try {
          output = await callProvider("claude", config.anthropic_model || "claude-opus-4-5", claudeKey, sectionPrompt);
          if (output) {
            usedProvider = "claude";
            usedModel = config.anthropic_model || "claude-opus-4-5";
            wasFallback = true;
          }
        } catch (err) {
          console.error(`runEnsembleSection [${sectionKey}] Claude safety net also failed:`, err.message);
        }
      }
    }

    if (!output) {
      return Response.json({ error: `All providers failed for section: ${sectionKey}` }, { status: 502 });
    }

    return Response.json({
      sectionKey,
      output,
      provider: usedProvider,
      model: usedModel,
      wasFallback,
    });

  } catch (err) {
    console.error("runEnsembleSection fatal:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});