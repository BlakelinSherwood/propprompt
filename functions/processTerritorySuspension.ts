import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Admin-only function to handle territory suspension logic
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || (user.role !== 'platform_owner' && user.role !== 'admin')) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { action, territory_id, resolution, refund_amount, admin_notes, stripe_refund_id } = await req.json();
    
    if (!action || !territory_id) {
      return Response.json({ error: 'action and territory_id required' }, { status: 400 });
    }

    const territory = await base44.entities.Territory.get(territory_id);
    if (!territory) {
      return Response.json({ error: 'Territory not found' }, { status: 404 });
    }

    const suspension = await base44.entities.TerritorySuspensionLog.create({
      territory_id: territory_id,
      suspension_reason: 'data_quality',
      suspended_at: new Date().toISOString(),
      suspended_by: user.id,
      resolution: action === 'suspend' ? null : resolution,
      resolved_at: action === 'suspend' ? null : new Date().toISOString(),
      refund_amount: refund_amount || null,
      stripe_refund_id: stripe_refund_id || null,
      subscriber_notified_at: null,
      admin_notes: admin_notes || ''
    });

    // Update territory status
    if (action === 'suspend') {
      await base44.entities.Territory.update(territory_id, {
        status: 'data_quality_suspended'
      });
    } else if (action === 'resolve') {
      await base44.entities.Territory.update(territory_id, {
        status: 'active'
      });
    } else if (action === 'refund') {
      await base44.entities.Territory.update(territory_id, {
        status: 'data_quality_suspended'
      });
    }

    return Response.json({
      suspension_id: suspension.id,
      action: action,
      territory_id: territory_id,
      message: `Territory ${action === 'suspend' ? 'suspended' : 'updated'} successfully`
    });
  } catch (error) {
    console.error('[processTerritorySuspension] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});