/**
 * resolveApiKey — Platform-only API key resolution:
 * 1. PlatformConfig entity (admin-saved keys from dashboard)
 * 2. Environment variable fallback
 *
 * Returns: { apiKey: string, source: "sc_platform" }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Map platform name to env var for S&C platform keys
const PLATFORM_ENV_VARS = {
  claude:      "ANTHROPIC_API_KEY",
  chatgpt:     "OPENAI_API_KEY",
  gemini:      "GEMINI_API_KEY",
  perplexity:  "PERPLEXITY_API_KEY",
  grok:        "GROK_API_KEY",
  groq:        "GROQ_API_KEY",
};

// Map platform name to PlatformConfig field
const PLATFORM_CONFIG_KEYS = {
  claude:      { keyField: "anthropic_api_key",  enabledField: "claude_enabled" },
  chatgpt:     { keyField: "openai_api_key",     enabledField: "chatgpt_enabled" },
  gemini:      { keyField: "google_api_key",     enabledField: "gemini_enabled" },
  perplexity:  { keyField: "perplexity_api_key", enabledField: "perplexity_enabled" },
  grok:        { keyField: "grok_api_key",       enabledField: "grok_enabled" },
  groq:        { keyField: "groq_api_key",       enabledField: "groq_enabled" },
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { platform } = await req.json();

    if (!platform) return Response.json({ error: "platform required" }, { status: 400 });

    // 1. PlatformConfig entity (admin-saved keys)
    const configMapping = PLATFORM_CONFIG_KEYS[platform];
    if (configMapping) {
      const configs = await base44.asServiceRole.entities.PlatformConfig.filter({});
      const config = configs[0];
      if (config) {
        const isEnabled = config[configMapping.enabledField] !== false;
        const storedKey = config[configMapping.keyField];
        if (isEnabled && storedKey) {
          return Response.json({ apiKey: storedKey, source: "sc_platform" });
        }
      }
    }

    // 5. S&C env var fallback
    const envKey = PLATFORM_ENV_VARS[platform];
    const scKey = envKey ? Deno.env.get(envKey) : null;
    if (scKey) return Response.json({ apiKey: scKey, source: "sc_platform" });

    return Response.json({ error: `No API key found for platform: ${platform}` }, { status: 404 });

  } catch (error) {
    console.error("resolveApiKey error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});