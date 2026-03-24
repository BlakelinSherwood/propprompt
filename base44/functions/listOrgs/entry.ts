import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'platform_owner') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const orgs = await base44.asServiceRole.entities.Organization.list('-created_date', 200);
    return Response.json({ orgs: orgs || [] });
  } catch (error) {
    console.error('[listOrgs] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});