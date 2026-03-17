import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { jsPDF } from 'npm:jspdf@4.0.0';

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

    const { analysisId, format = 'pdf', email_to, email_subject } = await req.json();

    const [analyses, branding] = await Promise.all([
      base44.asServiceRole.entities.Analysis.filter({ id: analysisId }),
      resolveBranding(base44, analysisId),
    ]);

    const analysis = analyses[0];
    if (!analysis) return Response.json({ error: 'Analysis not found' }, { status: 404 });

    const now = new Date().toISOString();

    if (format === 'pdf') {
      const url = await generateAndStore(base44, analysis, branding, analysisId, 'pdf', user.email);
      await base44.asServiceRole.entities.Analysis.update(analysisId, {
        output_pdf_url: url,
        pdf_url: url,
        last_exported_at: now,
        last_export_format: 'pdf',
      });
      return Response.json({ success: true, url, format: 'pdf' });
    }

    if (format === 'pptx') {
      const url = await generateAndStore(base44, analysis, branding, analysisId, 'pptx', user.email);
      await base44.asServiceRole.entities.Analysis.update(analysisId, {
        output_pptx_url: url,
        pptx_url: url,
        last_exported_at: now,
        last_export_format: 'pptx',
      });
      return Response.json({ success: true, url, format: 'pptx' });
    }

    if (format === 'email') {
      if (!email_to) return Response.json({ error: 'email_to is required' }, { status: 400 });
      await sendAnalysisEmail(base44, analysis, branding, analysisId, email_to, email_subject);
      await base44.asServiceRole.entities.Analysis.update(analysisId, {
        last_exported_at: now,
        last_export_format: 'email',
      });
      return Response.json({ success: true, format: 'email', sent_to: email_to });
    }

    return Response.json({ error: 'Invalid format. Use pdf, pptx, or email.' }, { status: 400 });
  } catch (error) {
    console.error('generateDocuments error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// ─── Generate file and store (Drive if connected, else UploadFile) ───────────
async function generateAndStore(base44, analysis, branding, analysisId, format, userEmail) {
  // Check Drive connection for auto-sync
  const driveConns = await base44.asServiceRole.entities.DriveConnection.filter({
    user_email: userEmail,
    status: 'connected',
  });
  const drive = driveConns[0];
  const autoSync = drive && (format === 'pdf' ? drive.auto_sync_pdf : drive.auto_sync_pptx);

  // Generate file bytes
  const { bytes, mimeType, filename } = format === 'pdf'
    ? await buildPDF(analysis, branding, analysisId)
    : await buildPPTX(analysis, branding, analysisId);

  if (autoSync) {
    // Upload to Drive via driveSync function
    console.log(`Auto-syncing ${format} to Google Drive for ${userEmail}`);
    const res = await base44.asServiceRole.functions.invoke('driveSync', { analysisId, format });
    if (res?.driveUrl) {
      await base44.asServiceRole.entities.Analysis.update(analysisId, {
        drive_url: res.driveUrl,
        drive_sync_status: 'synced',
        drive_file_id: res.driveFileId || null,
      });
      return res.driveUrl;
    }
  }

  // Fallback: upload to platform storage
  const blob = new Blob([bytes], { type: mimeType });
  const file = new File([blob], filename, { type: mimeType });
  const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file });
  return file_url;
}

// ─── Email sender ─────────────────────────────────────────────────────────────
async function sendAnalysisEmail(base44, analysis, branding, analysisId, emailTo, emailSubject) {
  const assessLabel = ASSESSMENT_LABELS[analysis.assessment_type] || 'Analysis';
  const subject = emailSubject || `${assessLabel}${analysis.intake_data?.address ? ` — ${analysis.intake_data.address}` : ''}`;
  const agentName = branding.agent_name || '';
  const orgName = branding.org_name || '';
  const primaryColor = branding.primary_color || '#333333';

  const body = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
        <!-- Header -->
        <tr><td style="background:${primaryColor};padding:24px 32px;">
          <p style="margin:0;color:#ffffff;font-size:20px;font-weight:bold;">${orgName}</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px;">
          <h2 style="color:${primaryColor};margin:0 0 8px;">${assessLabel}</h2>
          ${analysis.intake_data?.address ? `<p style="color:#666;margin:0 0 24px;font-size:14px;">${analysis.intake_data.address}</p>` : ''}
          <div style="color:#333;font-size:14px;line-height:1.7;white-space:pre-wrap;">${(analysis.output_text || '').substring(0, 3000)}${(analysis.output_text || '').length > 3000 ? '\n\n[Full report available on request]' : ''}</div>
        </td></tr>
        <!-- Signature -->
        <tr><td style="padding:0 32px 16px;border-top:1px solid #eee;">
          <p style="margin:16px 0 4px;font-weight:bold;color:#333;">${agentName}</p>
          ${branding.agent_title ? `<p style="margin:0 0 4px;color:#666;font-size:13px;">${branding.agent_title}</p>` : ''}
          ${branding.agent_phone || branding.agent_email ? `<p style="margin:0;color:#666;font-size:13px;">${[branding.agent_phone, branding.agent_email].filter(Boolean).join('  |  ')}</p>` : ''}
          ${branding.agent_license ? `<p style="margin:4px 0 0;color:#999;font-size:12px;">License: ${branding.agent_license}</p>` : ''}
        </td></tr>
        <!-- Disclaimer -->
        <tr><td style="padding:16px 32px;background:#f9f9f9;border-top:1px solid #eee;">
          <p style="margin:0;color:#999;font-size:11px;line-height:1.5;">This AI-generated analysis is provided for informational purposes only and does not constitute legal, financial, or professional real estate advice. All valuations and recommendations should be verified by a licensed real estate professional. PropPrompt™.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await base44.asServiceRole.integrations.Core.SendEmail({
    from_name: agentName || orgName || 'PropPrompt',
    to: emailTo,
    subject,
    body,
  });

  // Log the send
  await base44.asServiceRole.entities.AnalysisEmail.create({
    analysis_id: analysisId,
    sent_to: emailTo,
    subject,
    sent_at: new Date().toISOString(),
    included_pdf: false,
  });

  console.log(`Email sent to ${emailTo} for analysis ${analysisId}`);
}

// ─── Branding resolution (inline) ────────────────────────────────────────────
async function resolveBranding(base44, analysisId) {
  const analyses = await base44.asServiceRole.entities.Analysis.filter({ id: analysisId });
  const analysis = analyses[0];
  if (!analysis) throw new Error('Analysis not found');

  const agentEmail = analysis.on_behalf_of_email || analysis.run_by_email;
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
    base44.asServiceRole.entities.AgentBranding.filter({ user_email: agentEmail }),
    base44.asServiceRole.entities.User.filter({ email: agentEmail }),
  ]);

  const bb = bbArr[0] || {}; const tb = tbArr[0] || {};
  const ab = abArr[0] || {}; const au = users[0] || {};

  return {
    org_name:         tb.org_name        || bb.org_name        || org.name         || '',
    org_logo_url:     tb.logo_url         || bb.logo_url         || null,
    org_tagline:      tb.tagline          || bb.tagline          || '',
    org_address:      tb.address          || bb.address          || '',
    org_phone:        tb.phone            || bb.phone            || '',
    org_website:      tb.website          || bb.website          || '',
    primary_color:    tb.primary_color    || bb.primary_color    || '#333333',
    accent_color:     tb.accent_color     || bb.accent_color     || '#666666',
    background_color: tb.background_color || bb.background_color || '#FFFFFF',
    agent_name:       ab.display_name     || au.full_name        || agentEmail,
    agent_title:      ab.title            || '',
    agent_phone:      ab.direct_phone     || '',
    agent_email:      ab.direct_email     || agentEmail,
    agent_license:    ab.license_number   || '',
    agent_tagline:    ab.personal_tagline || '',
    agent_headshot_url: ab.headshot_url   || null,
    signature_style:  ab.signature_style  || 'name_title_contact',
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function hexToRgb(hex) {
  const h = (hex || '#333333').replace('#', '');
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}

function parseSections(text) {
  const sections = [];
  let cur = null;
  for (const line of text.split('\n')) {
    const m = line.match(/^#{1,2}\s+(.+)/);
    if (m) {
      if (cur) sections.push(cur);
      cur = { title: m[1], body: '' };
    } else if (cur) {
      cur.body += line + '\n';
    } else if (line.trim()) {
      cur = { title: 'Overview', body: line + '\n' };
    }
  }
  if (cur) sections.push(cur);
  return sections.length ? sections : [{ title: 'Analysis', body: text }];
}

// ─── PDF builder ─────────────────────────────────────────────────────────────
async function buildPDF(analysis, b, analysisId) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pageW = 215.9, pageH = 279.4;
  const mL = 19.05, mR = 19.05, mT = 19.05, mB = 21.59;
  const cW = pageW - mL - mR;
  const primary = hexToRgb(b.primary_color);
  const accent  = hexToRgb(b.accent_color);

  function drawHeader() {
    doc.setFillColor(...primary);
    doc.rect(0, 0, pageW, 18, 'F');
    doc.setFillColor(...accent);
    doc.rect(0, 18, pageW, 0.8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(b.org_name || 'Real Estate Analysis', pageW / 2, 11.5, { align: 'center' });
    doc.setTextColor(26, 26, 26);
  }

  function drawFooter(pageNum, total) {
    const fy = pageH - mB + 3;
    doc.setDrawColor(...accent);
    doc.setLineWidth(0.3);
    doc.line(mL, fy, pageW - mR, fy);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(102, 102, 102);
    const left = [b.org_name, b.org_phone, b.org_website].filter(Boolean).join('  |  ');
    doc.text(left, mL, fy + 4);
    doc.text(`Page ${pageNum} of ${total}`, pageW / 2, fy + 4, { align: 'center' });
    doc.setTextColor(153, 153, 153);
    doc.text('Prepared by PropPrompt™', pageW - mR, fy + 4, { align: 'right' });
    doc.setTextColor(26, 26, 26);
  }

  function checkNewPage(y, neededHeight = 8) {
    if (y + neededHeight > pageH - mB - 10) {
      doc.addPage();
      drawHeader();
      return mT + 6;
    }
    return y;
  }

  drawHeader();
  let y = mT + 6;

  doc.setFontSize(16); doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primary);
  doc.text(ASSESSMENT_LABELS[analysis.assessment_type] || 'Analysis', mL, y); y += 8;

  if (analysis.intake_data?.address) {
    doc.setFontSize(11); doc.setFont('helvetica', 'normal');
    doc.setTextColor(102, 102, 102);
    doc.text(analysis.intake_data.address, mL, y); y += 6;
  }

  doc.setFontSize(9);
  doc.setTextColor(102, 102, 102);
  doc.text(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), mL, y);
  y += 8;

  doc.setDrawColor(...accent); doc.setLineWidth(0.5);
  doc.line(mL, y, pageW - mR, y); y += 6;

  const outputText = analysis.output_text || '';
  for (const line of outputText.split('\n')) {
    const t = line.trim();
    if (!t || t === '---') { y += 2; continue; }

    if (/^#{1,2}\s/.test(t)) {
      const txt = t.replace(/^#+\s/, '');
      y = checkNewPage(y, 10); y += 3;
      doc.setFontSize(13); doc.setFont('helvetica', 'bold');
      doc.setTextColor(...primary);
      doc.text(txt, mL, y); y += 7;
      doc.setTextColor(26, 26, 26);
    } else if (/^###\s/.test(t)) {
      const txt = t.replace(/^###\s/, '');
      y = checkNewPage(y, 8); y += 2;
      doc.setFontSize(10.5); doc.setFont('helvetica', 'bold');
      doc.setTextColor(...primary);
      doc.text(txt, mL, y); y += 5;
      doc.setTextColor(26, 26, 26);
    } else {
      doc.setFontSize(10); doc.setFont('helvetica', 'normal');
      doc.setTextColor(26, 26, 26);
      const clean = t.replace(/\*\*/g, '').replace(/\*/g, '');
      const wrapped = doc.splitTextToSize(clean, cW);
      for (const wl of wrapped) {
        y = checkNewPage(y, 6);
        doc.text(wl, mL, y); y += 5.5;
      }
    }
  }

  // Signature block
  y = checkNewPage(y, 40); y += 6;
  doc.setDrawColor(...accent); doc.setLineWidth(0.5);
  doc.line(mL, y, pageW - mR, y); y += 7;

  doc.setFontSize(10.5); doc.setFont('helvetica', 'bold');
  doc.setTextColor(26, 26, 26);
  doc.text(b.agent_name || '', mL, y); y += 5.5;

  const style = b.signature_style || 'name_title_contact';
  if (style !== 'name_only' && b.agent_title) {
    doc.setFontSize(9.5); doc.setFont('helvetica', 'normal');
    doc.text(b.agent_title, mL, y); y += 5;
  }
  if (['name_title_contact', 'full_with_headshot'].includes(style)) {
    const contact = [b.agent_phone, b.agent_email].filter(Boolean).join('  |  ');
    if (contact) { doc.setFontSize(9); doc.text(contact, mL, y); y += 4.5; }
    if (b.agent_license) { doc.text(`License: ${b.agent_license}`, mL, y); y += 4.5; }
  }

  y += 4;
  doc.setFillColor(...accent); doc.rect(mL, y, cW, 0.3, 'F'); y += 5;
  const disc = 'DISCLAIMER: This AI-generated analysis is provided for informational purposes only and does not constitute legal, financial, or professional real estate advice. All valuations and recommendations should be verified by a licensed real estate professional. PropPrompt™ analyses are tools to augment, not replace, professional judgment.';
  doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
  doc.setTextColor(102, 102, 102);
  doc.text(doc.splitTextToSize(disc, cW), mL, y);

  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) { doc.setPage(p); drawFooter(p, total); }

  const bytes = new Uint8Array(doc.output('arraybuffer'));
  return {
    bytes,
    mimeType: 'application/pdf',
    filename: `analysis-${analysisId}-${Date.now()}.pdf`,
  };
}

// ─── PPTX builder ────────────────────────────────────────────────────────────
async function buildPPTX(analysis, b, analysisId) {
  const PptxGenJS = (await import('npm:pptxgenjs@3.12.0')).default;
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'LETTER_LANDSCAPE', width: 11, height: 8.5 });
  pptx.layout = 'LETTER_LANDSCAPE';

  const pri = (b.primary_color || '#333333').replace('#', '');
  const acc = (b.accent_color  || '#666666').replace('#', '');
  const bg  = (b.background_color || '#FFFFFF').replace('#', '');
  const orgName = b.org_name || 'Real Estate Analysis';
  const address = analysis.intake_data?.address || '';
  const assessLabel = ASSESSMENT_LABELS[analysis.assessment_type] || 'Analysis';
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const cover = pptx.addSlide();
  cover.background = { color: pri };
  cover.addText(orgName, { x: 0.5, y: 1.2, w: 10, h: 1.2, fontSize: 32, bold: true, color: 'FFFFFF', fontFace: 'Georgia', align: 'center' });
  if (address) cover.addText(address, { x: 0.5, y: 2.8, w: 10, h: 0.6, fontSize: 18, color: 'FFFFFF', fontFace: 'Calibri', align: 'center' });
  cover.addText(assessLabel.toUpperCase(), { x: 3.5, y: 3.7, w: 4, h: 0.4, fontSize: 10, bold: true, color: 'FFFFFF', fill: { color: acc }, align: 'center' });
  cover.addText(`${b.agent_name || ''}  |  ${dateStr}`, { x: 0.5, y: 5.5, w: 10, h: 0.4, fontSize: 11, color: 'FFFFFF', fontFace: 'Calibri', align: 'center' });

  const sections = parseSections(analysis.output_text || '');

  for (const section of sections) {
    const div = pptx.addSlide();
    div.background = { color: pri };
    div.addText(section.title, { x: 0.5, y: 2.5, w: 10, h: 1.2, fontSize: 28, bold: true, color: 'FFFFFF', fontFace: 'Georgia', align: 'left' });

    const cs = pptx.addSlide();
    cs.background = { color: bg };
    cs.addShape('rect', { x: 0, y: 0, w: 11, h: 0.12, fill: { color: pri } });
    cs.addText(section.title, { x: 0.4, y: 0.25, w: 10.2, h: 0.6, fontSize: 20, bold: true, color: pri, fontFace: 'Georgia' });
    if (section.body) {
      cs.addText(section.body.replace(/\*\*/g, '').replace(/\*/g, '').substring(0, 900), {
        x: 0.4, y: 1.0, w: 10.2, h: 6.2,
        fontSize: 10.5, color: '1A1A1A', fontFace: 'Calibri', valign: 'top', wrap: true,
      });
    }
    cs.addShape('rect', { x: 0, y: 8.25, w: 11, h: 0.25, fill: { color: pri } });
    cs.addText(orgName, { x: 0.1, y: 8.27, w: 8, h: 0.2, fontSize: 8, color: 'FFFFFF', fontFace: 'Calibri' });
  }

  const fin = pptx.addSlide();
  fin.background = { color: pri };
  fin.addText(b.agent_name || '', { x: 0.5, y: 2.5, w: 10, h: 0.8, fontSize: 20, bold: true, color: 'FFFFFF', fontFace: 'Georgia', align: 'center' });
  if (b.agent_title) fin.addText(b.agent_title, { x: 0.5, y: 3.4, w: 10, h: 0.4, fontSize: 13, color: 'FFFFFF', fontFace: 'Calibri', align: 'center' });
  const contact = [b.agent_phone, b.agent_email].filter(Boolean).join('  |  ');
  if (contact) fin.addText(contact, { x: 0.5, y: 3.9, w: 10, h: 0.4, fontSize: 11, color: 'FFFFFF', fontFace: 'Calibri', align: 'center' });
  if (b.agent_tagline) fin.addText(b.agent_tagline, { x: 0.5, y: 4.4, w: 10, h: 0.4, fontSize: 11, italic: true, color: 'FFFFFF', fontFace: 'Calibri', align: 'center' });
  if (b.org_address || b.org_website) {
    const foot = [b.org_address, b.org_website].filter(Boolean).join('  ·  ');
    fin.addText(foot, { x: 0.5, y: 7.8, w: 10, h: 0.3, fontSize: 9, color: 'CCCCCC', fontFace: 'Calibri', align: 'center' });
  }

  const pptxBase64 = await pptx.write({ outputType: 'base64' });
  const pptxBytes = Uint8Array.from(atob(pptxBase64), c => c.charCodeAt(0));
  const mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

  return {
    bytes: pptxBytes,
    mimeType,
    filename: `analysis-${analysisId}-${Date.now()}.pptx`,
  };
}