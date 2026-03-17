import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * generateDocuments — export orchestrator
 * POST body: { analysisId, format: 'pdf' | 'pptx' | 'email', email_to?, email_subject? }
 *
 * Steps:
 *  1. Resolve branding via resolveBranding function
 *  2. Generate document bytes via format-specific generator
 *  3. Upload to Drive (if connected + auto_sync) or Base44 storage
 *  4. Update analysis record with URL + metadata
 *  5. Return { url, format }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { analysisId, format, email_to, email_subject } = await req.json();
    if (!analysisId) return Response.json({ error: 'analysisId required' }, { status: 400 });
    if (!['pdf', 'pptx', 'email'].includes(format)) {
      return Response.json({ error: 'format must be pdf, pptx, or email' }, { status: 400 });
    }

    // Tier enforcement: PPTX requires Pro or Team plan
    if (format === 'pptx') {
      const memberships = await base44.asServiceRole.entities.OrgMembership.filter({ user_email: user.email, status: 'active' });
      if (memberships.length > 0) {
        const orgId = memberships[0].org_id;
        const orgs = await base44.asServiceRole.entities.Organization.filter({ id: orgId });
        const org = orgs[0];
        const allowedPlans = ['team', 'brokerage', 'enterprise'];
        if (!org || !allowedPlans.includes(org.subscription_plan)) {
          console.warn(`[generateDocuments] PPTX blocked for user ${user.email} — plan: ${org?.subscription_plan}`);
          return Response.json({ error: 'PPTX export requires a Pro or Team plan. Please upgrade to access this feature.' }, { status: 403 });
        }
      }
    }

    // 1. Resolve branding
    const brandingRes = await base44.functions.invoke('resolveBranding', { analysisId });
    const branding = brandingRes?.data?.branding;
    if (!branding) throw new Error('Failed to resolve branding');

    // 2. Load analysis for content
    const analyses = await base44.asServiceRole.entities.Analysis.filter({ id: analysisId });
    const analysis = analyses[0];
    if (!analysis) return Response.json({ error: 'Analysis not found' }, { status: 404 });

    const now = new Date().toISOString();

    // 3. Dispatch by format
    if (format === 'email') {
      return await handleEmail(base44, analysis, branding, email_to, email_subject, now);
    }

    // PDF or PPTX — generate bytes then store
    const { bytes, mimeType, filename } = await generateDocument(base44, analysis, branding, format);

    // 4. Check if Drive is connected with auto-sync enabled
    const driveConnections = await base44.asServiceRole.entities.DriveConnection.filter({
      user_email: user.email,
      status: 'connected',
    });
    const drive = driveConnections[0];
    const useDrive = drive && ((format === 'pdf' && drive.auto_sync_pdf) || (format === 'pptx' && drive.auto_sync_pptx));

    let fileUrl = null;
    let driveUrl = null;

    if (useDrive) {
      // Upload to Google Drive via driveUpload function
      const driveRes = await base44.functions.invoke('driveUpload', {
        analysisId,
        filename,
        mimeType,
        bytesBase64: btoa(String.fromCharCode(...new Uint8Array(bytes))),
        folderId: drive.root_folder_id,
      });
      driveUrl = driveRes?.data?.driveUrl || null;
      fileUrl = driveUrl;
    } else {
      // Upload to Base44 storage
      const blob = new Blob([bytes], { type: mimeType });
      const file = new File([blob], filename, { type: mimeType });
      const uploadRes = await base44.asServiceRole.integrations.Core.UploadFile({ file });
      fileUrl = uploadRes?.file_url || null;
    }

    if (!fileUrl) throw new Error('File upload failed — no URL returned');

    // 5. Update analysis record
    const updateData = {
      last_exported_at: now,
      last_export_format: format,
    };
    if (format === 'pdf') updateData.output_pdf_url = fileUrl;
    if (format === 'pptx') updateData.output_pptx_url = fileUrl;
    if (driveUrl) {
      updateData.drive_url = driveUrl;
      updateData.drive_sync_status = 'synced';
    }

    await base44.asServiceRole.entities.Analysis.update(analysisId, updateData);

    console.log(`[generateDocuments] ${format} generated for analysis ${analysisId}, url: ${fileUrl}`);
    return Response.json({ url: fileUrl, format });

  } catch (err) {
    console.error('[generateDocuments] error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});

// ─── Format Dispatchers ────────────────────────────────────────────────────

async function generateDocument(base44, analysis, branding, format) {
  if (format === 'pdf') {
    return await generatePdf(base44, analysis, branding);
  } else if (format === 'pptx') {
    return await generatePptx(base44, analysis, branding);
  }
  throw new Error(`Unknown format: ${format}`);
}

/**
 * PDF generator — uses jsPDF to produce a branded PDF.
 * Section 6 will expand this with full layout.
 */
async function generatePdf(base44, analysis, branding) {
  const { jsPDF } = await import('npm:jspdf@2.5.2');
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });

  const primaryColor = hexToRgb(branding.primary_color || '#333333');
  const accentColor = hexToRgb(branding.accent_color || '#666666');
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header bar
  doc.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
  doc.rect(0, 0, pageWidth, 70, 'F');

  // Org name in header
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(branding.org_name || 'Analysis Report', 40, 44);

  if (branding.org_tagline) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(branding.org_tagline, 40, 58);
  }

  // Assessment type title
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  const assessmentLabel = ASSESSMENT_LABELS[analysis.assessment_type] || 'Analysis';
  doc.text(assessmentLabel, 40, 105);

  if (analysis.intake_data?.address) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(analysis.intake_data.address, 40, 121);
  }

  // Divider
  doc.setDrawColor(accentColor.r, accentColor.g, accentColor.b);
  doc.setLineWidth(1);
  doc.line(40, 132, pageWidth - 40, 132);

  // Body — analysis output text
  const outputText = analysis.output_text || '(No output available)';
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(50, 50, 50);

  const splitText = doc.splitTextToSize(outputText, pageWidth - 80);
  let y = 152;
  const lineHeight = 14;
  const pageHeight = doc.internal.pageSize.getHeight();
  const bottomMargin = 80;

  for (const line of splitText) {
    if (y + lineHeight > pageHeight - bottomMargin) {
      doc.addPage();
      y = 60;
    }
    doc.text(line, 40, y);
    y += lineHeight;
  }

  // Footer — agent signature block
  addAgentFooter(doc, branding, pageWidth, pageHeight);

  const arrayBuffer = doc.output('arraybuffer');
  const address = analysis.intake_data?.address || analysisId;
  const safeFilename = `${assessmentLabel.replace(/\s+/g, '_')}_${Date.now()}.pdf`;

  return { bytes: arrayBuffer, mimeType: 'application/pdf', filename: safeFilename };
}

/**
 * PPTX generator — uses PptxGenJS.
 * Section 7 will expand this with full slide layouts.
 */
async function generatePptx(base44, analysis, branding) {
  const PptxGenJS = (await import('npm:pptxgenjs@3.12.0')).default;
  const pptx = new PptxGenJS();

  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = branding.agent_name || branding.org_name;
  pptx.company = branding.org_name;
  pptx.subject = ASSESSMENT_LABELS[analysis.assessment_type] || 'Analysis';

  const primary = branding.primary_color?.replace('#', '') || '333333';
  const accent = branding.accent_color?.replace('#', '') || '666666';

  // Title slide
  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: primary };
  titleSlide.addText(branding.org_name || 'Report', {
    x: 0.5, y: 1.2, w: 12, h: 0.8,
    fontSize: 36, bold: true, color: 'FFFFFF', align: 'left',
  });
  titleSlide.addText(ASSESSMENT_LABELS[analysis.assessment_type] || 'Analysis', {
    x: 0.5, y: 2.2, w: 12, h: 0.6,
    fontSize: 22, color: 'FFFFFF', align: 'left',
  });
  if (analysis.intake_data?.address) {
    titleSlide.addText(analysis.intake_data.address, {
      x: 0.5, y: 2.9, w: 12, h: 0.5,
      fontSize: 14, color: 'DDDDDD', align: 'left',
    });
  }

  // Content slides — split output text into ~400 char chunks per slide
  const outputText = analysis.output_text || '';
  const chunks = chunkText(outputText, 1200);
  for (let i = 0; i < chunks.length; i++) {
    const slide = pptx.addSlide();
    slide.background = { color: 'FFFFFF' };
    // Header bar
    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: '100%', h: 0.55,
      fill: { color: primary }, line: { color: primary },
    });
    slide.addText(`${branding.org_name || ''} — ${ASSESSMENT_LABELS[analysis.assessment_type] || ''}`, {
      x: 0.2, y: 0.08, w: 10, h: 0.4,
      fontSize: 11, color: 'FFFFFF', bold: true,
    });
    slide.addText(chunks[i], {
      x: 0.4, y: 0.75, w: 12.3, h: 5.8,
      fontSize: 11, color: '333333', align: 'left', valign: 'top', wrap: true,
    });
    // Footer
    slide.addText(`${branding.agent_name || ''} | ${branding.agent_phone || ''} | ${branding.agent_email || ''}`, {
      x: 0.4, y: 6.7, w: 12.3, h: 0.35,
      fontSize: 9, color: '888888',
    });
  }

  const buffer = await pptx.write({ outputType: 'arraybuffer' });
  const filename = `${(ASSESSMENT_LABELS[analysis.assessment_type] || 'Analysis').replace(/\s+/g, '_')}_${Date.now()}.pptx`;
  return {
    bytes: buffer,
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    filename,
  };
}

async function handleEmail(base44, analysis, branding, email_to, email_subject, now) {
  if (!email_to) return Response.json({ error: 'email_to is required for email format' }, { status: 400 });

  const subject = email_subject || `${ASSESSMENT_LABELS[analysis.assessment_type] || 'Analysis'} — ${analysis.intake_data?.address || ''}`;

  const body = buildEmailHtml(analysis, branding);

  await base44.asServiceRole.integrations.Core.SendEmail({
    to: email_to,
    subject,
    body,
    from_name: branding.agent_name || branding.org_name || 'PropPrompt',
  });

  // Log the email send
  await base44.asServiceRole.entities.AnalysisEmail.create({
    analysis_id: analysis.id,
    sent_to: email_to,
    sent_at: now,
    subject,
    included_pdf: !!(analysis.output_pdf_url),
  });

  // Update analysis export metadata
  await base44.asServiceRole.entities.Analysis.update(analysis.id, {
    last_exported_at: now,
    last_export_format: 'email',
  });

  console.log(`[generateDocuments] email sent to ${email_to} for analysis ${analysis.id}`);
  return Response.json({ success: true, sent_to: email_to });
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const ASSESSMENT_LABELS = {
  listing_pricing: 'Listing Pricing Analysis',
  buyer_intelligence: 'Buyer Intelligence Report',
  investment_analysis: 'Investment Analysis',
  cma: 'Comparative Market Analysis',
  rental_analysis: 'Rental Analysis',
};

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function addAgentFooter(doc, branding, pageWidth, pageHeight) {
  const style = branding.signature_style || 'name_title_contact';
  if (style === 'name_only' && !branding.agent_name) return;

  const footerY = pageHeight - 50;
  doc.setFillColor(245, 245, 245);
  doc.rect(0, footerY - 10, pageWidth, 60, 'F');

  doc.setTextColor(80, 80, 80);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(branding.agent_name || '', 40, footerY + 8);

  if (style !== 'name_only') {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const parts = [];
    if (branding.agent_title) parts.push(branding.agent_title);
    if (style === 'name_title_contact' || style === 'full_with_headshot') {
      if (branding.agent_phone) parts.push(branding.agent_phone);
      if (branding.agent_email) parts.push(branding.agent_email);
    }
    doc.text(parts.join('  |  '), 40, footerY + 20);
  }

  // Disclaimer
  doc.setFontSize(6.5);
  doc.setTextColor(150, 150, 150);
  const disclaimer = 'This AI-generated analysis is for informational purposes only and does not constitute legal, financial, or professional real estate advice. All valuations should be verified by a licensed professional.';
  const splitDisclaimer = doc.splitTextToSize(disclaimer, pageWidth - 80);
  doc.text(splitDisclaimer, 40, footerY + 34);
}

function chunkText(text, maxLen) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    chunks.push(text.slice(start, start + maxLen));
    start += maxLen;
  }
  return chunks.length ? chunks : [''];
}

function buildEmailHtml(analysis, branding) {
  const primary = branding.primary_color || '#333333';
  const accent = branding.accent_color || '#666666';
  const assessmentLabel = ASSESSMENT_LABELS[analysis.assessment_type] || 'Analysis';
  const address = analysis.intake_data?.address || '';
  const outputText = (analysis.output_text || '').replace(/\n/g, '<br>');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:Georgia,serif;background:#f8f8f8;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f8f8;padding:32px 0;">
    <tr><td align="center">
      <table width="640" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr><td style="background:${primary};padding:28px 36px;">
          ${branding.org_logo_url ? `<img src="${branding.org_logo_url}" height="44" style="display:block;margin-bottom:10px;" alt="${branding.org_name}">` : ''}
          <div style="color:#ffffff;font-size:20px;font-weight:bold;">${branding.org_name || ''}</div>
          ${branding.org_tagline ? `<div style="color:rgba(255,255,255,0.75);font-size:12px;margin-top:4px;">${branding.org_tagline}</div>` : ''}
        </td></tr>
        <!-- Subject bar -->
        <tr><td style="padding:20px 36px 12px;border-bottom:2px solid ${accent};">
          <div style="font-size:18px;font-weight:bold;color:#222;">${assessmentLabel}</div>
          ${address ? `<div style="font-size:13px;color:#777;margin-top:4px;">${address}</div>` : ''}
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:24px 36px;font-size:13px;color:#333;line-height:1.7;">
          ${outputText}
        </td></tr>
        <!-- Agent footer -->
        <tr><td style="padding:20px 36px;background:#f5f5f5;border-top:1px solid #e5e5e5;">
          ${branding.agent_headshot_url ? `<img src="${branding.agent_headshot_url}" width="48" height="48" style="border-radius:50%;float:left;margin-right:14px;" alt="${branding.agent_name}">` : ''}
          <div style="font-size:13px;font-weight:bold;color:#222;">${branding.agent_name || ''}</div>
          ${branding.agent_title ? `<div style="font-size:12px;color:#555;">${branding.agent_title}</div>` : ''}
          <div style="font-size:12px;color:#777;margin-top:4px;">
            ${[branding.agent_phone, branding.agent_email].filter(Boolean).join(' &nbsp;|&nbsp; ')}
          </div>
        </td></tr>
        <!-- Disclaimer -->
        <tr><td style="padding:14px 36px;background:#fafafa;">
          <p style="font-size:10px;color:#aaa;line-height:1.5;margin:0;">
            This AI-generated analysis is provided for informational purposes only and does not constitute legal, financial, or professional real estate advice. All valuations and recommendations should be verified by a licensed real estate professional.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}