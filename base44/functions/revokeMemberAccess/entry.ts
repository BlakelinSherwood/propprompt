/**
 * revokeMemberAccess — suspends an active member OR cancels a pending invite.
 * Only platform_owner, brokerage_admin (brokerage_owner), or team_lead may call this.
 * Body: { targetEmail: string, action: "revoke" | "cancel_invite" }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const AUTHORIZED_ROLES = ['platform_owner', 'admin', 'brokerage_owner', 'brokerage_admin', 'team_lead'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    if (!AUTHORIZED_ROLES.includes(user.role)) {
      return Response.json({ error: 'Forbidden: insufficient permissions' }, { status: 403 });
    }

    const { targetEmail, action } = await req.json();
    if (!targetEmail || !action) {
      return Response.json({ error: 'targetEmail and action required' }, { status: 400 });
    }

    if (action === 'cancel_invite') {
      // Delete pending OrgMembership invite records for this email
      const pending = await base44.asServiceRole.entities.OrgMembership.filter({
        user_email: targetEmail,
        status: 'pending_invite',
      });
      for (const m of pending) {
        await base44.asServiceRole.entities.OrgMembership.delete(m.id);
      }
      // Also cancel any pending ReferralInvites for this email
      const referralInvites = await base44.asServiceRole.entities.ReferralInvite.filter({
        invitee_email: targetEmail,
        status: 'pending',
      });
      for (const ri of referralInvites) {
        await base44.asServiceRole.entities.ReferralInvite.update(ri.id, { status: 'expired' });
      }
      console.log(`[revokeMemberAccess] Cancelled invite for ${targetEmail} by ${user.email}`);
      return Response.json({ success: true, action: 'cancel_invite', email: targetEmail });
    }

    if (action === 'revoke') {
      // Suspend active OrgMembership records
      const memberships = await base44.asServiceRole.entities.OrgMembership.filter({
        user_email: targetEmail,
        status: 'active',
      });
      for (const m of memberships) {
        await base44.asServiceRole.entities.OrgMembership.update(m.id, { status: 'suspended' });
      }
      console.log(`[revokeMemberAccess] Revoked access for ${targetEmail} by ${user.email}`);
      return Response.json({ success: true, action: 'revoke', email: targetEmail });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('[revokeMemberAccess] error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});