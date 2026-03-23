/**
 * inviteMember — Invites a user to the platform with a custom app role.
 * 
 * Sends the base44 invite as "user" (or "admin" for platform_owner),
 * then immediately sets the custom role on the User entity record.
 * Only platform_owner and brokerage_admin and team_lead can call this.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// Which base44 platform roles can invite, and which app roles they can assign
const INVITE_PERMISSIONS = {
  platform_owner: ["platform_owner", "brokerage_owner", "team_lead", "brokerage_admin", "team_admin", "agent", "individual_agent", "team_agent", "assistant"],
  brokerage_owner: ["team_lead", "brokerage_admin", "team_admin", "agent", "team_agent", "assistant"],
  brokerage_admin: ["team_lead", "team_admin", "agent", "team_agent", "assistant"],
  team_lead: ["agent", "team_agent", "assistant", "team_admin"],
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { email, appRole } = await req.json();
    if (!email || !appRole) return Response.json({ error: "email and appRole required" }, { status: 400 });

    // Check the inviter has permission to assign this role
    const allowed = INVITE_PERMISSIONS[user.role] || [];
    if (!allowed.includes(appRole)) {
      return Response.json({ error: `Your role (${user.role}) cannot invite users with role: ${appRole}` }, { status: 403 });
    }

    // Determine base44 platform role: platform_owner gets "admin", everyone else "user"
    const platformRole = appRole === "platform_owner" ? "admin" : "user";

    // Send the invite via base44 SDK (must use user-scoped client)
    await base44.users.inviteUser(email, platformRole);

    // Create an OrgMembership record so the invite shows as pending in the Members list
    try {
      // Find the inviter's org
      const orgs = await base44.asServiceRole.entities.Organization.filter({ owner_email: user.email });
      const orgId = orgs?.[0]?.id;
      if (orgId) {
        // Check if membership already exists
        const existing = await base44.asServiceRole.entities.OrgMembership.filter({ user_email: email, org_id: orgId });
        if (!existing || existing.length === 0) {
          await base44.asServiceRole.entities.OrgMembership.create({
            user_email: email,
            org_id: orgId,
            role_in_org: appRole,
            status: 'pending_invite',
            invited_by_email: user.email,
            invite_sent_at: new Date().toISOString(),
            invite_expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
          });
        }
      }
    } catch (e) {
      console.log('Could not create OrgMembership:', e.message);
    }

    return Response.json({ success: true, email, appRole, platformRole });
  } catch (error) {
    console.error("inviteMember error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});