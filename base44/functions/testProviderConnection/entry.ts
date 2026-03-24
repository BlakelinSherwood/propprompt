import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const PLATFORM_CONFIG_KEYS = {
  claude:     { keyField: "anthropic_api_key",  enabledField: "claude_enabled" },
  chatgpt:    { keyField: "openai_api_key",     enabledField: "chatgpt_enabled" },
  gemini:     { keyField: "google_api_key",     enabledField: "gemini_enabled" },
  perplexity: { keyField: "perplexity_api_key", enabledField: "perplexity_enabled" },
  grok:       { keyField: "grok_api_key",       enabledField: "grok_enabled" },
  groq:       { keyField: "groq_api_key",       enabledField: "groq_enabled" },
};

const PING_FIELD_MAP = {
  claude:     { ping: "anthropic_last_ping",   pingAt: "anthropic_last_ping_at" },
  chatgpt:    { ping: "openai_last_ping",      pingAt: "openai_last_ping_at" },
  gemini:     { ping: "gemini_last_ping",      pingAt: "gemini_last_ping_at" },
  perplexity: { ping: "perplexity_last_ping",  pingAt: "perplexity_last_ping_at" },
  grok:       { ping: "grok_last_ping",        pingAt: "grok_last_ping_at" },
  groq:       { ping: "groq_last_ping",        pingAt: "groq_last_ping_at" },
};

async function callProvider(platform, apiKey, config) {
  const prompt = "Reply with the word OK only";
  const timeout = 10000;

  let url, headers, body;

  if (platform === "claude") {
    url = "https://api.anthropic.com/v1/messages";
    headers = {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    };
    body = JSON.stringify({
      model: config.anthropic_model || "claude-opus-4-5",
      max_tokens: 10,
      messages: [{ role: "user", content: prompt }],
    });

  } else if (platform === "chatgpt") {
    url = "https://api.openai.com/v1/chat/completions";
    headers = { "Authorization": `Bearer ${apiKey}`, "content-type": "application/json" };
    body = JSON.stringify({
      model: config.openai_model || "gpt-4o",
      max_tokens: 10,
      messages: [{ role: "user", content: prompt }],
    });

  } else if (platform === "groq") {
    url = "https://api.groq.com/openai/v1/chat/completions";
    headers = { "Authorization": `Bearer ${apiKey}`, "content-type": "application/json" };
    body = JSON.stringify({
      model: config.groq_model || "llama-3.3-70b-versatile",
      max_tokens: 10,
      messages: [{ role: "user", content: prompt }],
    });

  } else if (platform === "gemini") {
    const model = config.gemini_model || "gemini-2.0-flash";
    url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    headers = { "content-type": "application/json" };
    body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 10 },
    });

  } else if (platform === "perplexity") {
    url = "https://api.perplexity.ai/chat/completions";
    headers = { "Authorization": `Bearer ${apiKey}`, "content-type": "application/json" };
    body = JSON.stringify({
      model: "sonar",
      max_tokens: 10,
      messages: [{ role: "user", content: prompt }],
    });

  } else if (platform === "grok") {
    url = "https://api.x.ai/v1/chat/completions";
    headers = { "Authorization": `Bearer ${apiKey}`, "content-type": "application/json" };
    body = JSON.stringify({
      model: config.grok_model || "grok-3-mini",
      max_tokens: 10,
      messages: [{ role: "user", content: prompt }],
    });

  } else {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, { method: "POST", headers, body, signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || (user.role !== "admin" && user.role !== "platform_owner")) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { platform } = await req.json();
    if (!platform || !PLATFORM_CONFIG_KEYS[platform]) {
      return Response.json({ error: "Invalid platform" }, { status: 400 });
    }

    // Load PlatformConfig
    const configs = await base44.asServiceRole.entities.PlatformConfig.filter({});
    const config = configs[0];
    if (!config) {
      return Response.json({ error: "PlatformConfig not found" }, { status: 404 });
    }

    const mapping = PLATFORM_CONFIG_KEYS[platform];
    const apiKey = config[mapping.keyField];
    if (!apiKey) {
      return Response.json({ success: false, latencyMs: 0, error: `No API key configured for ${platform}` });
    }

    const pingFields = PING_FIELD_MAP[platform];
    const now = new Date().toISOString();
    const start = Date.now();

    let success = false;
    let error = null;

    try {
      await callProvider(platform, apiKey, config);
      success = true;
    } catch (err) {
      error = err.name === "AbortError" ? "Timeout after 10s" : err.message;
      console.error(`testProviderConnection [${platform}] error:`, error);
    }

    const latencyMs = Date.now() - start;

    // Update PlatformConfig ping fields
    await base44.asServiceRole.entities.PlatformConfig.update(config.id, {
      [pingFields.ping]: success ? "success" : "error",
      [pingFields.pingAt]: now,
    });

    return Response.json({ success, latencyMs, ...(error ? { error } : {}) });

  } catch (err) {
    console.error("testProviderConnection fatal:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});