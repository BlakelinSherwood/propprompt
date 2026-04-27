import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { user_id, role, secret } = await req.json();
    // Simple shared secret guard for this internal admin-only endpoint
    if (secret !== Deno.env.get('ENCRYPTION_KEY')) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!user_id || !role) return Response.json({ error: 'user_id and role required' }, { status: 400 });

    await base44.asServiceRole.entities.User.update(user_id, { role });
    return Response.json({ success: true, user_id, role });
  } catch (err) {
    console.error('[updateUserRole] error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});