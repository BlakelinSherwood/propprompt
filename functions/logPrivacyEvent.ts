/**
 * logPrivacyEvent — Append-only privacy audit log writer per Addendum A5.
 * Called from frontend for client-side events (PDF export, email, CRM push, Drive sync).
 * Server-side events (mark_private, delete) are logged directly from their handlers.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const ALLOWED_EVENTS = [
  'privacy_notice_accepted', 'data_export_requested', 'data_export_delivered',
  'account_deletion_requested', 'account_deleted', 'analysis_deleted',
  'api_key_added', 'api_key_removed', 'crm_connected', 'crm_disconnected',
  'drive_connected', 'drive_disconnected', 'invite_sent', 'invite_accepted',
  'invite_revoked', 'user_suspended', 'user_reactivated', 'role_changed',
  'org_created', 'org_suspended', 'password_reset', 'login_success', 'login_failure',
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { event_type, subject_email, org_id, entity_type, entity_id, metadata } = body;

    if (!event_type || !ALLOWED_EVENTS.includes(event_type)) {
      return Response.json({ error: `Invalid event_type: ${event_type}` }, { status: 400 });
    }

    const ip = req.headers.get('x-forwarded-for') ||
                req.headers.get('cf-connecting-ip') ||
                req.headers.get('x-real-ip') ||
                'unknown';

    const userAgent = req.headers.get('user-agent') || 'unknown';

    const logEntry = await base44.asServiceRole.entities.PrivacyLog.create({
      event_type,
      actor_email: user.email,
      subject_email: subject_email || null,
      org_id: org_id || null,
      entity_type: entity_type || null,
      entity_id: entity_id || null,
      ip_address: ip,
      user_agent: userAgent,
      metadata: metadata || null,
    });

    return Response.json({ success: true, id: logEntry.id });
  } catch (error) {
    console.error('[logPrivacyEvent] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});