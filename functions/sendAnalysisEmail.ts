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

    const { analysisId, toEmail, subject: customSubject, includePdf = false, contactName = '' } = await req.json();
    if (!analysisId) return Response.json({ error: 'analysisId required' }, { status: 400 });
    if (!toEmail) return Response.json({ error: 'toEmail required' }, { status: 400 });

    const [analyses, brandingRes] = await Promise.all([
      base44.asServiceRole.entities.Analysis.filter({ id: analysisId }),
      base44.functions.invoke('resolveBranding', { analysisId }),
    ]);

    const analysis = analyses[0];
    if (!analysis) return Response.json({ error: 'Analysis not found' }, { status: 404 });

    const branding = brandingRes?.data?.branding;
    const address = analysis.intake_data?.address || 'the subject property';
    const assessmentLabel = ASSESSMENT_LABELS[analysis.assessment_type] || 'Analysis';
    const subject = customSubject || `Your ${assessmentLabel} — ${address}`;
    const top3 = extractTop3Conclusions(analysis.output_text || '');
    const pdfUrl = analysis.output_pdf_url || null;

    const html = buildEmailHtml({
      branding, assessmentLabel, address, top3,
      contactName, includePdf, pdfUrl, analysisId,
    });

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: toEmail,
      subject,
      body: html,
      from_name: branding?.org_name || branding?.agent_name || 'PropPrompt Analysis',
    });

    // Log to AnalysisEmail audit table
    await base44.asServiceRole.entities.AnalysisEmail.create({
      analysis_id: analysisId,
      sent_to: toEmail,
      sent_at: new Date().toISOString(),
      subject,
      included_pdf: !!includePdf,
      sent_by_email: user.email,
    });

    console.log(`[sendAnalysisEmail] sent to ${toEmail} for analysis ${analysisId}`);
    return Response.json({ success: true });
  } catch (error) {
    console.error('[sendAnalysisEmail] error:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/** Pull the first 3 meaningful bullet points / numbered items from output_text */
function extractTop3Conclusions(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const bullets = lines
    .filter(l => /^[-•*]|^\d+\./.test(l) || (l.length > 20 && l.length < 200))
    .map(l => l.replace(/^[-•*\d.]\s*/, '').replace(/\*\*/g, '').trim())
    .filter(l => l.length > 15)
    .slice(0, 3);
  return bullets.length ? bullets : [];
}

function buildEmailHtml({ branding, assessmentLabel, address, top3, contactName, includePdf, pdfUrl, analysisId }) {
  const b = branding || {};
  const pri = (b.primary_color || '#333333');
  const acc = (b.accent_color  || '#666666');
  const bg  = (b.background_color || '#FFFFFF');
  const style = b.signature_style || 'name_title_contact';

  // Header
  const logoHtml = b.org_logo_url
    ? `<img src="${b.org_logo_url}" alt="${b.org_name || ''}" height="44" style="max-height:44px;display:block" />`
    : '';
  const headerInner = b.org_logo_url
    ? `<table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="vertical-align:middle">${logoHtml}</td>
        <td style="text-align:right;vertical-align:middle;color:#FFFFFF;font-size:14px;font-weight:bold;font-family:Georgia,serif">${b.org_name || ''}</td>
       </tr></table>`
    : `<p style="text-align:center;color:#FFFFFF;font-weight:bold;font-size:16px;font-family:Georgia,serif;margin:0">${b.org_name || ''}</p>`;

  // Greeting
  const greeting = contactName ? `<p style="color:#1A1A1A;font-size:14px;margin:0 0 10px">Hi ${contactName},</p>` : '';

  // Intro
  const intro = `<p style="color:#444;font-size:13px;margin:0 0 20px">Please find your <strong>${assessmentLabel}</strong> for <strong>${address}</strong> below.</p>`;

  // Key findings
  const findingsRows = `
    <tr><td style="padding:7px 0;border-bottom:1px solid #F0F0F0;color:#555;font-size:12px;width:35%">Property</td>
        <td style="padding:7px 0;border-bottom:1px solid #F0F0F0;color:#1A1A1A;font-size:12px;font-weight:600">${address}</td></tr>
    <tr><td style="padding:7px 0;border-bottom:1px solid #F0F0F0;color:#555;font-size:12px">Analysis Type</td>
        <td style="padding:7px 0;border-bottom:1px solid #F0F0F0;color:#1A1A1A;font-size:12px;font-weight:600">${assessmentLabel}</td></tr>
    ${top3.map(c => `
    <tr><td colspan="2" style="padding:7px 0;border-bottom:1px solid #F0F0F0;color:#1A1A1A;font-size:12px">
      <span style="color:${acc};margin-right:8px">▸</span>${c}
    </td></tr>`).join('')}
  `;

  // PDF note
  const pdfNote = includePdf
    ? `<p style="color:#555;font-size:12px;margin:0 0 20px;padding:10px 14px;background:#F9F9F9;border-radius:4px">📎 Your PDF is attached.</p>`
    : '';

  // Signature
  const headshotHtml = (style === 'full_with_headshot' && b.agent_headshot_url)
    ? `<img src="${b.agent_headshot_url}" width="48" height="48" style="border-radius:50%;float:left;margin:0 14px 8px 0" />`
    : '';

  const sigLines = [];
  if (b.agent_name) sigLines.push(`<p style="font-weight:bold;color:#1A1A1A;font-size:14px;margin:0 0 3px">${b.agent_name}</p>`);
  if (style !== 'name_only' && b.agent_title) sigLines.push(`<p style="color:#555;font-size:12px;margin:0 0 3px">${b.agent_title}</p>`);
  if (['name_title_contact', 'full_with_headshot'].includes(style)) {
    const contact = [b.agent_phone, b.agent_email].filter(Boolean).join('  |  ');
    if (contact) sigLines.push(`<p style="color:#555;font-size:12px;margin:0 0 3px">${contact}</p>`);
    if (b.agent_license) sigLines.push(`<p style="color:#888;font-size:11px;margin:0">License: ${b.agent_license}</p>`);
  }
  if (b.agent_tagline) sigLines.push(`<p style="color:#999;font-size:11px;font-style:italic;margin:5px 0 0">${b.agent_tagline}</p>`);

  const footerInfo = [b.org_address, b.org_phone, b.org_website].filter(Boolean).join('  ·  ');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F0EEE9;font-family:Arial,Helvetica,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F0EEE9">
<tr><td align="center" style="padding:24px 10px">
<table cellpadding="0" cellspacing="0" style="background:${bg};max-width:600px;width:100%;border-radius:4px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.07)">

  <!-- HEADER -->
  <tr><td style="background:${pri};padding:13px 20px;height:70px;vertical-align:middle">
    ${headerInner}
  </td></tr>
  <!-- ACCENT LINE -->
  <tr><td style="background:${acc};height:3px;font-size:1px;line-height:1px">&nbsp;</td></tr>

  <!-- BODY -->
  <tr><td style="padding:28px 32px">
    ${greeting}
    ${intro}

    <!-- Key findings -->
    <p style="color:${pri};font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 8px">Key Findings</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
      ${findingsRows}
    </table>

    ${pdfNote}

    <!-- CTA -->
    <p style="text-align:center;margin:28px 0 8px">
      <a href="#" style="background:${pri};color:#FFFFFF;text-decoration:none;padding:12px 30px;border-radius:5px;font-size:14px;font-weight:bold;display:inline-block;font-family:Georgia,serif">View Full Analysis</a>
    </p>
  </td></tr>

  <!-- SIGNATURE -->
  <tr><td style="padding:18px 32px 22px;border-top:2px solid ${acc}">
    ${headshotHtml}
    ${sigLines.join('')}
    <div style="clear:both"></div>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background:#F5F5F5;padding:14px 32px;text-align:center;border-top:1px solid #E8E8E8">
    ${footerInfo ? `<p style="color:#999;font-size:11px;margin:0 0 5px">${footerInfo}</p>` : ''}
    <p style="color:#BBBBBB;font-size:10px;margin:0 0 4px">Sent via PropPrompt™</p>
    <p style="color:#BBBBBB;font-size:10px;margin:0"><a href="#" style="color:#BBBBBB;text-decoration:underline">Unsubscribe</a></p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;
}