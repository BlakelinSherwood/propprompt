/**
 * logPrivacyEvent — Append-only privacy audit log.
 * Called from frontend whenever a privacy-relevant action occurs.
 * Validates event_type against allowed set. Never stores analysis content.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const ALLOWED_EVENTS = [
  "privacy_notice_accepted",
  "data_export_requested",
  "data_export_delivered",
  "account_deletion_requested",
  "account_deleted",
  "analysis_deleted",
  "api_key_added",
  "api_key_removed",
  "crm_connected",
  "crm_disconnected",
  "drive_connected",
  "drive_disconnected",
  "invite_sent",
  "invite_accepted",
  "invite_revoked",
  "user_suspended",
  "user_reactivated",
  "role_changed",
  "org_created",
  "org_suspended",
  "password_reset",
  "login_success",
  "login_failure",
  // Extended events for analysis privacy
  "marked_private",
  "marked_public",
  "exported_pdf",
  "exported_pptx",
  "emailed",
  "crm_pushed",
  "drive_synced",
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { event_type, subject_email, org_id, entity_type, entity_id, metadata } = await req.json();

    if (!event_type) return Response.json({ error: "event_type required" }, { status: 400 });
    if (!ALLOWED_EVENTS.includes(event_type)) {
      return Response.json({ error: `Invalid event_type: ${event_type}` }, { status: 400 });
    }

    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";

    // Sanitize metadata — never allow analysis content fields
    const FORBIDDEN_META_KEYS = ["output_text", "prompt_assembled", "followup_answers", "intake_data"];
    const cleanMeta = metadata ? Object.fromEntries(
      Object.entries(metadata).filter(([k]) => !FORBIDDEN_META_KEYS.includes(k))
    ) : {};

    const entry = await base44.asServiceRole.entities.PrivacyLog.create({
      event_type,
      actor_email: user.email,
      subject_email: subject_email || null,
      org_id: org_id || null,
      entity_type: entity_type || null,
      entity_id: entity_id || null,
      ip_address: ipAddress,
      user_agent: req.headers.get("user-agent") || "",
      metadata: cleanMeta,
    });

    return Response.json({ success: true, id: entry.id });

  } catch (error) {
    console.error("[logPrivacyEvent] error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});