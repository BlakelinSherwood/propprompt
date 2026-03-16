import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Decrypt AES-256-CBC
async function decryptText(encryptedB64, keyHex) {
  const encoder = new TextEncoder();
  const keyBytes = encoder.encode(keyHex.padEnd(32).slice(0, 32));
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyBytes, { name: 'AES-CBC' }, false, ['decrypt']
  );
  const combined = Uint8Array.from(atob(encryptedB64), c => c.charCodeAt(0));
  const iv = combined.slice(0, 16);
  const data = combined.slice(16);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, cryptoKey, data);
  return new TextDecoder().decode(decrypted);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { orgId, platform, userEmail } = await req.json();
    if (!platform) return Response.json({ error: 'platform required' }, { status: 400 });

    const encKey = Deno.env.get('ENCRYPTION_KEY');

    // WATERFALL LEVEL 1: Check user's own key first
    if (userEmail) {
      const userKeys = await base44.asServiceRole.entities.AiApiKey.filter({
        user_email: userEmail,
        ai_platform: platform,
        is_active: true
      });
      if (userKeys.length > 0 && userKeys[0].encrypted_key) {
        const plainKey = await decryptText(userKeys[0].encrypted_key, encKey);
        return Response.json({ apiKey: plainKey, source: 'user_managed', keyId: userKeys[0].id });
      }
    }

    // WATERFALL LEVEL 2: Check org-level key (team or brokerage)
    if (orgId) {
      // Load org to find parent
      const orgs = await base44.asServiceRole.entities.Organization.filter({ id: orgId });
      const org = orgs[0];

      // Check team org key
      const teamKeys = await base44.asServiceRole.entities.AiApiKey.filter({
        org_id: orgId,
        ai_platform: platform,
        is_active: true
      });
      if (teamKeys.length > 0 && teamKeys[0].encrypted_key) {
        const plainKey = await decryptText(teamKeys[0].encrypted_key, encKey);
        return Response.json({ apiKey: plainKey, source: 'org_managed', keyId: teamKeys[0].id });
      }

      // Check parent brokerage key
      if (org?.parent_org_id) {
        const brokerageKeys = await base44.asServiceRole.entities.AiApiKey.filter({
          org_id: org.parent_org_id,
          ai_platform: platform,
          is_active: true
        });
        if (brokerageKeys.length > 0 && brokerageKeys[0].encrypted_key) {
          const plainKey = await decryptText(brokerageKeys[0].encrypted_key, encKey);
          return Response.json({ apiKey: plainKey, source: 'org_managed', keyId: brokerageKeys[0].id });
        }
      }
    }

    // WATERFALL LEVEL 3: S&C platform key (Anthropic only for Claude)
    if (platform === 'claude') {
      const scKey = Deno.env.get('ANTHROPIC_API_KEY');
      if (scKey) {
        return Response.json({ apiKey: scKey, source: 'sc_managed' });
      }
    }

    return Response.json({ error: 'No API key found for this platform', source: null }, { status: 404 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});