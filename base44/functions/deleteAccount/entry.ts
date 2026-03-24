import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userEmail = user.email;
    console.log(`[deleteAccount] Starting GDPR deletion for: ${userEmail}`);

    // 1. Delete analyses
    const analyses = await base44.asServiceRole.entities.Analysis.filter({ run_by_email: userEmail });
    for (const a of analyses) {
      await base44.asServiceRole.entities.Analysis.delete(a.id);
    }
    console.log(`[deleteAccount] Deleted ${analyses.length} analyses`);

    // 2. Delete org memberships
    const memberships = await base44.asServiceRole.entities.OrgMembership.filter({ user_email: userEmail });
    for (const m of memberships) {
      await base44.asServiceRole.entities.OrgMembership.delete(m.id);
    }
    console.log(`[deleteAccount] Deleted ${memberships.length} memberships`);

    // 3. Delete AI API keys
    const keys = await base44.asServiceRole.entities.AiApiKey.filter({ user_email: userEmail });
    for (const k of keys) {
      await base44.asServiceRole.entities.AiApiKey.delete(k.id);
    }

    // 4. Delete CRM connections
    const crms = await base44.asServiceRole.entities.CrmConnection.filter({ user_email: userEmail });
    for (const c of crms) {
      await base44.asServiceRole.entities.CrmConnection.delete(c.id);
    }

    // 5. Delete Drive connections
    const drives = await base44.asServiceRole.entities.DriveConnection.filter({ user_email: userEmail });
    for (const d of drives) {
      await base44.asServiceRole.entities.DriveConnection.delete(d.id);
    }

    // 6. Delete agent branding
    const brandings = await base44.asServiceRole.entities.AgentBranding.filter({ user_email: userEmail });
    for (const b of brandings) {
      await base44.asServiceRole.entities.AgentBranding.delete(b.id);
    }

    // 7. Delete territory subscriptions
    const subs = await base44.asServiceRole.entities.TerritorySubscription.filter({ user_id: user.id });
    for (const s of subs) {
      await base44.asServiceRole.entities.TerritorySubscription.delete(s.id);
    }

    console.log(`[deleteAccount] All data deleted for ${userEmail}. Account removal complete.`);

    return Response.json({ success: true, message: 'Account and associated data deleted.' });
  } catch (error) {
    console.error('[deleteAccount] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});