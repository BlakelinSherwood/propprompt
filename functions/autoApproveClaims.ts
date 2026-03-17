import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const now = new Date().toISOString();

    // Find all pending claims where auto_approve_at has passed
    const allPending = await base44.asServiceRole.entities.TerritoryClaimRequest.filter({ status: 'pending' });
    const expired = allPending.filter(c => c.auto_approve_at && c.auto_approve_at <= now);

    if (expired.length === 0) {
      console.log('[autoApproveClaims] No claims to auto-approve');
      return Response.json({ approved: 0 });
    }

    const approved = [];
    const failed = [];

    for (const claim of expired) {
      try {
        const result = await base44.asServiceRole.functions.invoke('approveClaim', {
          claim_id: claim.id,
          admin_user_id: 'system-auto',
        });
        if (result.success) {
          approved.push(claim.id);
        } else {
          failed.push({ id: claim.id, error: result.error });
        }
      } catch (e) {
        console.error('[autoApproveClaims] Failed to approve', claim.id, e.message);
        failed.push({ id: claim.id, error: e.message });
      }
    }

    // Notify admin
    if (approved.length > 0) {
      const pricing = await base44.asServiceRole.entities.PricingConfig.list('-updated_date', 1);
      const adminEmails = await base44.asServiceRole.entities.User.filter({ role: 'platform_owner' });

      for (const admin of adminEmails) {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: admin.email,
          subject: `PropPrompt: ${approved.length} territory claim(s) auto-approved`,
          body: `${approved.length} territory claim(s) were automatically approved because no admin action was taken within the auto-approval window.\n\nClaim IDs:\n${approved.join('\n')}\n\n${failed.length > 0 ? `${failed.length} failed: ${JSON.stringify(failed)}` : ''}`,
        });
      }
    }

    console.log(`[autoApproveClaims] Approved: ${approved.length}, Failed: ${failed.length}`);
    return Response.json({ approved: approved.length, failed: failed.length });
  } catch (err) {
    console.error('[autoApproveClaims] error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});