import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Create organization
    const org = await base44.asServiceRole.entities.Organization.create({
      name: "Sherwood & Company Team",
      org_type: "team",
      owner_email: user.email,
      status: "active",
      subscription_plan: "team",
      allow_agent_private_toggle: true,
    });

    // Create org membership for the owner
    const membership = await base44.asServiceRole.entities.OrgMembership.create({
      org_id: org.id,
      user_email: user.email,
      role: "brokerage_admin",
      status: "active",
    });

    return Response.json({
      success: true,
      organization: {
        id: org.id,
        name: org.name,
        type: org.org_type,
      },
      membership: {
        id: membership.id,
        role: membership.role,
      },
      message: "Organization created successfully. Refresh the page to see your org settings.",
    });
  } catch (error) {
    console.error('Setup error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});