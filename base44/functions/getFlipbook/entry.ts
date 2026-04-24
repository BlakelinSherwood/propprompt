import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * getFlipbook — public endpoint, no auth required.
 * Fetches a FlipbookLink by share_token using service role, increments view_count.
 * POST body: { token: string }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { token } = await req.json();

    if (!token) {
      return Response.json({ error: 'token required' }, { status: 400 });
    }

    const records = await base44.asServiceRole.entities.FlipbookLink.filter({ share_token: token });
    const record = records[0];

    if (!record) {
      return Response.json({ status: 'not_found' });
    }

    const now = new Date().toISOString();
    const isExpired = record.is_expired || (record.expires_at && record.expires_at <= now);

    if (isExpired) {
      return Response.json({ status: 'expired' });
    }

    // Increment view_count (best-effort)
    base44.asServiceRole.entities.FlipbookLink.update(record.id, {
      view_count: (record.view_count || 0) + 1,
    }).catch(() => {});

    return Response.json({ status: 'ok', record });
  } catch (err) {
    console.error('[getFlipbook] error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});