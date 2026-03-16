import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Save / update a CRM connection for the current user.
 * For API-key based CRMs (FUB, kvCORE, Lofty): accepts apiKey + optional instanceUrl.
 * For Salesforce: OAuth callback stores tokens.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, crm_provider, api_key, instance_url, crm_account_name, default_push_format } = body;

    if (action === 'connect') {
      // Find existing or create new
      const existing = await base44.entities.CrmConnection.filter({ user_email: user.email, crm_provider });
      const data = {
        user_email: user.email,
        crm_provider,
        encrypted_api_key: api_key || '',
        crm_account_name: crm_account_name || instance_url || '',
        status: 'connected',
        default_push_format: default_push_format || 'note',
      };
      if (existing.length > 0) {
        await base44.entities.CrmConnection.update(existing[0].id, data);
        return Response.json({ success: true, id: existing[0].id });
      } else {
        const rec = await base44.entities.CrmConnection.create(data);
        return Response.json({ success: true, id: rec.id });
      }
    }

    if (action === 'disconnect') {
      const { connection_id } = body;
      await base44.entities.CrmConnection.update(connection_id, { status: 'disconnected' });
      return Response.json({ success: true });
    }

    if (action === 'list') {
      const connections = await base44.entities.CrmConnection.filter({ user_email: user.email });
      // Strip sensitive fields
      const safe = connections.map(c => ({
        id: c.id,
        crm_provider: c.crm_provider,
        crm_account_name: c.crm_account_name,
        status: c.status,
        default_push_format: c.default_push_format,
        auto_push_enabled: c.auto_push_enabled,
        last_sync_at: c.last_sync_at,
      }));
      return Response.json({ connections: safe });
    }

    if (action === 'toggle_auto_push') {
      const { connection_id, enabled } = body;
      await base44.entities.CrmConnection.update(connection_id, { auto_push_enabled: enabled });
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (err) {
    console.error('crmConnect error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});