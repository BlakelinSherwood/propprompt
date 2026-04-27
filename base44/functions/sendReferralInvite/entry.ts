/**
 * sendReferralInvite — sends an external referral invite (non-team-member).
 * Creates a ReferralInvite record and sends an invitation email with
 * a discount offer. Any authenticated user can send an external referral.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// 30 days public window + 15 day silent buffer = 45 days total
const SIGNUP_WINDOW_DAYS = 45;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { email, personalNote } = await req.json();
    if (!email) return Response.json({ error: 'email required' }, { status: 400 });

    // Check not already pending
    const existing = await base44.asServiceRole.entities.ReferralInvite.filter({
      inviter_email: user.email,
      invitee_email: email,
      status: 'pending',
    });
    if (existing.length > 0) {
      return Response.json({ success: true, already_sent: true, message: 'Invite already pending for this email.' });
    }

    const signupDeadline = new Date(Date.now() + SIGNUP_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const inviteToken = crypto.randomUUID().replace(/-/g, '');

    const invite = await base44.asServiceRole.entities.ReferralInvite.create({
      invite_token: inviteToken,
      inviter_email: user.email,
      inviter_org_id: user.org_id || null,
      invitee_email: email,
      invite_type: 'external',
      intended_role: null,
      invitee_discount_pct: 20,
      invitee_discount_months: 2,
      inviter_discount_pct: 10,
      inviter_discount_months: 1,
      signup_deadline: signupDeadline,
      invite_sent_at: new Date().toISOString(),
      status: 'pending',
    });

    // Send invite email
    const inviterName = user.full_name || user.email;
    const signupUrl = `${Deno.env.get('BASE44_APP_URL') || 'https://app.propprompt.com'}/Claim?ref=${inviteToken}`;
    const emailBody = `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1A3226;">
  <div style="background:#1A3226;padding:24px 32px;border-radius:12px 12px 0 0;">
    <div style="display:flex;align-items:center;gap:10px;">
      <div style="background:#B8982F;color:#1A3226;font-weight:700;font-size:13px;padding:6px 10px;border-radius:6px;">PP</div>
      <span style="color:white;font-weight:600;font-size:16px;">PropPrompt™</span>
    </div>
  </div>
  <div style="background:white;padding:32px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 12px 12px;">
    <p style="font-size:15px;font-weight:600;margin-top:0;">You've been invited to PropPrompt™</p>
    <p style="font-size:14px;color:#444;line-height:1.6;">
      <strong>${inviterName}</strong> thinks you'd get a lot out of PropPrompt — the AI-powered market analysis platform built exclusively for New England real estate agents.
    </p>
    ${personalNote ? `<p style="font-size:13px;font-style:italic;color:#555;background:#FAF8F4;padding:12px 16px;border-left:3px solid #B8982F;border-radius:4px;">"${personalNote}"<br>— ${inviterName}</p>` : ''}
    <div style="background:#FAF8F4;border:1px solid #B8982F30;border-radius:10px;padding:20px;margin:20px 0;">
      <p style="font-size:12px;font-weight:700;color:#B8982F;text-transform:uppercase;letter-spacing:0.05em;margin-top:0;">Exclusive Invite Offer</p>
      <p style="font-size:22px;font-weight:800;color:#1A3226;margin:4px 0;">20% off your first 2 months</p>
      <p style="font-size:12px;color:#666;margin-bottom:0;">Sign up within 30 days of receiving this invite to claim your discount. Applies to any PropPrompt territory subscription.</p>
    </div>
    <a href="${signupUrl}" style="display:inline-block;background:#B8982F;color:#1A3226;font-weight:700;font-size:14px;padding:14px 28px;border-radius:10px;text-decoration:none;margin:8px 0;">
      Claim My Territory + Discount →
    </a>
    <p style="font-size:11px;color:#999;margin-top:24px;">This offer expires in 30 days. Discount applied automatically at checkout. PropPrompt serves ME, NH, VT, and MA.</p>
  </div>
</div>
    `.trim();

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: email,
      subject: `${inviterName} invited you to PropPrompt™ — 20% off your first 2 months`,
      body: emailBody,
    });

    console.log(`[sendReferralInvite] External invite sent from ${user.email} to ${email}`);
    return Response.json({ success: true, invite_id: invite.id });
  } catch (err) {
    console.error('[sendReferralInvite] error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});