/**
 * resolveApiKey — API key resolution waterfall per Section 5.3:
 * 1. Agent's own key (AiApiKey entity, is_active=true)
 * 2. Team org key (org.org_ai_api_keys)
 * 3. Parent brokerage org key (parentOrg.org_ai_api_keys)
 * 4. S&C platform env var
 *
 * Returns: { apiKey: string, source: "agent"|"team"|"brokerage"|"sc_platform" }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

async function getDecryptKey() {
  const raw = Deno.env.get("ENCRYPTION_KEY") || "default-key-32-bytes-padded-here!!";
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(raw.slice(0, 32).padEnd(32, "0")),
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );
}

async function decryptKey(encrypted) {
  if (!encrypted) return null;
  const key = await getDecryptKey();
  const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(plain);
}

// Map platform name to env var for S&C platform keys
const PLATFORM_ENV_VARS = {
  claude:      "ANTHROPIC_API_KEY",
  chatgpt:     "OPENAI_API_KEY",
  gemini:      "GEMINI_API_KEY",
  perplexity:  "PERPLEXITY_API_KEY",
  grok:        "GROK_API_KEY",
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { platform, orgId, agentEmail } = await req.json();

    if (!platform) return Response.json({ error: "platform required" }, { status: 400 });

    // 1. Agent's own key
    if (agentEmail) {
      const agentKeys = await base44.asServiceRole.entities.AiApiKey.filter({
        user_email: agentEmail,
        ai_platform: platform,
        is_active: true,
      });
      if (agentKeys.length > 0 && agentKeys[0].encrypted_key) {
        const decrypted = await decryptKey(agentKeys[0].encrypted_key);
        if (decrypted) {
          // Update last_used_at
          await base44.asServiceRole.entities.AiApiKey.update(agentKeys[0].id, {
            last_used_at: new Date().toISOString(),
          });
          return Response.json({ apiKey: decrypted, source: "agent" });
        }
      }
    }

    // 2. Team org key
    if (orgId) {
      const orgs = await base44.asServiceRole.entities.Organization.filter({ id: orgId });
      const org = orgs[0];
      if (org?.org_ai_api_keys?.[platform]) {
        const decrypted = await decryptKey(org.org_ai_api_keys[platform]);
        if (decrypted) return Response.json({ apiKey: decrypted, source: "team" });
      }

      // 3. Parent brokerage key
      if (org?.parent_org_id) {
        const parentOrgs = await base44.asServiceRole.entities.Organization.filter({ id: org.parent_org_id });
        const parent = parentOrgs[0];
        if (parent?.org_ai_api_keys?.[platform]) {
          const decrypted = await decryptKey(parent.org_ai_api_keys[platform]);
          if (decrypted) return Response.json({ apiKey: decrypted, source: "brokerage" });
        }
      }
    }

    // 4. S&C platform key
    const envKey = PLATFORM_ENV_VARS[platform];
    const scKey = envKey ? Deno.env.get(envKey) : null;
    if (scKey) return Response.json({ apiKey: scKey, source: "sc_platform" });

    return Response.json({ error: `No API key found for platform: ${platform}` }, { status: 404 });

  } catch (error) {
    console.error("resolveApiKey error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});