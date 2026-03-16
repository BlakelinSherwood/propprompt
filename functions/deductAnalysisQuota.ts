import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Roles that are always unlimited — skip quota entirely
const UNLIMITED_ROLES = ["platform_owner", "team_agent"];

// Analyses included per role per month
const ROLE_QUOTA = {
  brokerage_admin: 60,
  team_lead: 40,
  agent: 20,
  assistant: 0,
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { analysis_id, action } = await req.json();
    // action: "deduct" | "refund"

    // Unlimited roles — always allowed
    if (UNLIMITED_ROLES.includes(user.role)) {
      return Response.json({ allowed: true, unlimited: true });
    }

    // Find user's org membership
    const memberships = await base44.entities.OrgMembership.filter({ user_email: user.email, status: "active" });
    if (memberships.length === 0) {
      return Response.json({ allowed: false, reason: "No active org membership" });
    }
    const membership = memberships[0];

    // Find org's SeatQuota
    const quotas = await base44.asServiceRole.entities.SeatQuota.filter({ org_id: membership.org_id });
    if (quotas.length === 0) {
      return Response.json({ allowed: false, reason: "No quota record found for org" });
    }
    const quota = quotas[0];

    const included = quota.analyses_included_per_seat_monthly ?? ROLE_QUOTA[user.role] ?? 0;
    const used = quota.agent_seats_used ?? 0; // repurposing as analyses_used counter

    if (action === "refund") {
      await base44.asServiceRole.entities.SeatQuota.update(quota.id, {
        agent_seats_used: Math.max(0, used - 1),
      });
      return Response.json({ refunded: true });
    }

    // Check quota
    if (used >= included) {
      return Response.json({ allowed: false, reason: "Quota exhausted", used, included });
    }

    // Deduct
    await base44.asServiceRole.entities.SeatQuota.update(quota.id, {
      agent_seats_used: used + 1,
    });

    return Response.json({ allowed: true, used: used + 1, included });
  } catch (err) {
    console.error("Quota check error:", err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});