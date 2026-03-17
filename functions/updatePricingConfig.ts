import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * updatePricingConfig — saves a pricing config value and writes audit log
 * POST body: { config_key: string, new_value: number }
 * Admin only.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });

    const { config_key, new_value } = await req.json();
    if (!config_key || new_value === undefined || new_value === null) {
      return Response.json({ error: 'config_key and new_value are required' }, { status: 400 });
    }

    // Find the existing record
    const rows = await base44.asServiceRole.entities.PricingConfig.filter({ config_key });
    if (!rows || rows.length === 0) {
      return Response.json({ error: `Config key '${config_key}' not found` }, { status: 404 });
    }

    const existing = rows[0];
    const old_value = existing.config_value;

    // Update the config value
    await base44.asServiceRole.entities.PricingConfig.update(existing.id, {
      config_value: new_value,
      updated_by: user.email,
    });

    // Write audit log
    await base44.asServiceRole.entities.PricingChangeLog.create({
      config_key,
      display_label: existing.display_label || config_key,
      old_value,
      new_value,
      changed_by: user.email,
      changed_at: new Date().toISOString(),
      category: existing.category,
    });

    console.log(`[updatePricingConfig] ${config_key}: ${old_value} → ${new_value} by ${user.email}`);
    return Response.json({ success: true, config_key, old_value, new_value });

  } catch (err) {
    console.error('[updatePricingConfig] error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});