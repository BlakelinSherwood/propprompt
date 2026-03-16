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

    const { analysisId, toEmail, subject: customSubject } = await req.json();
    if (!toEmail) return Response.json({ error: 'toEmail is required' }, { status: 400 });

    const [analyses, branding] = await Promise.all([
      base44.asServiceRole.entities.Analysis.filter({ id: analysisId }),
      resolveBranding(base44, analysisId),
    ]);

    const analysis = analyses[0];
    if (!analysis) return Response.json({ error: 'Analysis not found' }, { status: 404 });

    const address = analysis.intake_data?.address || 'Property Analysis';
    const subject = customSubject || `PropPrompt Analysis — ${address}`;
    const assessmentLabel = ASSESSMENT_LABELS[analysis.assessment_type] || 'Analysis';
    const outputSnippet = (analysis.output_text || '').substring(0, 700);

    const html = buildEmailHtml({ branding, assessmentLabel, address, outputSnippet });

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: toEmail,
      subject,
      body: html,
      from_name: branding.org_name || branding.agent_name || 'PropPrompt Analysis',
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('sendAnalysisEmail error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function resolveBranding(base44, analysisId) {
  const analyses = await base44.asServiceRole.entities.Analysis.filter({ id: analysisId });
  const analysis = analyses[0];
  if (!analysis) throw new Error('Analysis not found');

  const orgs = await base44.asServiceRole.entities.Organization.filter({ id: analysis.org_id });
  const org = orgs[0] || {};

  let brokerageOrg = org;
  if (org.org_type === 'team' && org.parent_org_id) {
    const parents = await base44.asServiceRole.entities.Organization.filter({ id: org.parent_org_id });
    brokerageOrg = parents[0] || org;
  }

  const [bbArr, tbArr, abArr, users] = await Promise.all([
    base44.asServiceRole.entities.OrgBranding.filter({ org_id: brokerageOrg.id }),
    org.org_type === 'team'
      ? base44.asServiceRole.entities.OrgBranding.filter({ org_id: analysis.org_id })
      : Promise.resolve([]),
    base44.asServiceRole.entities.AgentBranding.filter({ user_email: analysis.run_by_email }),
    base44.asServiceRole.entities.User.filter({ email: analysis.run_by_email }),
  ]);

  const bb = bbArr[0] || {}; const tb = tbArr[0] || {};
  const ab = abArr[0] || {}; const au = users[0] || {};

  return {
    org_name:         tb.org_name        || bb.org_name        || org.name         || '',
    org_logo_url:     tb.logo_url         || bb.logo_url         || null,
    org_address:      tb.address          || bb.address          || '',
    org_phone:        tb.phone            || bb.phone            || '',
    org_website:      tb.website          || bb.website          || '',
    primary_color:    tb.primary_color    || bb.primary_color    || '#333333',
    accent_color:     tb.accent_color     || bb.accent_color     || '#666666',
    background_color: tb.background_color || bb.background_color || '#FFFFFF',
    agent_name:       ab.display_name     || au.full_name        || analysis.run_by_email,
    agent_title:      ab.title            || '',
    agent_phone:      ab.direct_phone     || '',
    agent_email:      ab.direct_email     || analysis.run_by_email,
    agent_license:    ab.license_number   || '',
    agent_tagline:    ab.personal_tagline || '',
    agent_headshot_url: ab.headshot_url   || null,
    signature_style:  ab.signature_style  || 'name_title_contact',
  };
}

function buildEmailHtml({ branding, assessmentLabel, address, outputSnippet }) {
  const pri = branding.primary_color || '#333333';
  const acc = branding.accent_color  || '#666666';
  const bg  = branding.background_color || '#FFFFFF';
  const style = branding.signature_style || 'name_title_contact';

  const logoHtml = branding.org_logo_url
    ? `<td style="padding:0 16px 0 0"><img src="${branding.org_logo_url}" alt="" height="44" style="max-height:44px;vertical-align:middle" /></td>`
    : '';

  const headshotHtml = (style === 'full_with_headshot' && branding.agent_headshot_url)
    ? `<img src="${branding.agent_headshot_url}" width="48" height="48" style="border-radius:50%;float:left;margin-right:12px" />`
    : '';

  const sigLines = [];
  sigLines.push(`<p style="font-weight:bold;color:#1A1A1A;font-size:14px;margin:0 0 2px">${branding.agent_name || ''}</p>`);
  if (style !== 'name_only' && branding.agent_title) sigLines.push(`<p style="color:#555;font-size:12px;margin:0 0 2px">${branding.agent_title}</p>`);
  if (['name_title_contact','full_with_headshot'].includes(style)) {
    const c = [branding.agent_phone, branding.agent_email].filter(Boolean).join('  |  ');
    if (c) sigLines.push(`<p style="color:#555;font-size:12px;margin:0 0 2px">${c}</p>`);
    if (branding.agent_license) sigLines.push(`<p style="color:#888;font-size:11px;margin:0">License: ${branding.agent_license}</p>`);
  }
  if (branding.agent_tagline) sigLines.push(`<p style="color:#999;font-size:11px;font-style:italic;margin:4px 0 0">${branding.agent_tagline}</p>`);

  const snippetClean = outputSnippet.replace(/\*\*/g,'').replace(/\*/g,'').replace(/\n/g,'<br>').substring(0, 600);
  const footerInfo = [branding.org_address, branding.org_phone, branding.org_website].filter(Boolean).join('  ·  ');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F5F5F5;font-family:Arial,Helvetica,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F5">
<tr><td align="center" style="padding:20px 10px">
<table cellpadding="0" cellspacing="0" style="background:#FFFFFF;max-width:600px;width:100%">

  <!-- HEADER -->
  <tr><td style="background:${pri};padding:14px 20px">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      ${logoHtml}
      <td style="color:#FFFFFF;font-size:15px;font-weight:bold;font-family:Georgia,serif;${branding.org_logo_url ? 'text-align:right' : 'text-align:center'}">${branding.org_name || ''}</td>
    </tr></table>
  </td></tr>

  <!-- ACCENT LINE -->
  <tr><td style="background:${acc};height:3px;font-size:1px;line-height:1px">&nbsp;</td></tr>

  <!-- BODY -->
  <tr><td style="padding:28px 32px;background:${bg}">
    <h1 style="color:${pri};font-family:Georgia,serif;font-size:20px;margin:0 0 6px">${assessmentLabel}</h1>
    <p style="color:#888;font-size:13px;margin:0 0 20px">${address}</p>

    <div style="background:#F9F9F9;border-left:4px solid ${acc};padding:14px 18px;margin-bottom:24px;border-radius:0 4px 4px 0">
      <p style="color:#1A1A1A;font-size:13px;line-height:1.65;margin:0">${snippetClean}…</p>
    </div>

    <p style="text-align:center;margin:28px 0 8px">
      <a style="background:${pri};color:#FFFFFF;text-decoration:none;padding:11px 28px;border-radius:5px;font-size:14px;font-weight:bold;display:inline-block">View Full Analysis in PropPrompt</a>
    </p>
  </td></tr>

  <!-- SIGNATURE -->
  <tr><td style="padding:16px 32px 20px;border-top:2px solid ${acc}">
    ${headshotHtml}
    ${sigLines.join('')}
    <div style="clear:both"></div>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background:#F5F5F5;padding:14px 32px;text-align:center;border-top:1px solid #E0E0E0">
    ${footerInfo ? `<p style="color:#999;font-size:11px;margin:0 0 4px">${footerInfo}</p>` : ''}
    <p style="color:#CCC;font-size:10px;margin:0 0 4px">Sent via PropPrompt™</p>
    <p style="color:#CCC;font-size:10px;margin:0"><a href="#" style="color:#CCC;text-decoration:underline">Unsubscribe</a></p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;
}