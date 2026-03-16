import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// AES-256-GCM decrypt (iv:ciphertext base64 format)
async function decryptKey(encrypted, keyStr) {
  const [ivB64, cipherB64] = encrypted.split(':');
  if (!ivB64 || !cipherB64) return encrypted;
  const fromB64 = (s) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(keyStr.padEnd(32, '0').slice(0, 32)),
    { name: 'AES-GCM' }, false, ['decrypt']
  );
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(ivB64) }, keyMaterial, fromB64(cipherB64)
  );
  return new TextDecoder().decode(plain);
}

// S&C platform env var per platform
const SC_ENV_KEYS = {
  claude:      'ANTHROPIC_API_KEY',
  chatgpt:     'OPENAI_API_KEY',
  gemini:      'GEMINI_API_KEY',
  perplexity:  'PERPLEXITY_API_KEY',
  grok:        'XAI_API_KEY',
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { orgId, platform } = await req.json();
    if (!orgId || !platform) return Response.json({ error: 'orgId and platform required' }, { status: 400 });

    const encKey = Deno.env.get('ENCRYPTION_KEY') || '';

    // --- 1. Agent's own personal key ---
    const agentKeys = await base44.asServiceRole.entities.AiApiKey.filter({
      user_email: user.email,
      ai_platform: platform,
      is_active: true,
    });
    if (agentKeys[0]?.encrypted_key) {
      const apiKey = await decryptKey(agentKeys[0].encrypted_key, encKey);
      console.log(`[resolveApiKey] Using agent personal key for ${platform}`);
      return Response.json({ apiKey, source: 'agent_managed', keyId: agentKeys[0].id });
    }

    // --- 2. Team/org-level key (from Organization.org_ai_api_keys) ---
    const orgs = await base44.asServiceRole.entities.Organization.filter({ id: orgId });
    const org = orgs[0];
    if (org?.org_ai_api_keys?.[platform]) {
      const apiKey = await decryptKey(org.org_ai_api_keys[platform], encKey);
      console.log(`[resolveApiKey] Using org-managed key for ${platform}, org=${orgId}`);
      return Response.json({ apiKey, source: 'org_managed' });
    }

    // --- 3. Parent brokerage key ---
    if (org?.parent_org_id) {
      const parentOrgs = await base44.asServiceRole.entities.Organization.filter({ id: org.parent_org_id });
      const parentOrg = parentOrgs[0];
      if (parentOrg?.org_ai_api_keys?.[platform]) {
        const apiKey = await decryptKey(parentOrg.org_ai_api_keys[platform], encKey);
        console.log(`[resolveApiKey] Using brokerage-managed key for ${platform}, parent=${org.parent_org_id}`);
        return Response.json({ apiKey, source: 'brokerage_managed' });
      }
    }

    // --- 4. S&C platform key ---
    const envVarName = SC_ENV_KEYS[platform];
    const scKey = envVarName ? Deno.env.get(envVarName) : null;
    if (scKey) {
      console.log(`[resolveApiKey] Using S&C platform key for ${platform}`);
      return Response.json({ apiKey: scKey, source: 'sc_managed' });
    }

    console.error(`[resolveApiKey] No API key found for platform=${platform}, orgId=${orgId}`);
    return Response.json({ error: `No API key configured for ${platform}` }, { status: 404 });
  } catch (error) {
    console.error('[resolveApiKey] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});