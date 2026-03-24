import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'platform_owner') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { data } = await req.json();
    const configs = await base44.asServiceRole.entities.PlatformConfig.filter({});
    let cfg = configs[0];
    if (!cfg) {
      cfg = await base44.asServiceRole.entities.PlatformConfig.create({ platform_version: '4.0' });
    }
    const updated = await base44.asServiceRole.entities.PlatformConfig.update(cfg.id, data);
    return Response.json({ config: updated });
  } catch (error) {
    console.error('[updatePlatformConfig] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});