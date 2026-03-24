import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'platform_owner') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { id, data } = await req.json();
    const updated = await base44.asServiceRole.entities.Organization.update(id, data);
    return Response.json({ org: updated });
  } catch (error) {
    console.error('[updateOrg] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});