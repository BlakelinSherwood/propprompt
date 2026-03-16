import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// AES-256-GCM decrypt
async function decryptKey(encrypted, keyStr) {
  const [ivB64, cipherB64] = encrypted.split(':');
  if (!ivB64 || !cipherB64) return encrypted; // plain text fallback
  const fromB64 = (s) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(keyStr.padEnd(32, '0').slice(0, 32)),
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(ivB64) },
    keyMaterial,
    fromB64(cipherB64)
  );
  return new TextDecoder().decode(decrypted);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { orgId, platform } = await req.json();
    if (!orgId || !platform) return Response.json({ error: 'orgId and platform required' }, { status: 400 });

    const encKey = Deno.env.get('ENCRYPTION_KEY') || '';

    // 1. Check team-level key (user's org)
    const teamKeys = await base44.asServiceRole.entities.AiApiKey.filter({
      user_email: user.email,
      ai_platform: platform,
      is_active: true,
    });
    if (teamKeys.length > 0 && teamKeys[0].encrypted_key) {
      const apiKey = await decryptKey(teamKeys[0].encrypted_key, encKey);
      return Response.json({ apiKey, source: 'user_managed', keyId: teamKeys[0].id });
    }

    // 2. Check parent brokerage — load org to find parent
    const orgs = await base44.asServiceRole.entities.Organization.filter({ id: orgId });
    const org = orgs[0];
    if (org?.parent_org_id) {
      // Find brokerage admin of parent org
      const parentMembers = await base44.asServiceRole.entities.OrgMembership.filter({
        org_id: org.parent_org_id,
        role_in_org: 'brokerage_admin',
        status: 'active',
      });
      for (const member of parentMembers) {
        const brokerageKeys = await base44.asServiceRole.entities.AiApiKey.filter({
          user_email: member.user_email,
          ai_platform: platform,
          is_active: true,
        });
        if (brokerageKeys.length > 0 && brokerageKeys[0].encrypted_key) {
          const apiKey = await decryptKey(brokerageKeys[0].encrypted_key, encKey);
          return Response.json({ apiKey, source: 'org_managed', keyId: brokerageKeys[0].id });
        }
      }
    }

    // 3. Fallback: S&C platform key
    const scKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (scKey) {
      return Response.json({ apiKey: scKey, source: 'sc_managed' });
    }

    return Response.json({ error: 'No API key available for this platform' }, { status: 404 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});