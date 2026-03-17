import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    const { config_key, new_value } = await req.json();
    if (!config_key || new_value === undefined || new_value === null) {
      return Response.json({ error: 'config_key and new_value are required' }, { status: 400 });
    }

    // Find existing record
    const existing = await base44.asServiceRole.entities.PricingConfig.filter({ config_key });
    if (!existing || existing.length === 0) {
      return Response.json({ error: `Config key not found: ${config_key}` }, { status: 404 });
    }
    const record = existing[0];
    const old_value = record.config_value;
    const numericNew = parseFloat(new_value);

    if (isNaN(numericNew)) {
      return Response.json({ error: 'new_value must be numeric' }, { status: 400 });
    }

    // Update the record
    await base44.asServiceRole.entities.PricingConfig.update(record.id, {
      config_value: numericNew,
      updated_by: user.email,
    });

    // Write audit log
    await base44.asServiceRole.entities.PricingChangeLog.create({
      config_key,
      display_label: record.display_label || config_key,
      old_value,
      new_value: numericNew,
      changed_by: user.email,
      changed_at: new Date().toISOString(),
    });

    console.log(`[updatePricingConfig] ${config_key}: ${old_value} → ${numericNew} by ${user.email}`);

    return Response.json({ success: true, config_key, old_value, new_value: numericNew });
  } catch (err) {
    console.error('[updatePricingConfig] error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});