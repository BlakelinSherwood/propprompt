import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const ASSESSMENT_LABELS = {
  listing_pricing: 'Listing Pricing Analysis',
  buyer_intelligence: 'Buyer Intelligence Report',
  investment_analysis: 'Investment Analysis',
  cma: 'Comparative Market Analysis',
  rental_analysis: 'Rental Analysis',
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { analysisId, toEmail, subject, contactName, includePdf } = await req.json();
    if (!analysisId || !toEmail) {
      return Response.json({ error: 'analysisId and toEmail required' }, { status: 400 });
    }

    // Load analysis
    const analyses = await base44.asServiceRole.entities.Analysis.filter({ id: analysisId });
    const analysis = analyses[0];
    if (!analysis) return Response.json({ error: 'Analysis not found' }, { status: 404 });

    // Resolve branding
    let branding = {};
    try {
      const bRes = await base44.functions.invoke('resolveBranding', { analysisId });
      branding = bRes?.data?.branding || {};
    } catch (e) {
      console.warn('[sendAnalysisEmail] branding resolve failed:', e.message);
    }

    const pri = branding.primary_color || '#333333';
    const acc = branding.accent_color || '#666666';
    const address = analysis.intake_data?.address || '';
    const assessLabel = ASSESSMENT_LABELS[analysis.assessment_type] || 'Analysis';
    const emailSubject = subject || `Your ${assessLabel} — ${address}`;
    const pdfUrl = analysis.output_pdf_url || analysis.pdf_url || null;

    // Extract top 3 conclusions from output_text
    const conclusions = extractConclusions(analysis.output_text || '', 3);

    // App base URL for "View Full Analysis" link
    const appBaseUrl = Deno.env.get('APP_BASE_URL') || 'https://app.propprompt.com';
    const analysisUrl = `${appBaseUrl}/Analysis/${analysisId}`;

    const html = buildEmailHtml({
      branding,
      pri,
      acc,
      contactName: contactName || '',
      assessLabel,
      address,
      conclusions,
      analysisUrl,
      includePdf: !!includePdf,
      pdfUrl,
      intake: analysis.intake_data || {},
    });

    // Send via built-in email integration
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: toEmail,
      subject: emailSubject,
      body: html,
      from_name: branding.agent_name || branding.org_name || 'PropPrompt',
    });

    // Log the send
    await base44.asServiceRole.entities.AnalysisEmail.create({
      analysis_id: analysisId,
      sent_to: toEmail,
      sent_at: new Date().toISOString(),
      subject: emailSubject,
      included_pdf: !!includePdf,
      sent_by_email: user.email,
    });

    // Update analysis export tracking
    await base44.asServiceRole.entities.Analysis.update(analysisId, {
      last_exported_at: new Date().toISOString(),
      last_export_format: 'email',
    });

    console.log(`[sendAnalysisEmail] sent to ${toEmail} for analysis ${analysisId}`);
    return Response.json({ success: true, sentTo: toEmail, subject: emailSubject });

  } catch (err) {
    console.error('[sendAnalysisEmail] error:', err.message, err.stack);
    return Response.json({ error: err.message }, { status: 500 });
  }
});

// ─── HTML email builder ───────────────────────────────────────────────────────

function buildEmailHtml({ branding, pri, acc, contactName, assessLabel, address, conclusions, analysisUrl, includePdf, pdfUrl, intake }) {
  const hasLogo = !!branding.org_logo_url;
  const hasHeadshot = branding.signature_style === 'full_with_headshot' && !!branding.agent_headshot_url;
  const contactLine = [branding.agent_phone, branding.agent_email].filter(Boolean).join(' | ');
  const orgFooter = [branding.org_address, branding.org_phone, branding.org_website].filter(Boolean).join('  ·  ');

  const headerLogoCell = hasLogo
    ? `<td style="padding:13px 16px;"><img src="${branding.org_logo_url}" alt="${branding.org_name || ''}" style="max-height:44px;display:block;"></td>`
    : '';
  const headerNameStyle = hasLogo
    ? `text-align:right;padding:13px 16px;color:#FFFFFF;font-size:15px;font-weight:bold;font-family:Georgia,serif;`
    : `text-align:center;padding:13px 16px;color:#FFFFFF;font-size:17px;font-weight:bold;font-family:Georgia,serif;`;

  const conclusionRows = conclusions.map(c =>
    `<tr><td style="padding:6px 0;font-size:14px;color:#333333;font-family:Arial,sans-serif;border-bottom:1px solid #EEEEEE;">• ${c}</td></tr>`
  ).join('');

  const greetingLine = contactName
    ? `<p style="font-size:16px;color:#1A1A1A;font-family:Arial,sans-serif;margin:0 0 12px;">Hi ${contactName},</p>`
    : '';

  const headshotHtml = hasHeadshot
    ? `<img src="${branding.agent_headshot_url}" width="48" height="48" style="border-radius:50%;object-fit:cover;display:inline-block;vertical-align:middle;margin-right:12px;">`
    : '';

  const sigNameStyle = `font-size:15px;font-weight:bold;color:#1A1A1A;font-family:Arial,sans-serif;display:inline-block;vertical-align:middle;`;

  const pdfNote = includePdf && pdfUrl
    ? `<p style="font-size:13px;color:#555555;font-family:Arial,sans-serif;margin:16px 0 0;padding:10px 14px;background:#F9F9F9;border-left:3px solid ${acc};border-radius:3px;">📎 Your PDF report is attached to this email.</p>`
    : '';

  const priceRange = intake.price_range || intake.suggested_price || '';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${assessLabel}</title></head>
<body style="margin:0;padding:0;background:#F0F0F0;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F0F0F0;padding:24px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border-radius:6px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

  <!-- HEADER -->
  <tr>
    <td style="background:${pri};border-bottom:3px solid ${acc};">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          ${headerLogoCell}
          <td style="${headerNameStyle}">${branding.org_name || ''}</td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- BODY -->
  <tr>
    <td style="padding:32px 36px;background:#FFFFFF;">
      ${greetingLine}
      <p style="font-size:15px;color:#333333;font-family:Arial,sans-serif;margin:0 0 24px;line-height:1.6;">
        Please find your <strong>${assessLabel}</strong> for <strong>${address}</strong> below.
      </p>

      <!-- Key Findings Block -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        <tr>
          <td style="background:${pri};padding:10px 16px;border-radius:4px 4px 0 0;">
            <span style="color:#FFFFFF;font-size:13px;font-weight:bold;font-family:Arial,sans-serif;letter-spacing:0.5px;text-transform:uppercase;">Key Findings</span>
          </td>
        </tr>
        <tr>
          <td style="border:1px solid #E8E8E8;border-top:none;padding:16px;border-radius:0 0 4px 4px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="padding:6px 0;font-size:14px;color:#333333;font-family:Arial,sans-serif;border-bottom:1px solid #EEEEEE;"><strong>Property:</strong> ${address}</td></tr>
              <tr><td style="padding:6px 0;font-size:14px;color:#333333;font-family:Arial,sans-serif;border-bottom:1px solid #EEEEEE;"><strong>Analysis Type:</strong> ${assessLabel}</td></tr>
              ${priceRange ? `<tr><td style="padding:6px 0;font-size:14px;color:#333333;font-family:Arial,sans-serif;border-bottom:1px solid #EEEEEE;"><strong>Recommended Price Range:</strong> ${priceRange}</td></tr>` : ''}
              ${conclusionRows}
            </table>
          </td>
        </tr>
      </table>

      <!-- CTA Button -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        <tr>
          <td align="center">
            <a href="${analysisUrl}" style="display:inline-block;background:${pri};color:#FFFFFF;font-size:14px;font-weight:bold;font-family:Arial,sans-serif;text-decoration:none;padding:13px 32px;border-radius:6px;">View Full Analysis →</a>
          </td>
        </tr>
      </table>

      ${pdfNote}

      <!-- SIGNATURE BLOCK -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;border-top:2px solid ${acc};">
        <tr>
          <td style="padding:20px 0 0;">
            <div style="margin-bottom:6px;">${headshotHtml}<span style="${sigNameStyle}">${branding.agent_name || ''}</span></div>
            ${branding.agent_title ? `<p style="margin:3px 0;font-size:13px;color:#555555;font-family:Arial,sans-serif;">${branding.agent_title}</p>` : ''}
            ${contactLine ? `<p style="margin:3px 0;font-size:13px;color:#555555;font-family:Arial,sans-serif;">${contactLine}</p>` : ''}
            ${branding.agent_tagline ? `<p style="margin:6px 0 0;font-size:13px;color:#777777;font-style:italic;font-family:Arial,sans-serif;">${branding.agent_tagline}</p>` : ''}
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- FOOTER -->
  <tr>
    <td style="background:#F5F5F5;padding:20px 36px;text-align:center;">
      ${orgFooter ? `<p style="margin:0 0 6px;font-size:12px;color:#888888;font-family:Arial,sans-serif;">${orgFooter}</p>` : ''}
      <p style="margin:0 0 6px;font-size:11px;color:#AAAAAA;font-family:Arial,sans-serif;">Sent via PropPrompt™</p>
      <p style="margin:0;font-size:11px;font-family:Arial,sans-serif;"><a href="${analysisUrl}?unsubscribe=1" style="color:#AAAAAA;text-decoration:underline;">Unsubscribe</a></p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractConclusions(text, max) {
  if (!text) return [];
  // Grab lines that look like conclusions: bullet points, numbered items, or bold lines
  const lines = text.split('\n');
  const hits = [];
  for (const line of lines) {
    const clean = line.replace(/^\s*[-*•\d.]+\s*/, '').replace(/\*\*/g, '').trim();
    if (clean.length > 20 && clean.length < 200) {
      hits.push(clean);
    }
    if (hits.length >= max) break;
  }
  return hits;
}