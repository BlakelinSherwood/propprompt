import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ─── Shared color helper ───────────────────────────────────────────────────────
function lightenHex(hex, percent) {
  const clean = (hex || '#333333').replace('#', '');
  const num = parseInt(clean, 16);
  const r = Math.min(255, (num >> 16) + Math.round(((num >> 16) * percent) / 100));
  const g = Math.min(255, ((num >> 8) & 0x00FF) + Math.round((((num >> 8) & 0x00FF) * percent) / 100));
  const b = Math.min(255, (num & 0x0000FF) + Math.round(((num & 0x0000FF) * percent) / 100));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

/**
 * generateDocuments — export orchestrator
 * POST body: { analysisId, format: 'pdf' | 'pptx' | 'email', email_to?, email_subject? }
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

    // 1. Resolve branding — MUST happen before any PDF rendering
    const brandingRes = await base44.functions.invoke('resolveBranding', { analysisId });
    const branding = brandingRes?.data?.branding;
    if (!branding) throw new Error('Failed to resolve branding');

    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    branding.report_date = today;
    branding.generated_date = today;
    branding.agent_name = branding.agent_name || '';
    branding.agent_title = branding.agent_title || '';
    branding.agent_phone = branding.agent_phone || '';
    branding.agent_email = branding.agent_email || '';
    branding.org_name = branding.org_name || 'PropPrompt';
    branding.org_logo_url = branding.org_logo_url || '';
    branding.agent_headshot_url = branding.agent_headshot_url || '';

    console.log('[PropPrompt PDF] Branding resolved:', { analysis_id: analysisId, agent_name: branding.agent_name, org_name: branding.org_name, primary_color: branding.primary_color, accent_color: branding.accent_color, has_logo: !!branding.org_logo_url, has_headshot: !!branding.agent_headshot_url, resolution_source: branding.resolution_source });

    // 2. Load analysis for content
    const analyses = await base44.asServiceRole.entities.Analysis.filter({ id: analysisId });
    const analysis = analyses[0];
    if (!analysis) return Response.json({ error: 'Analysis not found' }, { status: 404 });

    const now = new Date().toISOString();

    // 3. Dispatch by format
    if (format === 'email') {
      return await handleEmail(base44, analysis, branding, email_to, email_subject, now);
    }

    if (format === 'pptx') {
      const pptxRes = await base44.functions.invoke('generatePptx', { analysisId, branding });
      const pptxUrl = pptxRes?.data?.url;
      if (!pptxUrl) throw new Error('PPTX generation failed');
      await base44.asServiceRole.entities.Analysis.update(analysisId, {
        output_pptx_url: pptxUrl,
        pptx_url: pptxUrl,
        last_exported_at: now,
        last_export_format: 'pptx',
      });
      return Response.json({ url: pptxUrl, format: 'pptx' });
    }

    // PDF
    branding.primary_color_light = lightenHex(branding.primary_color || '#1A3226', 15);
    const { bytes, mimeType, filename } = await generateDocument(base44, analysis, branding, format);

    // Check Drive connection
    const driveConnections = await base44.asServiceRole.entities.DriveConnection.filter({
      user_email: user.email,
      status: 'connected',
    });
    const drive = driveConnections[0];
    const useDrive = drive && ((format === 'pdf' && drive.auto_sync_pdf) || (format === 'pptx' && drive.auto_sync_pptx));

    let fileUrl = null;
    let driveUrl = null;

    if (useDrive) {
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
      const blob = new Blob([bytes], { type: mimeType });
      const file = new File([blob], filename, { type: mimeType });
      const uploadRes = await base44.asServiceRole.integrations.Core.UploadFile({ file });
      fileUrl = uploadRes?.file_url || null;
    }

    if (!fileUrl) throw new Error('File upload failed — no URL returned');

    const updateData = { last_exported_at: now, last_export_format: format };
    if (format === 'pdf') updateData.output_pdf_url = fileUrl;
    if (format === 'pptx') updateData.output_pptx_url = fileUrl;
    if (driveUrl) { updateData.drive_url = driveUrl; updateData.drive_sync_status = 'synced'; }

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
  if (format === 'pdf') return await generatePdf(base44, analysis, branding);
  throw new Error(`Unknown format: ${format}`);
}

async function generatePdf(base44, analysis, branding) {
  const { jsPDF } = await import('npm:jspdf@2.5.2');
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });

  if (analysis.output_json) {
    if (analysis.assessment_type === 'cma') {
      await renderCMAPdf(doc, analysis.output_json, branding);
    } else if (analysis.assessment_type === 'listing_pricing') {
      await renderListingPricingPdf(doc, analysis.output_json, branding, analysis.net_proceeds_json);
    } else if (analysis.assessment_type === 'buyer_intelligence') {
      await renderBuyerIntelligencePdf(doc, analysis.output_json, branding);
    } else if (analysis.assessment_type === 'client_portfolio') {
      await renderClientPortfolioPdf(doc, analysis.output_json, branding);
    } else if (analysis.assessment_type === 'investment_analysis') {
      await renderInvestmentPdf(doc, analysis.output_json, branding);
    } else if (analysis.assessment_type === 'rental_analysis') {
      await renderRentalMarketPdf(doc, analysis.output_json, branding);
    } else {
      await renderFallbackTextPdf(doc, analysis, branding);
    }
  } else {
    await renderFallbackTextPdf(doc, analysis, branding);
  }

  const arrayBuffer = doc.output('arraybuffer');
  const assessmentLabel = ASSESSMENT_LABELS[analysis.assessment_type] || 'Analysis';
  const safeFilename = `${assessmentLabel.replace(/\s+/g, '_')}_${Date.now()}.pdf`;

  return { bytes: arrayBuffer, mimeType: 'application/pdf', filename: safeFilename };
}

async function renderFallbackTextPdf(doc, analysis, branding) {
  const primaryColor = hexToRgb(branding.primary_color || '#333333');
  const accentColor = hexToRgb(branding.accent_color || '#666666');
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
  doc.rect(0, 0, pageWidth, 70, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(branding.org_name || 'Analysis Report', 40, 44);

  if (branding.org_tagline) {
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text(branding.org_tagline, 40, 58);
  }

  doc.setTextColor(50, 50, 50);
  doc.setFontSize(14); doc.setFont('helvetica', 'bold');
  const assessmentLabel = ASSESSMENT_LABELS[analysis.assessment_type] || 'Analysis';
  doc.text(assessmentLabel, 40, 105);

  if (analysis.intake_data?.address) {
    doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 100, 100);
    doc.text(analysis.intake_data.address, 40, 121);
  }

  doc.setDrawColor(accentColor.r, accentColor.g, accentColor.b);
  doc.setLineWidth(1);
  doc.line(40, 132, pageWidth - 40, 132);

  const outputText = analysis.output_text || '(No output available)';
  doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(50, 50, 50);
  const splitText = doc.splitTextToSize(outputText, pageWidth - 80);
  let y = 152;
  const lineHeight = 14;
  const pageHeight = doc.internal.pageSize.getHeight();
  const bottomMargin = 80;

  for (const line of splitText) {
    if (y + lineHeight > pageHeight - bottomMargin) { doc.addPage(); y = 60; }
    doc.text(line, 40, y);
    y += lineHeight;
  }

  await addAgentFooter(doc, branding, pageWidth, pageHeight);
}

async function handleEmail(base44, analysis, branding, email_to, email_subject, now) {
  if (!email_to) return Response.json({ error: 'email_to is required for email format' }, { status: 400 });

  const subject = email_subject || `${ASSESSMENT_LABELS[analysis.assessment_type] || 'Analysis'} — ${analysis.intake_data?.address || ''}`;
  const body = buildEmailHtml(analysis, branding);

  await base44.asServiceRole.integrations.Core.SendEmail({
    to: email_to, subject, body,
    from_name: branding.agent_name || branding.org_name || 'PropPrompt',
  });

  await base44.asServiceRole.entities.AnalysisEmail.create({
    analysis_id: analysis.id, sent_to: email_to, sent_at: now, subject,
    included_pdf: !!(analysis.output_pdf_url),
  });

  await base44.asServiceRole.entities.Analysis.update(analysis.id, {
    last_exported_at: now, last_export_format: 'email',
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

/**
 * addAgentFooter — draws agent signature block with headshot or initials circle.
 * Uses branding.agent_name, agent_title, agent_phone, agent_email, agent_headshot_url.
 * Circle background uses branding.primary_color; accent ring uses branding.accent_color.
 */
async function addAgentFooter(doc, branding, pageWidth, pageHeight) {
  const style = branding.signature_style || 'name_title_contact';
  if (style === 'name_only' && !branding.agent_name) return;

  const footerY = pageHeight - 50;
  const primary = hexToRgb(branding.primary_color || '#1A3226');
  const accent = hexToRgb(branding.accent_color || '#B8982F');

  doc.setFillColor(245, 245, 245);
  doc.rect(0, footerY - 10, pageWidth, 60, 'F');

  // Headshot or initials circle (right side)
  const circleX = pageWidth - 60;
  const circleY = footerY + 12;
  const circleR = 16;

  let headshotRendered = false;
  if (branding.agent_headshot_url) {
    try {
      const hsRes = await fetch(branding.agent_headshot_url);
      const hsBuffer = await hsRes.arrayBuffer();
      const hs64 = btoa(String.fromCharCode(...new Uint8Array(hsBuffer)));
      const hsExt = branding.agent_headshot_url.toLowerCase().includes('.png') ? 'PNG' : 'JPEG';
      const imgSize = circleR * 2;
      doc.addImage(`data:image/${hsExt.toLowerCase()};base64,${hs64}`, hsExt, circleX - circleR, circleY - circleR, imgSize, imgSize, undefined, 'FAST');
      doc.setDrawColor(accent.r, accent.g, accent.b);
      doc.setLineWidth(1.5);
      doc.circle(circleX, circleY, circleR, 'S');
      headshotRendered = true;
    } catch (e) {
      // fall through to initials
    }
  }

  if (!headshotRendered && branding.agent_name) {
    doc.setFillColor(primary.r, primary.g, primary.b);
    doc.circle(circleX, circleY, circleR, 'F');
    doc.setDrawColor(accent.r, accent.g, accent.b);
    doc.setLineWidth(1.5);
    doc.circle(circleX, circleY, circleR, 'S');
    const initials = (branding.agent_name || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
    doc.text(initials, circleX, circleY + 4, { align: 'center' });
  }

  // Text block (left side)
  doc.setTextColor(80, 80, 80);
  doc.setFontSize(9); doc.setFont('helvetica', 'bold');
  doc.text(branding.agent_name || '', 40, footerY + 8);

  if (style !== 'name_only') {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    const parts = [];
    if (branding.agent_title) parts.push(branding.agent_title);
    if (style === 'name_title_contact' || style === 'full_with_headshot') {
      if (branding.agent_phone) parts.push(branding.agent_phone);
      if (branding.agent_email) parts.push(branding.agent_email);
    }
    if (parts.length) doc.text(parts.join('  |  '), 40, footerY + 20);
  }

  doc.setFontSize(6.5); doc.setTextColor(150, 150, 150);
  const disclaimer = 'This AI-generated analysis is for informational purposes only and does not constitute legal, financial, or professional real estate advice. All valuations should be verified by a licensed professional.';
  const splitDisclaimer = doc.splitTextToSize(disclaimer, pageWidth - 120);
  doc.text(splitDisclaimer, 40, footerY + 34);
}

// ─── PDF Template Renderers ────────────────────────────────────────────────────

async function drawPageFrame(doc, branding, breadcrumb, pageTitle) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const primary = hexToRgb(branding.primary_color || '#1A3226');
  const accent = hexToRgb(branding.accent_color || '#B8982F');

  doc.setFillColor(250, 248, 244);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  doc.setFillColor(accent.r, accent.g, accent.b);
  doc.rect(0, 0, pageWidth, 3, 'F');
  doc.rect(0, 789, pageWidth, 3, 'F');

  doc.setFillColor(primary.r, primary.g, primary.b);
  doc.rect(0, 735, pageWidth, 57, 'F');

  const footerParts = [];
  if (branding.agent_name) footerParts.push(branding.agent_name);
  if (branding.org_name) footerParts.push(branding.org_name);
  doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(255, 255, 255);
  doc.text(footerParts.join(' · '), 40, 758);

  // Logo or monogram badge (right side of footer)
  if (branding.org_logo_url) {
    try {
      const logoRes = await fetch(branding.org_logo_url);
      const logoBuffer = await logoRes.arrayBuffer();
      const logoBase64 = btoa(String.fromCharCode(...new Uint8Array(logoBuffer)));
      const ext = branding.org_logo_url.toLowerCase().includes('.png') ? 'PNG' : 'JPEG';
      doc.addImage(`data:image/${ext.toLowerCase()};base64,${logoBase64}`, ext, pageWidth - 68, 740, 40, 18, undefined, 'FAST');
    } catch (e) {
      const monogram = (branding.org_name || 'PP').split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase();
      doc.setFillColor(accent.r, accent.g, accent.b);
      doc.roundedRect(pageWidth - 60, 741, 32, 20, 3, 3, 'F');
      doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(primary.r, primary.g, primary.b);
      doc.text(monogram, pageWidth - 44, 754, { align: 'center' });
    }
  } else {
    const monogram = (branding.org_name || 'PP').split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase();
    doc.setFillColor(accent.r, accent.g, accent.b);
    doc.roundedRect(pageWidth - 60, 741, 32, 20, 3, 3, 'F');
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(primary.r, primary.g, primary.b);
    doc.text(monogram, pageWidth - 44, 754, { align: 'center' });
  }

  if (breadcrumb) {
    doc.setFillColor(accent.r, accent.g, accent.b);
    doc.rect(38, 12, 2, 14, 'F');
    doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(accent.r, accent.g, accent.b);
    doc.text(breadcrumb.toUpperCase(), 44, 22);
  }

  if (pageTitle) {
    const titleSize = pageTitle.length > 40 ? 17 : 20;
    doc.setFontSize(titleSize); doc.setFont('helvetica', 'bold'); doc.setTextColor(primary.r, primary.g, primary.b);
    doc.text(pageTitle, 40, 62);
    doc.setDrawColor(accent.r, accent.g, accent.b); doc.setLineWidth(1.5);
    doc.line(40, 68, 150, 68);
  }
}

function drawSectionDivider(doc, branding, sectionNum, sectionTitle, subtitle) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const primary = hexToRgb(branding.primary_color || '#1A3226');
  const accent = hexToRgb(branding.accent_color || '#B8982F');

  doc.setFillColor(primary.r, primary.g, primary.b);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  doc.setFillColor(accent.r, accent.g, accent.b);
  doc.rect(0, 0, pageWidth, 4, 'F');
  doc.rect(0, 789, pageWidth, 3, 'F');

  doc.setDrawColor(accent.r, accent.g, accent.b); doc.setLineWidth(1);
  doc.line(40, 140, 390, 140);

  doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(accent.r, accent.g, accent.b);
  doc.text(`SECTION ${String(sectionNum).padStart(2, '0')}`, 40, 160);

  doc.setFillColor(accent.r, accent.g, accent.b);
  doc.rect(40, 185, 3, 60, 'F');

  doc.setFontSize(32); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
  const titleLines = doc.splitTextToSize(sectionTitle, 480);
  doc.text(titleLines.slice(0, 2), 52, 210);

  if (subtitle) {
    doc.setFontSize(11); doc.setFont('helvetica', 'normal'); doc.setTextColor(accent.r, accent.g, accent.b);
    doc.text(subtitle, 52, 265, { maxWidth: 480 });
  }

  const footerText = [branding.agent_name, branding.org_name].filter(Boolean).join(' · ');
  doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(180, 180, 180);
  doc.text(footerText, 40, 758);
}

function drawTable(doc, x, y, headers, rows, colWidths, options = {}) {
  const {
    headerFill = '#1A3226',
    headerTextColor = '#FFFFFF',
    altRowFill = '#F4F1EA',
    fontSize = 8,
    headerFontSize = 8,
    rowHeight = 24,
    padding = 8,
    branding = null,
  } = options;

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const bottomMargin = 65;
  const totalWidth = colWidths.reduce((a, b) => a + b, 0);
  let currentY = y;

  const parseColor = (hex) => {
    const clean = (hex || '#000000').replace('#', '');
    return { r: parseInt(clean.slice(0, 2), 16), g: parseInt(clean.slice(2, 4), 16), b: parseInt(clean.slice(4, 6), 16) };
  };

  const drawHeaderRow = () => {
    const hc = parseColor(headerFill);
    doc.setFillColor(hc.r, hc.g, hc.b);
    doc.rect(x, currentY, totalWidth, rowHeight + 4, 'F');
    if (branding?.accent_color) {
      const ac = parseColor(branding.accent_color);
      doc.setFillColor(ac.r, ac.g, ac.b);
      doc.rect(x, currentY + rowHeight + 4 - 2, totalWidth, 2, 'F');
    }
    doc.setFontSize(headerFontSize); doc.setFont('helvetica', 'bold');
    const htc = parseColor(headerTextColor);
    doc.setTextColor(htc.r, htc.g, htc.b);
    let cellX = x + padding;
    headers.forEach((h, i) => { doc.text(h, cellX, currentY + (rowHeight + 4) / 2 + 3); cellX += colWidths[i]; });
    currentY += rowHeight + 4;
  };

  drawHeaderRow();
  doc.setFontSize(fontSize); doc.setFont('helvetica', 'normal');

  for (let ri = 0; ri < rows.length; ri++) {
    if (currentY + rowHeight > pageHeight - bottomMargin) {
      doc.addPage();
      if (branding) drawPageFrame(doc, branding, null, null);
      currentY = 90;
      drawHeaderRow();
      doc.setFontSize(fontSize); doc.setFont('helvetica', 'normal');
    }

    const isAlt = ri % 2 !== 0;
    if (isAlt) { const arc = parseColor(altRowFill); doc.setFillColor(arc.r, arc.g, arc.b); }
    else { doc.setFillColor(255, 255, 255); }
    doc.rect(x, currentY, totalWidth, rowHeight, 'F');
    doc.setDrawColor(224, 221, 214); doc.setLineWidth(0.5);
    doc.line(x, currentY + rowHeight, x + totalWidth, currentY + rowHeight);

    doc.setTextColor(26, 26, 26);
    let cellX = x + padding;
    const row = rows[ri];
    row.forEach((cell, ci) => {
      const cellText = String(cell ?? '');
      const isNum = !isNaN(cell) && cell !== '' && cell !== null;
      const align = isNum ? 'right' : 'left';
      const cx = isNum ? cellX + colWidths[ci] - padding : cellX;
      const maxW = colWidths[ci] - padding * 2;
      const wrapped = doc.splitTextToSize(cellText, maxW);
      doc.text(wrapped[0], cx, currentY + rowHeight / 2 + 3, { align });
      cellX += colWidths[ci];
    });

    currentY += rowHeight;
  }

  return currentY;
}

/** Branded cover: primary bg, logo, accent pill, address. NO price/recommendation shown. */
async function drawBrandedCover(doc, branding, reportType, address, metaLines) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const primary = hexToRgb(branding.primary_color || '#1A3226');
  const accent = hexToRgb(branding.accent_color || '#B8982F');
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  doc.setFillColor(primary.r, primary.g, primary.b);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  doc.setFillColor(accent.r, accent.g, accent.b);
  doc.rect(0, 0, pageWidth, 4, 'F');
  doc.rect(0, pageHeight - 3, pageWidth, 3, 'F');
  let logoBottomY = 88;
  if (branding.org_logo_url) {
    try {
      const lr = await fetch(branding.org_logo_url);
      const lb = await lr.arrayBuffer();
      const l64 = btoa(String.fromCharCode(...new Uint8Array(lb)));
      const lext = branding.org_logo_url.toLowerCase().includes('.png') ? 'PNG' : 'JPEG';
      doc.addImage(`data:image/${lext.toLowerCase()};base64,${l64}`, lext, pageWidth / 2 - 70, 72, 140, 50, undefined, 'FAST');
      logoBottomY = 130;
    } catch (e) {
      doc.setFontSize(24); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
      doc.text(branding.org_name || '', pageWidth / 2, 108, { align: 'center' });
    }
  } else {
    doc.setFontSize(24); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
    doc.text(branding.org_name || '', pageWidth / 2, 108, { align: 'center' });
  }
  const pillW = 280; const pillH = 26;
  doc.setFillColor(accent.r, accent.g, accent.b);
  doc.roundedRect(pageWidth / 2 - pillW / 2, logoBottomY + 10, pillW, pillH, 4, 4, 'F');
  doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(primary.r, primary.g, primary.b);
  doc.text(reportType.toUpperCase(), pageWidth / 2, logoBottomY + 10 + pillH / 2 + 3, { align: 'center' });
  doc.setDrawColor(accent.r, accent.g, accent.b); doc.setLineWidth(1);
  doc.line(pageWidth / 2 - 160, logoBottomY + 48, pageWidth / 2 + 160, logoBottomY + 48);
  const addrParts = (address || '').split(',');
  const street = addrParts[0]?.trim() || '';
  const cityState = addrParts.slice(1).join(',').trim();
  const addrY = logoBottomY + 70;
  doc.setFontSize(26); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
  doc.text(street, pageWidth / 2, addrY, { align: 'center', maxWidth: 460 });
  if (cityState) { doc.setFontSize(13); doc.setFont('helvetica', 'normal'); doc.setTextColor(accent.r, accent.g, accent.b); doc.text(cityState, pageWidth / 2, addrY + 22, { align: 'center' }); }
  let metaY = addrY + 50;
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(180, 180, 180);
  (metaLines || []).forEach(line => { doc.text(line, pageWidth / 2, metaY, { align: 'center' }); metaY += 16; });
  doc.text(`${today}  ·  CONFIDENTIAL`, pageWidth / 2, metaY + 4, { align: 'center' });
  if (branding.agent_name) { doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.text(`Prepared by ${branding.agent_name}`, pageWidth / 2, metaY + 20, { align: 'center' }); }
  const ctact = [branding.agent_phone, branding.agent_email].filter(Boolean).join('  ·  ');
  if (ctact) { doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(accent.r, accent.g, accent.b); doc.text(ctact, pageWidth / 2, metaY + 36, { align: 'center' }); }
  doc.setFillColor(Math.min(255, primary.r + 12), Math.min(255, primary.g + 12), Math.min(255, primary.b + 12));
  doc.rect(0, pageHeight - 38, pageWidth, 38, 'F');
  doc.setFillColor(accent.r, accent.g, accent.b); doc.rect(0, pageHeight - 38, pageWidth, 1.5, 'F');
  doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(180, 180, 180);
  doc.text(branding.org_name || '', pageWidth / 2, pageHeight - 16, { align: 'center' });
}

async function addClosingSummaryPage(doc, branding, title, tableRows) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const primary = hexToRgb(branding.primary_color || '#1A3226');
  const accent = hexToRgb(branding.accent_color || '#B8982F');
  doc.addPage();
  doc.setFillColor(primary.r, primary.g, primary.b); doc.rect(0, 0, pageWidth, ph, 'F');
  doc.setFillColor(accent.r, accent.g, accent.b); doc.rect(0, 0, pageWidth, 4, 'F'); doc.rect(0, ph - 3, pageWidth, 3, 'F');
  doc.setDrawColor(accent.r, accent.g, accent.b); doc.setLineWidth(1);
  doc.line(pageWidth / 2 - 150, 108, pageWidth / 2 + 150, 108);
  doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
  doc.text(title.toUpperCase(), pageWidth / 2, 134, { align: 'center' });
  const ctX = pageWidth / 2 - 190; const ctW = 380; const rh = 22;
  doc.setFillColor(accent.r, accent.g, accent.b);
  doc.roundedRect(ctX, 150, ctW, rh, 2, 2, 'F');
  doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(primary.r, primary.g, primary.b);
  doc.text('CATEGORY', ctX + 10, 150 + rh / 2 + 3); doc.text('FINDING', ctX + ctW / 2 + 10, 150 + rh / 2 + 3);
  let cty = 150 + rh;
  tableRows.forEach((row, ri) => {
    doc.setFillColor(Math.min(255, primary.r + (ri % 2 === 0 ? 14 : 24)), Math.min(255, primary.g + (ri % 2 === 0 ? 14 : 24)), Math.min(255, primary.b + (ri % 2 === 0 ? 14 : 24)));
    doc.rect(ctX, cty, ctW, rh, 'F');
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(200, 200, 200);
    doc.text(String(row[0] || ''), ctX + 10, cty + rh / 2 + 3);
    doc.setTextColor(220, 220, 220);
    doc.text(String(row[1] || ''), ctX + ctW / 2 + 10, cty + rh / 2 + 3);
    cty += rh;
  });
  const contact = [branding.agent_name, branding.agent_phone, branding.agent_email].filter(Boolean).join('  ·  ');
  if (contact) { doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(180, 180, 180); doc.text(contact, pageWidth / 2, cty + 28, { align: 'center' }); }
}

async function addDisclaimerPage(doc, branding) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  const contentWidth = pageWidth - 2 * margin;
  const primary = hexToRgb(branding.primary_color || '#1A3226');
  doc.addPage();
  await drawPageFrame(doc, branding, 'Disclosures', 'Important Disclosures');
  let y = 90;
  const paras = [
    'NOT LEGAL OR FINANCIAL ADVICE: This PropPrompt™ report is generated by artificial intelligence for informational and planning purposes only. It does not constitute legal, financial, tax, or professional real estate advice. All data and valuations should be independently verified by a licensed professional.',
    'NET PROCEEDS ESTIMATES: Estimated net proceeds are approximations and exclude federal and state capital gains taxes, depreciation recapture, mortgage prepayment penalties, HOA transfer fees, and other transaction costs.',
    'COMPARABLE SALES DATA: Comparable sales are sourced from publicly available MLS records, county registry data, and AI-assembled research. Adjustments applied to out-of-area comparables are estimates, not appraisal-grade adjustments.',
    'AVM ESTIMATES: Third-party Automated Valuation Model estimates are for informational purposes only and may not reflect property-specific conditions, recent renovations, or local market nuances.',
    'FAIR HOUSING COMPLIANCE: All archetype profiles, migration analysis, and marketing guidance comply with the Fair Housing Act and applicable state laws. Profiles are defined by life stage, financial profile, and lifestyle — never by any protected class.',
    'AI-GENERATED CONTENT: This report uses large language model technology. Users are solely responsible for verifying accuracy before reliance.',
  ];
  doc.setFontSize(8.5);
  for (const para of paras) {
    const ci = para.indexOf(':');
    if (ci > 0) {
      doc.setFont('helvetica', 'bold'); doc.setTextColor(primary.r, primary.g, primary.b);
      doc.text(para.slice(0, ci + 1), margin, y);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 60, 60);
      const rest = doc.splitTextToSize(para.slice(ci + 1).trim(), contentWidth);
      doc.text(rest, margin, y + 12); y += rest.length * 12 + 18;
    } else {
      doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 60, 60);
      const lines = doc.splitTextToSize(para, contentWidth);
      doc.text(lines, margin, y); y += lines.length * 12 + 14;
    }
  }
}

async function renderAvmSection(doc, data, branding, margin, contentWidth, primary, accent, fmt) {
  const ap = data.avm_perception ?? null;
  const al = data.avm_analysis || {};
  const platforms = ap?.platforms || al.platforms || null;
  if (!platforms?.length) return;
  doc.addPage();
  await drawPageFrame(doc, branding, 'Section 02 · Valuation Analysis', 'Consumer AVM Perception');
  let y = 90;
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(accent.r, accent.g, accent.b);
  doc.text('What the internet thinks your home is worth — and why the full picture is more nuanced', margin, y); y += 18;
  let hasNull = false;
  const colW = [88, 90, 80, 80, 50]; const totalW = colW.reduce((a,b)=>a+b,0); const rh = 24;
  doc.setFillColor(primary.r, primary.g, primary.b); doc.rect(margin, y, totalW, rh+4, 'F');
  doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(255,255,255);
  let cx = margin+8; ['Platform','Estimate','Range Low','Range High','Trend'].forEach((h,i)=>{doc.text(h,cx,y+rh/2+5); cx+=colW[i];}); y+=rh+4;
  platforms.forEach((p,ri)=>{
    const raw=p.estimate; const hasEst=raw!=null&&raw!=='null'&&raw!=='';
    if(!hasEst) hasNull=true;
    const disp=hasEst?(typeof raw==='number'?fmt(raw):raw):null;
    const row=[p.name||p.platform||'',disp,hasEst?(p.range_low?(typeof p.range_low==='number'?fmt(p.range_low):p.range_low):'—'):'—',hasEst?(p.range_high?(typeof p.range_high==='number'?fmt(p.range_high):p.range_high):'—'):'—',p.trend||'—'];
    ri%2!==0?doc.setFillColor(244,241,234):doc.setFillColor(255,255,255);
    doc.rect(margin,y,totalW,rh,'F'); doc.setDrawColor(224,221,214); doc.setLineWidth(0.5); doc.line(margin,y+rh,margin+totalW,y+rh);
    cx=margin+8; row.forEach((cell,ci)=>{
      if(ci===1&&cell===null){doc.setFontSize(7.5);doc.setFont('helvetica','italic');doc.setTextColor(150,150,150);doc.text('No estimate available',cx,y+rh/2+3);}
      else{doc.setFontSize(8);doc.setFont('helvetica','normal');doc.setTextColor(26,26,26);doc.text(String(cell||'—'),cx,y+rh/2+3);}
      cx+=colW[ci];
    }); y+=rh;
  }); y+=6;
  if(hasNull&&y+22<710){doc.setFontSize(7.5);doc.setFont('helvetica','italic');doc.setTextColor(120,120,120);const fn=doc.splitTextToSize('* This property may be too recent or have insufficient transaction history for this platform to generate an estimate.',contentWidth);doc.text(fn,margin,y);y+=fn.length*11+8;}
  const gapDir=ap?.gap_direction||al.gap_analysis?.direction||null;
  const alignN=ap?.alignment_narrative||null;
  if(gapDir&&y+44<710){
    const lbl=gapDir==='professional_higher'?'PROFESSIONAL ESTIMATE HIGHER':gapDir==='avm_higher'?'AVMs HIGHER':'AVMs ALIGNED WITH PROFESSIONAL RANGE';
    doc.setFillColor(primary.r,primary.g,primary.b);doc.roundedRect(margin,y,contentWidth,alignN?52:40,3,3,'F');
    doc.setFontSize(9);doc.setFont('helvetica','bold');doc.setTextColor(255,255,255);
    const cl=ap?.composite_average?`AVM Composite: ${ap.composite_average}  →  `:'';
    doc.text(`${cl}${lbl}${ap?.gap_percent?' ('+ap.gap_percent+')':''}`,margin+10,y+16);
    if(alignN){doc.setFontSize(8.5);doc.setFont('helvetica','normal');doc.setTextColor(accent.r,accent.g,accent.b);doc.text(doc.splitTextToSize(alignN,contentWidth-20)[0],margin+10,y+34);}
    y+=alignN?60:48;
  }
}

async function renderCMAPdf(doc, data, branding) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  const contentWidth = pageWidth - 2 * margin;
  const primary = hexToRgb(branding.primary_color || '#1A3226');
  const accent = hexToRgb(branding.accent_color || '#B8982F');
  const fmt = (n) => n != null ? `$${Number(n).toLocaleString()}` : 'N/A';
  const fmtPct = (n) => n != null ? `${Number(n).toFixed(1)}%` : 'N/A';
  const mc = data.market_context || {};
  const iv = data.tiered_comps?.implied_value_range || {};
  const totalComps = (data.tiered_comps?.tiers || []).reduce((s, t) => s + (t.comps?.length || 0), 0);

  await drawBrandedCover(doc, branding, 'Comparative Market Analysis', data.property_address, [
    `${totalComps || 0} Comparable Sales Analyzed`,
    `Market: ${mc.market_characterization || 'See Report'}`,
  ]);

  doc.addPage();
  drawSectionDivider(doc, branding, 1, 'Subject Property', 'Property details · condition assessment');
  doc.addPage();
  await drawPageFrame(doc, branding, 'Section 01 · Subject Property', 'Property & Market Overview');
  let y = 90;
  if (mc.narrative) {
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(50, 50, 50);
    const nLines = doc.splitTextToSize(mc.narrative, contentWidth);
    doc.text(nLines.slice(0, 7), margin, y); y += Math.min(nLines.length, 7) * 13 + 14;
  }
  const mRows = [
    ['Median Sale Price', mc.median_sale_price ? fmt(mc.median_sale_price) : 'N/A'],
    ['YoY Appreciation', mc.yoy_appreciation ? fmtPct(mc.yoy_appreciation) : 'N/A'],
    ['Avg Days on Market', mc.avg_days_on_market ? `${mc.avg_days_on_market} days` : 'N/A'],
    ['Sale-to-List Ratio', mc.sale_to_list_ratio ? fmtPct(mc.sale_to_list_ratio * 100) : 'N/A'],
    ['Months of Inventory', mc.months_inventory ? `${mc.months_inventory}` : 'N/A'],
    ['Market Characterization', mc.market_characterization || 'N/A'],
  ];
  drawTable(doc, margin, y, ['Market Indicator', 'Value'], mRows, [contentWidth - 130, 130],
    { headerFill: branding.primary_color || '#1A3226', headerTextColor: '#FFFFFF', fontSize: 9, rowHeight: 26, branding });

  doc.addPage();
  drawSectionDivider(doc, branding, 2, 'Comparable Sales\nAnalysis', 'Tiered comparables · adjustments · PPSF range');
  doc.addPage();
  await drawPageFrame(doc, branding, 'Section 02 · Comparable Sales', 'Tiered Comparable Sales');
  y = 90;
  if (data.tiered_comps?.tiers) {
    for (const tier of data.tiered_comps.tiers) {
      if (y + 60 > 710) { doc.addPage(); await drawPageFrame(doc, branding, 'Section 02 · Comparable Sales', 'Comparable Sales (cont.)'); y = 90; }
      const tColor = tier.tier_id === 'A' ? primary : tier.tier_id === 'B' ? accent : hexToRgb('#888888');
      doc.setFillColor(tColor.r, tColor.g, tColor.b); doc.roundedRect(margin, y, contentWidth, 22, 3, 3, 'F');
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
      const ppsf = tier.ppsf_range ? `  ·  $${tier.ppsf_range.low}–$${tier.ppsf_range.high}/SF` : '';
      doc.text(`${tier.tier_label || 'Tier ' + tier.tier_id}${ppsf}`, margin + 8, y + 15); y += 26;
      if (tier.comps?.length) {
        const rows = tier.comps.map(c => [c.address || '', c.sale_date || '', c.sale_price ? fmt(c.sale_price) : '', c.square_feet ? c.square_feet.toLocaleString() : '', c.raw_ppsf ? `$${c.raw_ppsf}` : '', c.adjusted_ppsf ? `$${c.adjusted_ppsf}` : '', c.condition_vs_subject || '']);
        y = drawTable(doc, margin, y, ['Address', 'Date', 'Price', 'SF', '$/SF Raw', '$/SF Adj', 'Condition'], rows, [130, 52, 68, 42, 55, 55, 60], { headerFill: branding.primary_color || '#1A3226', headerTextColor: '#FFFFFF', fontSize: 7.5, rowHeight: 22, branding }); y += 10;
      }
    }
  }

  doc.addPage();
  drawSectionDivider(doc, branding, 3, 'Valuation\nConvergence', 'Three independent methods · confidence range');
  doc.addPage();
  await drawPageFrame(doc, branding, 'Section 03 · Valuation Convergence', 'Valuation Summary');
  y = 90;
  const v = data.valuation || {};
  if (v.narrative) {
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(50, 50, 50);
    const vLines = doc.splitTextToSize(v.narrative, contentWidth);
    doc.text(vLines.slice(0, 10), margin, y); y += Math.min(vLines.length, 10) * 13 + 14;
  }
  if (iv.low && iv.high) {
    doc.setFillColor(primary.r, primary.g, primary.b); doc.roundedRect(margin, y, contentWidth, 38, 3, 3, 'F');
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(accent.r, accent.g, accent.b);
    doc.text(`Implied Value Range: ${fmt(iv.low)} – ${fmt(iv.high)}  ·  Midpoint: ${fmt(iv.midpoint)}`, margin + 10, y + 24);
  }
  if (data.tiered_comps?.thin_comp_flag) { doc.setFontSize(8); doc.setTextColor(180, 50, 50); doc.text('⚠ Thin comp set — valuation confidence is reduced.', margin, y + 50); }

  await renderAvmSection(doc, data, branding, margin, contentWidth, primary, accent, fmt);

  await addClosingSummaryPage(doc, branding, 'CMA Summary', [
    ['Property Address', data.property_address || ''],
    ['Comparable Sales', String(totalComps || 'N/A')],
    ['Implied Value Range', iv.low && iv.high ? `${fmt(iv.low)} – ${fmt(iv.high)}` : 'See Report'],
    ['Value Midpoint', iv.midpoint ? fmt(iv.midpoint) : 'See Report'],
    ['Confidence Level', data.confidence_level || 'Medium'],
    ['Market Characterization', mc.market_characterization || 'N/A'],
    ['Avg Days on Market', mc.avg_days_on_market ? `${mc.avg_days_on_market} days` : 'N/A'],
    ['Sale-to-List Ratio', mc.sale_to_list_ratio ? fmtPct(mc.sale_to_list_ratio * 100) : 'N/A'],
    ['Prepared By', branding.agent_name || ''],
    ['Report Date', new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })],
  ]);
  await addDisclaimerPage(doc, branding);
}

async function renderListingPricingPdf(doc, data, branding, netProceedsJson = null) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - 2 * margin;
  const primary = hexToRgb(branding.primary_color || '#1A3226');
  const accent = hexToRgb(branding.accent_color || '#B8982F');
  const fmt = (n) => n != null ? `$${Number(n).toLocaleString()}` : 'N/A';
  const fmtPct = (n) => n != null ? `${Number(n).toFixed(1)}%` : 'N/A';
  const v = data.valuation || {};
  const mc = data.market_context || {};
  const isPro = !!(data.buyer_archetypes?.length || data.migration_analysis?.feeder_markets?.length);
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const month = new Date().getMonth();
  const year = new Date().getFullYear();
  const season = month < 3 ? 'Winter' : month < 6 ? 'Spring' : month < 9 ? 'Summer' : 'Fall';
  const seasonYear = `${season} ${year}`;
  const BODY_SIZE = 10.5;
  const LINE_H = 15;
  const BOTTOM = 720;

  // Helper: render a full narrative with auto-pagination
  async function renderNarrative(text, breadcrumb, title, startY) {
    if (!text) return startY;
    let y = startY;
    doc.setFontSize(BODY_SIZE); doc.setFont('helvetica', 'normal'); doc.setTextColor(50, 50, 50);
    const lines = doc.splitTextToSize(text, contentWidth);
    for (const line of lines) {
      if (y + LINE_H > BOTTOM) {
        doc.addPage();
        await drawPageFrame(doc, branding, breadcrumb, title);
        y = 90;
        doc.setFontSize(BODY_SIZE); doc.setFont('helvetica', 'normal'); doc.setTextColor(50, 50, 50);
      }
      doc.text(line, margin, y);
      y += LINE_H;
    }
    return y + 10;
  }

  // COVER PAGE
  doc.setFillColor(primary.r, primary.g, primary.b);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  doc.setFillColor(accent.r, accent.g, accent.b);
  doc.rect(0, 0, pageWidth, 4, 'F');
  doc.rect(0, pageHeight - 3, pageWidth, 3, 'F');

  let logoBottomY = 88;
  if (branding.org_logo_url) {
    try {
      const lr = await fetch(branding.org_logo_url);
      const lb = await lr.arrayBuffer();
      const l64 = btoa(String.fromCharCode(...new Uint8Array(lb)));
      const lext = branding.org_logo_url.toLowerCase().includes('.png') ? 'PNG' : 'JPEG';
      doc.addImage(`data:image/${lext.toLowerCase()};base64,${l64}`, lext, pageWidth / 2 - 70, 72, 140, 50, undefined, 'FAST');
      logoBottomY = 130;
    } catch (e) {
      doc.setFontSize(26); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
      doc.text(branding.org_name || 'PropPrompt', pageWidth / 2, 108, { align: 'center' });
      logoBottomY = 120;
    }
  } else {
    doc.setFontSize(26); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
    doc.text(branding.org_name || 'PropPrompt', pageWidth / 2, 108, { align: 'center' });
    logoBottomY = 120;
  }

  const pillLabel = `LISTING PRICING ANALYSIS  ·  ${seasonYear.toUpperCase()}`;
  const pillW = 290; const pillH = 26;
  doc.setFillColor(accent.r, accent.g, accent.b);
  doc.roundedRect(pageWidth / 2 - pillW / 2, logoBottomY + 10, pillW, pillH, 4, 4, 'F');
  doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(primary.r, primary.g, primary.b);
  doc.text(pillLabel, pageWidth / 2, logoBottomY + 10 + pillH / 2 + 3, { align: 'center' });

  doc.setDrawColor(accent.r, accent.g, accent.b); doc.setLineWidth(1);
  doc.line(pageWidth / 2 - 160, logoBottomY + 48, pageWidth / 2 + 160, logoBottomY + 48);

  const addrParts = (data.property_address || '').split(',');
  const street = addrParts[0]?.trim() || '';
  const cityState = addrParts.slice(1).join(',').trim();
  const addrY = logoBottomY + 72;
  doc.setFontSize(28); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
  doc.text(street, pageWidth / 2, addrY, { align: 'center', maxWidth: 460 });
  if (cityState) {
    doc.setFontSize(14); doc.setFont('helvetica', 'normal'); doc.setTextColor(accent.r, accent.g, accent.b);
    doc.text(cityState, pageWidth / 2, addrY + 22, { align: 'center' });
  }

  let metaY = addrY + 52;
  const clientName = data.client_name || branding.client_name;
  if (clientName) {
    doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(200, 200, 200);
    doc.text(`Prepared for: ${clientName}`, pageWidth / 2, metaY, { align: 'center' });
    metaY += 18;
  }

  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(180, 180, 180);
  doc.text(`${today}  ·  CONFIDENTIAL`, pageWidth / 2, metaY + 6, { align: 'center' });
  if (branding.agent_name) {
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(180, 180, 180);
    doc.text(`Prepared by ${branding.agent_name}`, pageWidth / 2, metaY + 22, { align: 'center' });
  }

  const contactParts = [branding.agent_phone, branding.agent_email].filter(Boolean);
  if (contactParts.length) {
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(accent.r, accent.g, accent.b);
    doc.text(contactParts.join('  ·  '), pageWidth / 2, metaY + 40, { align: 'center' });
  }

  doc.setFillColor(Math.min(255, primary.r + 12), Math.min(255, primary.g + 12), Math.min(255, primary.b + 12));
  doc.rect(0, pageHeight - 38, pageWidth, 38, 'F');
  doc.setFillColor(accent.r, accent.g, accent.b);
  doc.rect(0, pageHeight - 38, pageWidth, 1.5, 'F');
  doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(180, 180, 180);
  doc.text(branding.org_name || '', pageWidth / 2, pageHeight - 16, { align: 'center' });

  // SECTION 01: Property & Market Context
  doc.addPage();
  drawSectionDivider(doc, branding, 1, 'Property & Market Context', 'Property details · market conditions · rate environment');
  doc.addPage();
  await drawPageFrame(doc, branding, 'Section 01 · Property & Market Context', 'Property & Market Overview');
  let y = 90;

  if (data.executive_summary) {
    y = await renderNarrative(data.executive_summary, 'Section 01 · Property & Market Context', 'Property & Market Overview', y);
  }

  const statBoxes = [
    { label: 'MEDIAN SALE PRICE', value: mc.median_sale_price ? fmt(mc.median_sale_price) : 'N/A' },
    { label: 'YOY APPRECIATION', value: mc.yoy_appreciation ? fmtPct(mc.yoy_appreciation) : 'N/A' },
    { label: 'AVG DAYS ON MARKET', value: mc.avg_days_on_market ? `${mc.avg_days_on_market}d` : 'N/A' },
    { label: 'SALE-TO-LIST RATIO', value: mc.sale_to_list_ratio ? fmtPct(mc.sale_to_list_ratio * 100) : 'N/A' },
  ];
  const boxW = (contentWidth - 18) / 4;
  if (y + 60 > BOTTOM) { doc.addPage(); await drawPageFrame(doc, branding, 'Section 01 · Property & Market Context', 'Market Snapshot'); y = 90; }
  statBoxes.forEach((sb, i) => {
    const bx = margin + i * (boxW + 6);
    doc.setFillColor(primary.r, primary.g, primary.b);
    doc.roundedRect(bx, y, boxW, 52, 3, 3, 'F');
    doc.setFontSize(6.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(accent.r, accent.g, accent.b);
    doc.text(sb.label, bx + boxW / 2, y + 14, { align: 'center', maxWidth: boxW - 8 });
    doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
    doc.text(sb.value, bx + boxW / 2, y + 36, { align: 'center', maxWidth: boxW - 8 });
  });
  y += 64;

  if (mc.narrative) {
    if (y + 40 > BOTTOM) { doc.addPage(); await drawPageFrame(doc, branding, 'Section 01 · Property & Market Context', 'Market Conditions'); y = 90; }
    y = await renderNarrative(mc.narrative, 'Section 01 · Property & Market Context', 'Market Conditions', y);
  }
  const mRows = [
    ['Median Sale Price', mc.median_sale_price ? fmt(mc.median_sale_price) : 'N/A'],
    ['YoY Appreciation', mc.yoy_appreciation ? fmtPct(mc.yoy_appreciation) : 'N/A'],
    ['Avg Days on Market', mc.avg_days_on_market ? `${mc.avg_days_on_market} days` : 'N/A'],
    ['Sale-to-List Ratio', mc.sale_to_list_ratio ? fmtPct(mc.sale_to_list_ratio * 100) : 'N/A'],
    ['Months of Inventory', mc.months_inventory ? `${mc.months_inventory}` : 'N/A'],
    ['Market Characterization', mc.market_characterization || 'N/A'],
  ];
  if (y + mRows.length * 28 + 40 > BOTTOM) { doc.addPage(); await drawPageFrame(doc, branding, 'Section 01 · Property & Market Context', 'Market Indicators'); y = 90; }
  drawTable(doc, margin, y, ['Market Indicator', 'Value'], mRows, [contentWidth - 140, 140],
    { headerFill: branding.primary_color || '#1A3226', headerTextColor: '#FFFFFF', fontSize: 10, rowHeight: 28, branding });

  // SECTION 02: Valuation Analysis
  doc.addPage();
  drawSectionDivider(doc, branding, 2, 'Valuation Analysis', 'Comparable sales · valuation convergence · AVM perception');
  doc.addPage();
  await drawPageFrame(doc, branding, 'Section 02 · Valuation Analysis', 'Tiered Comparable Sales');
  y = 90;

  if (data.tiered_comps?.tiers) {
    for (const tier of data.tiered_comps.tiers) {
      if (y + 60 > 710) { doc.addPage(); await drawPageFrame(doc, branding, 'Section 02 · Valuation Analysis', 'Comparable Sales (cont.)'); y = 90; }
      const tColor = tier.tier_id === 'A' ? primary : tier.tier_id === 'B' ? accent : hexToRgb('#888888');
      doc.setFillColor(tColor.r, tColor.g, tColor.b);
      doc.roundedRect(margin, y, contentWidth, 22, 3, 3, 'F');
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
      const ppsf = tier.ppsf_range ? `  ·  $${tier.ppsf_range.low}–$${tier.ppsf_range.high}/SF` : '';
      doc.text(`${tier.tier_label || 'Tier ' + tier.tier_id}${ppsf}`, margin + 8, y + 15);
      y += 26;
      if (tier.comps?.length) {
        const headers = ['Address', 'Date', 'Price', 'SF', '$/SF Raw', '$/SF Adj', 'Condition'];
        const colWidths = [130, 52, 68, 42, 52, 52, 56];
        const rows = tier.comps.map(c => [c.address || '', c.sale_date || '', c.sale_price ? fmt(c.sale_price) : '', c.square_feet ? c.square_feet.toLocaleString() : '', c.raw_ppsf ? `$${c.raw_ppsf}` : '', c.adjusted_ppsf ? `$${c.adjusted_ppsf}` : '', c.condition_vs_subject || '']);
        y = drawTable(doc, margin, y, headers, rows, colWidths, { headerFill: branding.primary_color || '#1A3226', headerTextColor: '#FFFFFF', fontSize: 7.5, rowHeight: 22, branding });
        y += 10;
      }
    }
  }

  if (data.tiered_comps?.implied_value_range) {
    const ivr = data.tiered_comps.implied_value_range;
    if (y + 36 > 710) { doc.addPage(); await drawPageFrame(doc, branding, 'Section 02 · Valuation Analysis', 'Implied Value Range'); y = 90; }
    doc.setFillColor(primary.r, primary.g, primary.b);
    doc.roundedRect(margin, y, contentWidth, 32, 3, 3, 'F');
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(accent.r, accent.g, accent.b);
    doc.text(`Implied Value Range: ${fmt(ivr.low)} – ${fmt(ivr.high)}  ·  Midpoint: ${fmt(ivr.midpoint)}`, margin + 10, y + 21);
    y += 40;
  }

  if (v.narrative) {
    if (y + 40 > BOTTOM) { doc.addPage(); await drawPageFrame(doc, branding, 'Section 02 · Valuation Analysis', 'Valuation Summary'); y = 90; }
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(primary.r, primary.g, primary.b);
    doc.text('Valuation Summary', margin, y); y += 16;
    y = await renderNarrative(v.narrative, 'Section 02 · Valuation Analysis', 'Valuation Summary', y);
  }

  await renderAvmSection(doc, data, branding, margin, contentWidth, primary, accent, fmt);

  // SECTION 03: Buyer Demand Intelligence (PRO+ only)
  if (isPro) {
    doc.addPage();
    drawSectionDivider(doc, branding, 3, 'Buyer Demand Intelligence', 'Archetype profiles · migration patterns · employer targeting');

    const archetypes = data.buyer_archetypes || [];
    if (archetypes.length) {
      doc.addPage();
      await drawPageFrame(doc, branding, 'Section 03 · Buyer Demand Intelligence', 'Buyer Archetype Profiles');
      y = 90;
      for (const [idx, arch] of archetypes.entries()) {
        const profileLines = doc.splitTextToSize(arch.profile || '', contentWidth - 22);
        const useItems = (arch.language_use || []).slice(0, 4);
        const avoidItems = (arch.language_avoid || []).slice(0, 3);
        const cardH = Math.max(80, 44 + profileLines.length * LINE_H + (useItems.length ? 22 : 0));
        if (y + cardH > BOTTOM) { doc.addPage(); await drawPageFrame(doc, branding, 'Section 03 · Buyer Demand Intelligence', 'Buyer Archetypes (cont.)'); y = 90; }
        doc.setFillColor(idx % 2 === 0 ? 247 : 252, idx % 2 === 0 ? 247 : 252, idx % 2 === 0 ? 244 : 252);
        doc.roundedRect(margin, y, contentWidth, cardH, 3, 3, 'F');
        doc.setFillColor(primary.r, primary.g, primary.b);
        doc.roundedRect(margin, y, 4, cardH, 2, 2, 'F');
        doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(primary.r, primary.g, primary.b);
        doc.text(`${arch.archetype_name || ''}`, margin + 12, y + 16);
        doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(accent.r, accent.g, accent.b);
        doc.text(`${arch.estimated_pool_pct || 0}% of buyer pool`, margin + 12, y + 30);
        doc.setFontSize(BODY_SIZE); doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 60, 60);
        doc.text(profileLines, margin + 12, y + 44);
        const langY = y + 44 + profileLines.length * LINE_H + 6;
        if (useItems.length) {
          doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(accent.r, accent.g, accent.b);
          doc.text('USE:', margin + 12, langY);
          doc.setFont('helvetica', 'normal'); doc.setTextColor(50, 50, 50);
          doc.text(useItems.join('  ·  '), margin + 36, langY);
        }
        if (avoidItems.length) {
          doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(180, 50, 50);
          doc.text('AVOID:', margin + 12, langY + 14);
          doc.setFont('helvetica', 'normal'); doc.setTextColor(50, 50, 50);
          doc.text(avoidItems.join('  ·  '), margin + 44, langY + 14);
        }
        y += cardH + 8;
      }
    }

    const mig = data.migration_analysis || {};
    if (mig.feeder_markets?.length || mig.employer_targets?.length) {
      doc.addPage();
      await drawPageFrame(doc, branding, 'Section 03 · Buyer Demand Intelligence', 'Migration & Employer Targeting');
      y = 90;
      if (mig.feeder_markets?.length) {
        doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(primary.r, primary.g, primary.b);
        doc.text('Top Feeder Markets', margin, y); y += 14;
        y = drawTable(doc, margin, y, ['Feeder Market', 'Score', 'Primary Motivation', 'Price Psychology'],
          mig.feeder_markets.map(m => [m.market || '', String(m.migration_score || ''), m.primary_motivation || '', m.price_psychology || '']),
          [145, 42, 170, 175], { headerFill: branding.primary_color || '#1A3226', headerTextColor: '#FFFFFF', fontSize: 8, rowHeight: 22, branding });
        y += 20;
      }
      if (mig.employer_targets?.length) {
        if (y + 60 > 710) { doc.addPage(); await drawPageFrame(doc, branding, 'Section 03 · Buyer Demand Intelligence', 'Employer Targeting Matrix'); y = 90; }
        doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(primary.r, primary.g, primary.b);
        doc.text('Employer Targeting Matrix', margin, y); y += 14;
        drawTable(doc, margin, y, ['Company', 'Relevance', 'Target Roles', 'Commute'],
          mig.employer_targets.map(e => [e.company || '', e.relevance || '', e.target_roles || '', e.commute_time || '']),
          [150, 60, 190, 100], { headerFill: branding.primary_color || '#1A3226', headerTextColor: '#FFFFFF', fontSize: 7.5, rowHeight: 22, branding });
      }
    }
  }

  // SECTION 04: Pricing Strategy
  doc.addPage();
  drawSectionDivider(doc, branding, 4, 'Pricing Strategy & Recommendation', 'Pricing scenarios · strategic recommendation · pre-listing timeline');
  doc.addPage();
  await drawPageFrame(doc, branding, 'Section 04 · Pricing Strategy', 'Pricing Scenarios');
  y = 90;

  if (data.pricing_scenarios?.length) {
    const sRows = data.pricing_scenarios.map(s => [s.label || '', fmt(s.price), s.expected_dom || '', s.rationale || '']);
    y = drawTable(doc, margin, y, ['Scenario', 'Price', 'Est. DOM', 'Rationale'], sRows, [140, 72, 65, contentWidth - 285],
      { headerFill: branding.primary_color || '#1A3226', headerTextColor: '#FFFFFF', fontSize: 8.5, rowHeight: 26, branding });
    y += 16;
  }

  if (v.strategic_list_price) {
    if (y + 52 > 710) { doc.addPage(); await drawPageFrame(doc, branding, 'Section 04 · Pricing Strategy', 'Strategic Recommendation'); y = 90; }
    doc.setFillColor(primary.r, primary.g, primary.b);
    doc.roundedRect(margin, y, contentWidth, 48, 3, 3, 'F');
    doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(accent.r, accent.g, accent.b);
    doc.text('RECOMMENDED STRATEGIC LIST PRICE', margin + 10, y + 14);
    doc.setFontSize(24); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
    doc.text(fmt(v.strategic_list_price), margin + 10, y + 39);
    if (v.recommended_range_low) {
      doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(accent.r, accent.g, accent.b);
      doc.text(`Range: ${fmt(v.recommended_range_low)} – ${fmt(v.recommended_range_high)}`, margin + contentWidth * 0.45, y + 39);
    }
    y += 56;
  }

  // SECTION 05: Seller Financial Summary
  doc.addPage();
  drawSectionDivider(doc, branding, 5, 'Seller Financial Summary', 'Estimated net proceeds · analysis summary');
  doc.addPage();
  await drawPageFrame(doc, branding, 'Section 05 · Seller Financial Summary', 'Estimated Net Proceeds');
  y = 90;

  if (!netProceedsJson || !netProceedsJson.scenarios || netProceedsJson.scenarios.length === 0) {
    doc.setFillColor(244, 241, 234);
    doc.roundedRect(margin, y, contentWidth, 44, 3, 3, 'F');
    doc.setFontSize(9); doc.setFont('helvetica', 'italic'); doc.setTextColor(100, 100, 100);
    doc.text('Seller net proceeds not calculated. Financial data was not provided during report setup.', margin + 12, y + 28, { maxWidth: contentWidth - 24 });
    y += 52;
  } else {
    const npScenarios = netProceedsJson.scenarios || [];
    const hasEstimate = npScenarios.some(s => s.estimated);
    const colW2 = [contentWidth - 390, 80, 80, 80, 80, 90];
    const npHeaders = ['Scenario', 'Sale Price', 'Commission', 'Closing', 'Mortgage', 'Net Proceeds'];
    const npRows = npScenarios.map(s => [s.label || '', s.sale_price || '', s.commission || '', s.closing_costs || '', s.mortgage_payoff || '', s.estimated ? (s.net_proceeds + ' *') : (s.net_proceeds || '')]);
    y = drawTable(doc, margin, y, npHeaders, npRows, colW2, { headerFill: branding.primary_color || '#1A3226', headerTextColor: '#FFFFFF', fontSize: 8.5, rowHeight: 28, branding });
    y += 10;
    if (hasEstimate && y + 22 < 710) { doc.setFontSize(7.5); doc.setFont('helvetica', 'italic'); doc.setTextColor(120, 120, 120); doc.text('* Based on estimated mortgage payoff — verify with lender before sharing with seller.', margin, y); y += 14; }
    if (netProceedsJson.notes && y + 18 < 710) { doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(80, 80, 80); doc.text(netProceedsJson.notes, margin, y + 6); y += 20; }
    y += 6;
  }

  const summaryRows = data.summary_rows || data.analysis_summary || [];
  if (summaryRows.length) {
    if (y + 60 > 710) { doc.addPage(); await drawPageFrame(doc, branding, 'Section 05 · Seller Financial Summary', 'Analysis Summary'); y = 90; }
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(primary.r, primary.g, primary.b);
    doc.text('Analysis Summary', margin, y); y += 14;
    const sRows2 = summaryRows.map(r => Array.isArray(r) ? r : [r.category || r.label || '', r.finding || r.value || '']);
    drawTable(doc, margin, y, ['Category', 'Finding'], sRows2, [contentWidth * 0.38, contentWidth * 0.62], { headerFill: branding.primary_color || '#1A3226', headerTextColor: '#FFFFFF', fontSize: 9, rowHeight: 26, branding });
  }

  // CLOSING SUMMARY PAGE
  doc.addPage();
  doc.setFillColor(primary.r, primary.g, primary.b);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  doc.setFillColor(accent.r, accent.g, accent.b);
  doc.rect(0, 0, pageWidth, 4, 'F');
  doc.rect(0, pageHeight - 3, pageWidth, 3, 'F');

  if (branding.org_logo_url) {
    try {
      const cr = await fetch(branding.org_logo_url);
      const cb = await cr.arrayBuffer();
      const c64 = btoa(String.fromCharCode(...new Uint8Array(cb)));
      const cext = branding.org_logo_url.toLowerCase().includes('.png') ? 'PNG' : 'JPEG';
      doc.addImage(`data:image/${cext.toLowerCase()};base64,${c64}`, cext, pageWidth / 2 - 60, 55, 120, 44, undefined, 'FAST');
    } catch (e) {
      doc.setFontSize(20); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
      doc.text(branding.org_name || '', pageWidth / 2, 84, { align: 'center' });
    }
  }
  doc.setDrawColor(accent.r, accent.g, accent.b); doc.setLineWidth(1);
  doc.line(pageWidth / 2 - 150, 112, pageWidth / 2 + 150, 112);
  doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
  doc.text('LISTING PRICING SUMMARY', pageWidth / 2, 138, { align: 'center' });

  const closingData = data.summary_rows?.length ? data.summary_rows.map(r => Array.isArray(r) ? r : [r.category || r.label || '', r.finding || r.value || '']) : [
    ['Assessment Type', 'Listing Pricing Analysis'],
    ['Property', data.property_address || ''],
    ['Implied Value Range', (data.tiered_comps?.implied_value_range?.low) ? `${fmt(data.tiered_comps.implied_value_range.low)} – ${fmt(data.tiered_comps.implied_value_range.high)}` : 'See Report'],
    ['Strategic List Price', v.strategic_list_price ? fmt(v.strategic_list_price) : 'See Report'],
    ['Estimated DOM', v.estimated_dom_low ? `${v.estimated_dom_low}–${v.estimated_dom_high} days` : 'See Report'],
    ['Confidence Level', v.confidence_level || 'Medium'],
    ['Comparable Sales', String((data.tiered_comps?.tiers || []).reduce((s, t) => s + (t.comps?.length || 0), 0) || 'N/A')],
    ['Market Characterization', mc.market_characterization || 'N/A'],
    ['Report Date', today],
    ['Prepared By', branding.agent_name || ''],
  ];
  const ctX = pageWidth / 2 - 190; const ctW = 380; const ctRowH = 22;
  doc.setFillColor(accent.r, accent.g, accent.b);
  doc.roundedRect(ctX, 154, ctW, ctRowH, 2, 2, 'F');
  doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(primary.r, primary.g, primary.b);
  doc.text('CATEGORY', ctX + 10, 154 + ctRowH / 2 + 3);
  doc.text('FINDING', ctX + ctW / 2 + 10, 154 + ctRowH / 2 + 3);
  let cty = 154 + ctRowH;
  closingData.forEach((row, ri) => {
    const isStrategic = ri === 3;
    doc.setFillColor(Math.min(255, primary.r + (ri % 2 === 0 ? 14 : 24)), Math.min(255, primary.g + (ri % 2 === 0 ? 14 : 24)), Math.min(255, primary.b + (ri % 2 === 0 ? 14 : 24)));
    doc.rect(ctX, cty, ctW, ctRowH, 'F');
    doc.setFontSize(8); doc.setFont('helvetica', isStrategic ? 'bold' : 'normal');
    doc.setTextColor(200, 200, 200);
    doc.text(String(row[0] || ''), ctX + 10, cty + ctRowH / 2 + 3);
    doc.setTextColor(isStrategic ? accent.r : 220, isStrategic ? accent.g : 220, isStrategic ? accent.b : 220);
    doc.setFont('helvetica', isStrategic ? 'bold' : 'normal');
    doc.text(String(row[1] || ''), ctX + ctW / 2 + 10, cty + ctRowH / 2 + 3);
    cty += ctRowH;
  });

  if (branding.agent_tagline) {
    doc.setFontSize(11); doc.setFont('helvetica', 'italic'); doc.setTextColor(accent.r, accent.g, accent.b);
    doc.text(`"${branding.agent_tagline}"`, pageWidth / 2, cty + 28, { align: 'center', maxWidth: 400 });
  }
  const closingContact = [branding.agent_name, branding.agent_phone, branding.agent_email].filter(Boolean).join('  ·  ');
  if (closingContact) {
    doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(180, 180, 180);
    doc.text(closingContact, pageWidth / 2, cty + 46, { align: 'center' });
  }

  // DISCLAIMER PAGE
  doc.addPage();
  await drawPageFrame(doc, branding, 'Disclosures', 'Important Disclosures');
  y = 90;
  const disclosureParagraphs = [
    'NOT LEGAL OR FINANCIAL ADVICE: This PropPrompt™ Listing Pricing Analysis is generated by artificial intelligence and is provided for informational and planning purposes only. It does not constitute legal, financial, tax, or professional real estate advice.',
    'NET PROCEEDS ESTIMATES: Estimated net proceeds figures are approximations only. They do not include federal, state, or local capital gains taxes, depreciation recapture, mortgage prepayment penalties, or other transaction-specific costs.',
    'COMPARABLE SALES DATA: Comparable sales are sourced from publicly available MLS records, county registry data, and AI-assembled research. Adjustments applied to out-of-area comparables are estimates and are not appraisal-grade adjustments.',
    'AVM ESTIMATES: Automated Valuation Model estimates from third-party platforms are presented for informational purposes only. These platforms use proprietary algorithms that may not reflect property-specific conditions or recent renovations.',
    'FAIR HOUSING COMPLIANCE: All buyer archetype profiles, migration analysis, and marketing language guidance comply with the Fair Housing Act. Archetypes are defined by life stage, property use, financial profile, and lifestyle — never by any protected class.',
    'AI-GENERATED CONTENT: This report was generated using large language model technology. The user is solely responsible for verifying the accuracy of all data before use.',
  ];
  doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 60, 60);
  for (const para of disclosureParagraphs) {
    const pLines = doc.splitTextToSize(para, contentWidth);
    if (y + pLines.length * 12 > 700) { doc.addPage(); await drawPageFrame(doc, branding, 'Disclosures', 'Important Disclosures (cont.)'); y = 90; }
    const colonIdx = para.indexOf(':');
    if (colonIdx > 0) {
      doc.setFont('helvetica', 'bold'); doc.setTextColor(primary.r, primary.g, primary.b);
      doc.text(para.slice(0, colonIdx + 1), margin, y);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 60, 60);
      const rest = doc.splitTextToSize(para.slice(colonIdx + 1).trim(), contentWidth - 4);
      doc.text(rest, margin, y + 12);
      y += rest.length * 12 + 18;
    } else {
      doc.text(pLines, margin, y);
      y += pLines.length * 12 + 14;
    }
  }

  // AGENT APPENDIX
  if (data.appendix) {
    const appendix = data.appendix;
    const appendixSections = [
      { id: 'A1', title: 'Research Data Log', data: appendix.research_data_log, type: 'table' },
      { id: 'A2', title: 'Confidence Assessment', data: appendix.confidence_assessment, type: 'table' },
      { id: 'A3', title: 'Client Inquiry Note', data: appendix.client_inquiry_note, type: 'text' },
      { id: 'A4', title: 'Follow-Up Checklist', data: appendix.followup_checklist, type: 'text' },
    ];
    for (const sec of appendixSections) {
      if (!sec.data) continue;
      doc.addPage();
      await drawPageFrame(doc, branding, `Appendix ${sec.id}`, `${sec.id} — ${sec.title}`);
      y = 90;
      doc.setFillColor(180, 30, 30);
      doc.rect(margin, y, contentWidth, 22, 'F');
      doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
      doc.text('AGENT USE ONLY — REMOVE BEFORE SHARING WITH CLIENT', pageWidth / 2, y + 15, { align: 'center' });
      y += 30;
      if (sec.type === 'table' && Array.isArray(sec.data)) {
        const tableRows = sec.data.map(row => Array.isArray(row) ? row : Object.values(row).map(String));
        if (tableRows.length) {
          const colCount = tableRows[0].length || 2;
          const colW = contentWidth / colCount;
          drawTable(doc, margin, y, Array(colCount).fill(''), tableRows, Array(colCount).fill(colW), { headerFill: branding.primary_color || '#1A3226', headerTextColor: '#FFFFFF', fontSize: 8.5, rowHeight: 22, branding });
        }
      } else {
        const textContent = typeof sec.data === 'string' ? sec.data : JSON.stringify(sec.data, null, 2);
        doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(50, 50, 50);
        const tLines = doc.splitTextToSize(textContent, contentWidth);
        doc.text(tLines, margin, y);
      }
    }
  }

  await addAgentFooter(doc, branding, pageWidth, doc.internal.pageSize.getHeight());
}

async function renderBuyerIntelligencePdf(doc, data, branding) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  const contentWidth = pageWidth - 2 * margin;
  const primary = hexToRgb(branding.primary_color || '#1A3226');
  const accent = hexToRgb(branding.accent_color || '#B8982F');
  const fmt = (n) => n != null ? `$${Number(n).toLocaleString()}` : 'N/A';
  const archetypes = data.buyer_archetypes || [];
  const mig = data.migration_analysis || {};

  await drawBrandedCover(doc, branding, 'Buyer Intelligence Report', data.property_address, [
    `${archetypes.length} Buyer Archetypes Profiled`,
    `${(mig.feeder_markets || []).length} Feeder Markets Analyzed`,
  ]);

  doc.addPage();
  drawSectionDivider(doc, branding, 1, 'Market\nSnapshot', 'Current conditions · buyer competition · inventory');
  doc.addPage();
  await drawPageFrame(doc, branding, 'Section 01 · Market Snapshot', 'Market Conditions Overview');
  let y = 90;
  const mc = data.market_context || {};
  if (mc.narrative) {
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(50, 50, 50);
    const nLines = doc.splitTextToSize(mc.narrative, contentWidth);
    doc.text(nLines.slice(0, 8), margin, y); y += Math.min(nLines.length, 8) * 13 + 14;
  }
  const mcRows = [
    ['Median Sale Price', mc.median_sale_price ? fmt(mc.median_sale_price) : 'N/A'],
    ['Avg Days on Market', mc.avg_days_on_market ? `${mc.avg_days_on_market} days` : 'N/A'],
    ['Sale-to-List Ratio', mc.sale_to_list_ratio ? `${(mc.sale_to_list_ratio * 100).toFixed(1)}%` : 'N/A'],
    ['Months of Inventory', mc.months_inventory ? `${mc.months_inventory}` : 'N/A'],
  ];
  drawTable(doc, margin, y, ['Market Indicator', 'Value'], mcRows, [contentWidth - 130, 130], { headerFill: branding.primary_color || '#1A3226', headerTextColor: '#FFFFFF', fontSize: 9, rowHeight: 26, branding });

  if (archetypes.length) {
    doc.addPage();
    drawSectionDivider(doc, branding, 2, 'Buyer Archetype\nProfiles', 'Who is buying · language calibration · pool composition');
    doc.addPage();
    await drawPageFrame(doc, branding, 'Section 02 · Buyer Archetypes', 'Buyer Archetype Profiles');
    y = 90;
    archetypes.forEach((arch, idx) => {
      const cardH = 68;
      if (y + cardH > 710) { doc.addPage(); drawPageFrame(doc, branding, 'Section 02 · Buyer Archetypes', 'Buyer Archetypes (cont.)'); y = 90; }
      doc.setFillColor(idx % 2 === 0 ? 247 : 252, idx % 2 === 0 ? 247 : 252, 244);
      doc.roundedRect(margin, y, contentWidth, cardH, 3, 3, 'F');
      doc.setFillColor(primary.r, primary.g, primary.b); doc.roundedRect(margin, y, 4, cardH, 2, 2, 'F');
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(primary.r, primary.g, primary.b);
      doc.text(`${arch.archetype_name || ''}  (${arch.estimated_pool_pct || 0}%)`, margin + 12, y + 14);
      doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 60, 60);
      const pLines = doc.splitTextToSize(arch.profile || '', contentWidth - 22);
      doc.text(pLines.slice(0, 2), margin + 12, y + 28);
      if (arch.language_use?.length) {
        doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(accent.r, accent.g, accent.b);
        doc.text('USE: ', margin + 12, y + 56); doc.setFont('helvetica', 'normal'); doc.setTextColor(50, 50, 50);
        doc.text(arch.language_use.slice(0, 3).join('  ·  '), margin + 30, y + 56);
      }
      y += cardH + 6;
    });
  }

  doc.addPage();
  drawSectionDivider(doc, branding, 3, 'Offer Strategy &\nPositioning', 'Price psychology · competitive tactics · timing');
  if (mig.feeder_markets?.length || mig.employer_targets?.length) {
    doc.addPage();
    await drawPageFrame(doc, branding, 'Section 03 · Offer Strategy', 'Migration & Employer Targeting');
    y = 90;
    if (mig.feeder_markets?.length) {
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(primary.r, primary.g, primary.b);
      doc.text('Top Feeder Markets', margin, y); y += 14;
      y = drawTable(doc, margin, y, ['Feeder Market', 'Score', 'Primary Motivation', 'Price Psychology'],
        mig.feeder_markets.map(m => [m.market || '', String(m.migration_score || ''), m.primary_motivation || '', m.price_psychology || '']),
        [145, 42, 180, 165], { headerFill: branding.primary_color || '#1A3226', headerTextColor: '#FFFFFF', fontSize: 8, rowHeight: 22, branding }); y += 20;
    }
    if (mig.employer_targets?.length) {
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(primary.r, primary.g, primary.b);
      doc.text('Employer Targeting Matrix', margin, y); y += 14;
      drawTable(doc, margin, y, ['Company', 'Relevance', 'Target Roles', 'Commute'],
        mig.employer_targets.map(e => [e.company || '', e.relevance || '', e.target_roles || '', e.commute_time || '']),
        [150, 60, 190, 100], { headerFill: branding.primary_color || '#1A3226', headerTextColor: '#FFFFFF', fontSize: 7.5, rowHeight: 22, branding });
    }
  }

  await addClosingSummaryPage(doc, branding, 'Buyer Intelligence Summary', [
    ['Property Address', data.property_address || ''],
    ['Buyer Archetypes Profiled', String(archetypes.length)],
    ['Feeder Markets Analyzed', String((mig.feeder_markets || []).length)],
    ['Employer Targets', String((mig.employer_targets || []).length)],
    ['Market Characterization', mc.market_characterization || 'N/A'],
    ['Avg Days on Market', mc.avg_days_on_market ? `${mc.avg_days_on_market} days` : 'N/A'],
    ['Prepared By', branding.agent_name || ''],
    ['Report Date', new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })],
  ]);
  await addDisclaimerPage(doc, branding);
}

async function renderClientPortfolioPdf(doc, data, branding) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - 2 * margin;
  const primary = hexToRgb(branding.primary_color || '#1A3226');
  const accent = hexToRgb(branding.accent_color || '#B8982F');
  const fmt = (n) => n != null ? `$${Number(n).toLocaleString()}` : 'N/A';
  const iv = data.tiered_comps?.implied_value_range || {};
  const BODY_SIZE = 10.5;
  const LINE_H = 15;
  const BOTTOM = 720;

  // Helper: render a full narrative, paginating as needed
  async function renderNarrative(text, breadcrumb, title, startY) {
    if (!text) return startY;
    let y = startY;
    doc.setFontSize(BODY_SIZE); doc.setFont('helvetica', 'normal'); doc.setTextColor(50, 50, 50);
    const lines = doc.splitTextToSize(text, contentWidth);
    for (const line of lines) {
      if (y + LINE_H > BOTTOM) {
        doc.addPage();
        await drawPageFrame(doc, branding, breadcrumb, title);
        y = 90;
        doc.setFontSize(BODY_SIZE); doc.setFont('helvetica', 'normal'); doc.setTextColor(50, 50, 50);
      }
      doc.text(line, margin, y);
      y += LINE_H;
    }
    return y + 10;
  }

  // COVER — fix overlap: org name sits above pill with proper spacing
  doc.setFillColor(primary.r, primary.g, primary.b);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  doc.setFillColor(accent.r, accent.g, accent.b);
  doc.rect(0, 0, pageWidth, 4, 'F');
  doc.rect(0, pageHeight - 3, pageWidth, 3, 'F');

  let logoBottomY = 100;
  if (branding.org_logo_url) {
    try {
      const lr = await fetch(branding.org_logo_url);
      const lb = await lr.arrayBuffer();
      const l64 = btoa(String.fromCharCode(...new Uint8Array(lb)));
      const lext = branding.org_logo_url.toLowerCase().includes('.png') ? 'PNG' : 'JPEG';
      doc.addImage(`data:image/${lext.toLowerCase()};base64,${l64}`, lext, pageWidth / 2 - 70, 60, 140, 50, undefined, 'FAST');
      logoBottomY = 122;
    } catch (e) {
      doc.setFontSize(26); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
      doc.text(branding.org_name || '', pageWidth / 2, 94, { align: 'center' });
      logoBottomY = 110;
    }
  } else {
    doc.setFontSize(26); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
    doc.text(branding.org_name || '', pageWidth / 2, 94, { align: 'center' });
    logoBottomY = 110;
  }

  // Pill sits clearly below org name/logo with a 16pt gap
  const pillW = 280; const pillH = 26;
  const pillY = logoBottomY + 16;
  doc.setFillColor(accent.r, accent.g, accent.b);
  doc.roundedRect(pageWidth / 2 - pillW / 2, pillY, pillW, pillH, 4, 4, 'F');
  doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(primary.r, primary.g, primary.b);
  doc.text('CLIENT PORTFOLIO REVIEW', pageWidth / 2, pillY + pillH / 2 + 3, { align: 'center' });

  doc.setDrawColor(accent.r, accent.g, accent.b); doc.setLineWidth(1);
  doc.line(pageWidth / 2 - 160, pillY + pillH + 14, pageWidth / 2 + 160, pillY + pillH + 14);

  const addrParts = (data.property_address || '').split(',');
  const street = addrParts[0]?.trim() || '';
  const cityState = addrParts.slice(1).join(',').trim();
  const addrY = pillY + pillH + 38;
  doc.setFontSize(28); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
  doc.text(street, pageWidth / 2, addrY, { align: 'center', maxWidth: 460 });
  if (cityState) {
    doc.setFontSize(13); doc.setFont('helvetica', 'normal'); doc.setTextColor(accent.r, accent.g, accent.b);
    doc.text(cityState, pageWidth / 2, addrY + 22, { align: 'center' });
  }

  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  let metaY = addrY + 52;
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(180, 180, 180);
  doc.text(`${today}  ·  CONFIDENTIAL`, pageWidth / 2, metaY, { align: 'center' });
  if (branding.agent_name) {
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(180, 180, 180);
    doc.text(`Prepared by ${branding.agent_name}`, pageWidth / 2, metaY + 18, { align: 'center' });
  }
  const ctact = [branding.agent_phone, branding.agent_email].filter(Boolean).join('  ·  ');
  if (ctact) {
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(accent.r, accent.g, accent.b);
    doc.text(ctact, pageWidth / 2, metaY + 36, { align: 'center' });
  }
  doc.setFillColor(Math.min(255, primary.r + 12), Math.min(255, primary.g + 12), Math.min(255, primary.b + 12));
  doc.rect(0, pageHeight - 38, pageWidth, 38, 'F');
  doc.setFillColor(accent.r, accent.g, accent.b); doc.rect(0, pageHeight - 38, pageWidth, 1.5, 'F');
  doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(180, 180, 180);
  doc.text(branding.org_name || '', pageWidth / 2, pageHeight - 16, { align: 'center' });

  // SECTION 01: Ownership Profile
  doc.addPage();
  drawSectionDivider(doc, branding, 1, 'Your Property &\nOwnership Profile', 'What we know about the home and your ownership history');
  doc.addPage();
  await drawPageFrame(doc, branding, 'Section 01 · Ownership Profile', 'Property & Ownership Overview');
  let y = 90;
  if (data.executive_summary) {
    y = await renderNarrative(data.executive_summary, 'Section 01 · Ownership Profile', 'Property & Ownership Overview', y);
  }

  // SECTION 02: Current Value
  if (data.tiered_comps?.tiers) {
    doc.addPage();
    drawSectionDivider(doc, branding, 2, 'What Your Home Is\nWorth Today', 'Comparable sales · assessed value ratio · appreciation model');
    doc.addPage();
    await drawPageFrame(doc, branding, 'Section 02 · Current Value', 'Comparable Sales & Value Range');
    y = 90;
    if (iv.low) {
      doc.setFillColor(primary.r, primary.g, primary.b); doc.roundedRect(margin, y, contentWidth, 38, 3, 3, 'F');
      doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(accent.r, accent.g, accent.b);
      doc.text(`Estimated Value Range: ${fmt(iv.low)} – ${fmt(iv.high)}`, margin + 12, y + 24); y += 50;
    }
    // Render all tiers, not just the top one
    for (const tier of data.tiered_comps.tiers) {
      if (!tier.comps?.length) continue;
      if (y + 60 > BOTTOM) {
        doc.addPage();
        await drawPageFrame(doc, branding, 'Section 02 · Current Value', 'Comparable Sales (cont.)');
        y = 90;
      }
      const tColor = tier.tier_id === 'A' ? primary : tier.tier_id === 'B' ? accent : hexToRgb('#888888');
      doc.setFillColor(tColor.r, tColor.g, tColor.b); doc.roundedRect(margin, y, contentWidth, 22, 3, 3, 'F');
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
      doc.text(tier.tier_label || 'Tier ' + tier.tier_id, margin + 8, y + 15); y += 26;
      const rows = tier.comps.map(c => [c.address || '', c.sale_date || '', c.sale_price ? fmt(c.sale_price) : '', c.adjusted_ppsf ? `$${c.adjusted_ppsf}` : '']);
      y = drawTable(doc, margin, y, ['Address', 'Date', 'Price', 'Adj $/SF'], rows, [220, 70, 85, contentWidth - 383], { headerFill: branding.primary_color || '#1A3226', headerTextColor: '#FFFFFF', fontSize: 9, rowHeight: 24, branding });
      y += 12;
    }
    // Valuation narrative
    if (data.valuation?.narrative) {
      if (y + 40 > BOTTOM) { doc.addPage(); await drawPageFrame(doc, branding, 'Section 02 · Current Value', 'Valuation Analysis'); y = 90; }
      doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(primary.r, primary.g, primary.b);
      doc.text('Valuation Analysis', margin, y); y += 16;
      y = await renderNarrative(data.valuation.narrative, 'Section 02 · Current Value', 'Valuation Analysis', y);
    }
  }

  // SECTION 03: Financial Options
  if (data.portfolio_options?.length) {
    doc.addPage();
    drawSectionDivider(doc, branding, 3, 'Your Financial\nOptions', 'Strategic paths for putting your equity to work');
    doc.addPage();
    await drawPageFrame(doc, branding, 'Section 03 · Financial Options', 'Strategic Portfolio Options');
    y = 90;
    for (const [idx, opt] of data.portfolio_options.entries()) {
      const desc = opt.description || opt.narrative || '';
      const descLines = doc.splitTextToSize(desc, contentWidth - 22);
      const cardH = Math.max(80, 36 + descLines.length * 13 + (opt.estimated_net_proceeds ? 20 : 4));
      if (y + cardH > BOTTOM) {
        doc.addPage();
        await drawPageFrame(doc, branding, 'Section 03 · Financial Options', 'Portfolio Options (cont.)');
        y = 90;
      }
      doc.setFillColor(idx % 2 === 0 ? 247 : 252, idx % 2 === 0 ? 247 : 252, 244);
      doc.roundedRect(margin, y, contentWidth, cardH, 3, 3, 'F');
      doc.setFillColor(accent.r, accent.g, accent.b); doc.roundedRect(margin, y, 4, cardH, 2, 2, 'F');
      doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(primary.r, primary.g, primary.b);
      doc.text(opt.label || opt.title || `Option ${idx + 1}`, margin + 12, y + 18);
      doc.setFontSize(BODY_SIZE); doc.setFont('helvetica', 'normal'); doc.setTextColor(50, 50, 50);
      doc.text(descLines, margin + 12, y + 34);
      if (opt.estimated_net_proceeds) {
        doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(accent.r, accent.g, accent.b);
        doc.text(`Est. Net Proceeds: ${fmt(opt.estimated_net_proceeds)}`, margin + 12, y + cardH - 10);
      }
      y += cardH + 8;
    }
  }

  // SECTION 04: Market Context
  doc.addPage();
  drawSectionDivider(doc, branding, 4, 'Market Context &\nWhat to Watch', 'ADU development option · market conditions · value drivers');
  doc.addPage();
  await drawPageFrame(doc, branding, 'Section 04 · Market Context', 'Market Conditions & Value Drivers');
  y = 90;
  const mc = data.market_context || {};
  if (mc.narrative) {
    y = await renderNarrative(mc.narrative, 'Section 04 · Market Context', 'Market Conditions & Value Drivers', y);
  }
  // Market stats table
  const fmtPct = (n) => n != null ? `${Number(n).toFixed(1)}%` : 'N/A';
  const mcRows = [
    ['Median Sale Price', mc.median_sale_price ? fmt(mc.median_sale_price) : 'N/A'],
    ['YoY Appreciation', mc.yoy_appreciation ? fmtPct(mc.yoy_appreciation) : 'N/A'],
    ['Avg Days on Market', mc.avg_days_on_market ? `${mc.avg_days_on_market} days` : 'N/A'],
    ['Sale-to-List Ratio', mc.sale_to_list_ratio ? fmtPct(mc.sale_to_list_ratio * 100) : 'N/A'],
    ['Months of Inventory', mc.months_inventory ? `${mc.months_inventory}` : 'N/A'],
    ['Market Characterization', mc.market_characterization || 'N/A'],
  ].filter(r => r[1] !== 'N/A');
  if (mcRows.length && y + mcRows.length * 26 + 40 < BOTTOM) {
    drawTable(doc, margin, y, ['Market Indicator', 'Value'], mcRows, [contentWidth - 140, 140],
      { headerFill: branding.primary_color || '#1A3226', headerTextColor: '#FFFFFF', fontSize: 10, rowHeight: 28, branding });
  }

  // ADU analysis if present
  if (data.adu_analysis?.narrative) {
    doc.addPage();
    await drawPageFrame(doc, branding, 'Section 04 · Market Context', 'ADU Development Option');
    y = 90;
    doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(primary.r, primary.g, primary.b);
    doc.text('ADU Development Option', margin, y); y += 18;
    y = await renderNarrative(data.adu_analysis.narrative, 'Section 04 · Market Context', 'ADU Development Option', y);
  }

  await addClosingSummaryPage(doc, branding, 'Portfolio Review Summary', [
    ['Property Address', data.property_address || ''],
    ['Estimated Value Range', iv.low && iv.high ? `${fmt(iv.low)} – ${fmt(iv.high)}` : 'See Report'],
    ['Value Midpoint', iv.midpoint ? fmt(iv.midpoint) : 'See Report'],
    ['Strategic Options Analyzed', String((data.portfolio_options || []).length)],
    ['Market Characterization', mc.market_characterization || 'N/A'],
    ['Avg Days on Market', mc.avg_days_on_market ? `${mc.avg_days_on_market} days` : 'N/A'],
    ['Prepared By', branding.agent_name || ''],
    ['Report Date', new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })],
  ]);
  await addDisclaimerPage(doc, branding);
}

async function renderInvestmentPdf(doc, data, branding) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  const contentWidth = pageWidth - 2 * margin;
  const primary = hexToRgb(branding.primary_color || '#1A3226');
  const accent = hexToRgb(branding.accent_color || '#B8982F');
  const fmt = (n) => n != null ? `$${Number(n).toLocaleString()}` : 'N/A';
  const fmtPct = (n) => n != null ? `${Number(n).toFixed(1)}%` : 'N/A';
  const v = data.valuation || {};
  const mc = data.market_context || {};

  await drawBrandedCover(doc, branding, 'Investment Analysis', data.property_address, [
    `Confidence: ${v.confidence_level || 'Medium'}`,
    `Market: ${mc.market_characterization || 'See Report'}`,
  ]);

  doc.addPage();
  drawSectionDivider(doc, branding, 1, 'Property &\nMarket Overview', 'Subject property · market conditions · investment context');
  doc.addPage();
  await drawPageFrame(doc, branding, 'Section 01 · Market Overview', 'Property & Market Overview');
  let y = 90;
  if (data.executive_summary) {
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(50, 50, 50);
    const lines = doc.splitTextToSize(data.executive_summary, contentWidth);
    doc.text(lines.slice(0, 16), margin, y); y += Math.min(lines.length, 16) * 13 + 14;
  }
  const mRows = [
    ['Median Sale Price', mc.median_sale_price ? fmt(mc.median_sale_price) : 'N/A'],
    ['YoY Appreciation', mc.yoy_appreciation ? fmtPct(mc.yoy_appreciation) : 'N/A'],
    ['Avg Days on Market', mc.avg_days_on_market ? `${mc.avg_days_on_market} days` : 'N/A'],
    ['Months of Inventory', mc.months_inventory ? `${mc.months_inventory}` : 'N/A'],
  ];
  if (y + 120 < 710) drawTable(doc, margin, y, ['Indicator', 'Value'], mRows, [contentWidth - 130, 130], { headerFill: branding.primary_color || '#1A3226', headerTextColor: '#FFFFFF', fontSize: 9, rowHeight: 26, branding });

  doc.addPage();
  drawSectionDivider(doc, branding, 2, 'Income Approach\nAnalysis', 'Cap rate · GRM · cash-on-cash return · rent comps');
  if (data.tiered_comps?.tiers) {
    doc.addPage();
    await drawPageFrame(doc, branding, 'Section 02 · Income Approach', 'Comparable Sales Analysis');
    y = 90;
    for (const tier of data.tiered_comps.tiers) {
      if (y + 60 > 710) { doc.addPage(); await drawPageFrame(doc, branding, 'Section 02 · Income Approach', 'Comparable Sales (cont.)'); y = 90; }
      const tColor = tier.tier_id === 'A' ? primary : tier.tier_id === 'B' ? accent : hexToRgb('#888888');
      doc.setFillColor(tColor.r, tColor.g, tColor.b); doc.roundedRect(margin, y, contentWidth, 22, 3, 3, 'F');
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
      doc.text(tier.tier_label || 'Tier ' + tier.tier_id, margin + 8, y + 15); y += 26;
      if (tier.comps?.length) {
        const rows = tier.comps.map(c => [c.address || '', c.sale_date || '', c.sale_price ? fmt(c.sale_price) : '', c.adjusted_ppsf ? `$${c.adjusted_ppsf}` : '', c.condition_vs_subject || '']);
        y = drawTable(doc, margin, y, ['Address', 'Date', 'Price', 'Adj $/SF', 'Condition'], rows, [155, 55, 75, 65, contentWidth - 358], { headerFill: branding.primary_color || '#1A3226', headerTextColor: '#FFFFFF', fontSize: 7.5, rowHeight: 22, branding }); y += 10;
      }
    }
  }

  doc.addPage();
  drawSectionDivider(doc, branding, 3, 'Financial\nProjections', 'Five-year model · appreciation · cash flow scenarios');
  if (data.pricing_scenarios?.length) {
    doc.addPage();
    await drawPageFrame(doc, branding, 'Section 03 · Financial Projections', 'Pricing Scenarios');
    y = 90;
    const sRows = data.pricing_scenarios.map(s => [s.label || '', fmt(s.price), s.expected_dom || '', s.rationale || '']);
    drawTable(doc, margin, y, ['Scenario', 'Price', 'Est. DOM', 'Rationale'], sRows, [140, 72, 65, contentWidth - 285], { headerFill: branding.primary_color || '#1A3226', headerTextColor: '#FFFFFF', fontSize: 8.5, rowHeight: 26, branding });
  }

  doc.addPage();
  drawSectionDivider(doc, branding, 4, 'Risk Assessment &\nRecommendation', 'Vacancy risk · market headwinds · investment thesis');
  doc.addPage();
  await drawPageFrame(doc, branding, 'Section 04 · Risk Assessment', 'Risk Assessment & Recommendation');
  y = 90;
  if (v.narrative) {
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(50, 50, 50);
    const vLines = doc.splitTextToSize(v.narrative, contentWidth);
    doc.text(vLines.slice(0, 22), margin, y);
  }

  const ivr = data.tiered_comps?.implied_value_range || {};
  await addClosingSummaryPage(doc, branding, 'Investment Analysis Summary', [
    ['Property Address', data.property_address || ''],
    ['Value Range', ivr.low && ivr.high ? `${fmt(ivr.low)} – ${fmt(ivr.high)}` : 'See Report'],
    ['Confidence Level', v.confidence_level || 'Medium'],
    ['Market Characterization', mc.market_characterization || 'N/A'],
    ['YoY Appreciation', mc.yoy_appreciation ? fmtPct(mc.yoy_appreciation) : 'N/A'],
    ['Months of Inventory', mc.months_inventory ? `${mc.months_inventory}` : 'N/A'],
    ['Prepared By', branding.agent_name || ''],
    ['Report Date', new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })],
  ]);
  await addDisclaimerPage(doc, branding);
}

async function renderRentalMarketPdf(doc, data, branding) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  const contentWidth = pageWidth - 2 * margin;
  const primary = hexToRgb(branding.primary_color || '#1A3226');
  const accent = hexToRgb(branding.accent_color || '#B8982F');
  const fmt = (n) => n != null ? `$${Number(n).toLocaleString()}` : 'N/A';
  const mc = data.market_context || {};

  await drawBrandedCover(doc, branding, 'Rental Market Analysis', data.property_address, [
    `Market: ${mc.market_characterization || 'See Report'}`,
    `Analysis Year: ${new Date().getFullYear()}`,
  ]);

  doc.addPage();
  drawSectionDivider(doc, branding, 1, 'Property &\nRental Context', 'Subject property · rental market conditions · tenant demand');
  doc.addPage();
  await drawPageFrame(doc, branding, 'Section 01 · Rental Context', 'Property & Rental Market Overview');
  let y = 90;
  if (data.executive_summary) {
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(50, 50, 50);
    const lines = doc.splitTextToSize(data.executive_summary, contentWidth);
    doc.text(lines.slice(0, 22), margin, y); y += Math.min(lines.length, 22) * 13 + 14;
  }

  doc.addPage();
  drawSectionDivider(doc, branding, 2, 'Rent Range &\nComparables', 'Comparable rentals · achievable rent · positioning');
  doc.addPage();
  await drawPageFrame(doc, branding, 'Section 02 · Rent Comparables', 'Rent Range & Comparable Rentals');
  y = 90;
  if (mc.narrative) {
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(50, 50, 50);
    const mcLines = doc.splitTextToSize(mc.narrative, contentWidth);
    doc.text(mcLines.slice(0, 20), margin, y); y += Math.min(mcLines.length, 20) * 13 + 14;
  }
  const mcStats = [
    ['Avg Days on Market', mc.avg_days_on_market ? `${mc.avg_days_on_market} days` : 'N/A'],
    ['Months of Inventory', mc.months_inventory ? `${mc.months_inventory}` : 'N/A'],
    ['Market Characterization', mc.market_characterization || 'N/A'],
  ];
  if (y + 90 < 710) drawTable(doc, margin, y, ['Indicator', 'Value'], mcStats, [contentWidth - 130, 130], { headerFill: branding.primary_color || '#1A3226', headerTextColor: '#FFFFFF', fontSize: 9, rowHeight: 26, branding });

  doc.addPage();
  drawSectionDivider(doc, branding, 3, 'Landlord Economics\n& Risk Profile', 'Cash flow · vacancy risk · rent control exposure · recommendations');
  doc.addPage();
  await drawPageFrame(doc, branding, 'Section 03 · Landlord Economics', 'Cash Flow & Risk Profile');
  y = 90;
  const v = data.valuation || {};
  if (v.narrative) {
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(50, 50, 50);
    const vLines = doc.splitTextToSize(v.narrative, contentWidth);
    doc.text(vLines.slice(0, 22), margin, y);
  }

  await addClosingSummaryPage(doc, branding, 'Rental Analysis Summary', [
    ['Property Address', data.property_address || ''],
    ['Market Characterization', mc.market_characterization || 'N/A'],
    ['Avg Days on Market', mc.avg_days_on_market ? `${mc.avg_days_on_market} days` : 'N/A'],
    ['Months of Inventory', mc.months_inventory ? `${mc.months_inventory}` : 'N/A'],
    ['Prepared By', branding.agent_name || ''],
    ['Report Date', new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })],
  ]);
  await addDisclaimerPage(doc, branding);
}

function buildEmailHtml(analysis, branding) { return ''; }