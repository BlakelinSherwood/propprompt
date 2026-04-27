import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * adminSetUserRole — sets the role on a user record via service role.
 * Admin/platform_owner only.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['admin', 'platform_owner'].includes(user.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { userId, role } = await req.json();
    if (!userId || !role) return Response.json({ error: 'userId and role required' }, { status: 400 });

    await base44.asServiceRole.entities.User.update(userId, { role });

    return Response.json({ success: true, userId, role });
  } catch (err) {
    console.error('[adminSetUserRole] error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});