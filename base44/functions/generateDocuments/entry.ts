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

    // For PPTX — delegate to dedicated generatePptx function
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

    // PDF — generate bytes then store
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

  // Dispatch to assessment-type-specific renderer
  if (analysis.output_json) {
    if (analysis.assessment_type === 'cma') {
      renderCMAPdf(doc, analysis.output_json, branding);
    } else if (analysis.assessment_type === 'listing_pricing') {
      renderListingPricingPdf(doc, analysis.output_json, branding);
    } else if (analysis.assessment_type === 'buyer_intelligence') {
      renderBuyerIntelligencePdf(doc, analysis.output_json, branding);
    } else if (analysis.assessment_type === 'client_portfolio') {
      renderClientPortfolioPdf(doc, analysis.output_json, branding);
    } else if (analysis.assessment_type === 'investment_analysis') {
      renderInvestmentPdf(doc, analysis.output_json, branding);
    } else if (analysis.assessment_type === 'rental_analysis') {
      renderRentalMarketPdf(doc, analysis.output_json, branding);
    } else {
      renderFallbackTextPdf(doc, analysis, branding);
    }
  } else {
    renderFallbackTextPdf(doc, analysis, branding);
  }

  const arrayBuffer = doc.output('arraybuffer');
  const address = analysis.intake_data?.address || analysis.id;
  const assessmentLabel = ASSESSMENT_LABELS[analysis.assessment_type] || 'Analysis';
  const safeFilename = `${assessmentLabel.replace(/\s+/g, '_')}_${Date.now()}.pdf`;

  return { bytes: arrayBuffer, mimeType: 'application/pdf', filename: safeFilename };
}

/**
 * Fallback: Text-based rendering (existing pattern)
 */
function renderFallbackTextPdf(doc, analysis, branding) {
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

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── PDF Template Renderers ────────────────────────────────────────────────────

/**
 * Reusable table drawer for all PDF templates.
 * Draws header row + data rows with alternating fills and automatic page breaks.
 */
function drawTable(doc, x, y, headers, rows, colWidths, options = {}) {
  const {
    headerFill = '#333333',
    headerTextColor = '#FFFFFF',
    rowFill = '#FFFFFF',
    altRowFill = '#F4F4F4',
    fontSize = 8,
    headerFontSize = 8,
    rowHeight = 18,
    padding = 4,
  } = options;

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const bottomMargin = 80;
  let currentY = y;

  // Parse color
  const parseColor = (hex) => {
    const clean = (hex || '#000000').replace('#', '');
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16),
    };
  };

  // Draw header row
  const headerColor = parseColor(headerFill);
  doc.setFillColor(headerColor.r, headerColor.g, headerColor.b);
  doc.rect(x, currentY, colWidths.reduce((a, b) => a + b, 0), rowHeight, 'F');
  
  doc.setFontSize(headerFontSize);
  doc.setFont('helvetica', 'bold');
  const headerTextCol = parseColor(headerTextColor);
  doc.setTextColor(headerTextCol.r, headerTextCol.g, headerTextCol.b);
  
  let cellX = x + padding;
  headers.forEach((header, i) => {
    doc.text(header, cellX, currentY + rowHeight / 2 + 3, { align: 'left' });
    cellX += colWidths[i];
  });
  
  currentY += rowHeight;

  // Draw data rows
  doc.setFontSize(fontSize);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(50, 50, 50);

  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    // Check page break
    if (currentY + rowHeight > pageHeight - bottomMargin) {
      doc.addPage();
      currentY = 60;
    }

    // Draw row background
    const rowColor = parseColor(rowIdx % 2 === 0 ? rowFill : altRowFill);
    doc.setFillColor(rowColor.r, rowColor.g, rowColor.b);
    doc.rect(x, currentY, colWidths.reduce((a, b) => a + b, 0), rowHeight, 'F');

    // Draw cell text
    cellX = x + padding;
    const row = rows[rowIdx];
    row.forEach((cell, i) => {
      // Right-align numbers
      const align = typeof cell === 'number' ? 'right' : 'left';
      const cellText = String(cell || '');
      doc.text(cellText, cellX, currentY + rowHeight / 2 + 3, { align });
      cellX += colWidths[i];
    });

    currentY += rowHeight;
  }

  return currentY;
}

/**
 * renderCMAPdf — Comparative Market Analysis
 */
function renderCMAPdf(doc, data, branding) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const primary = hexToRgb(branding.primary_color || '#333333');
  const accent = hexToRgb(branding.accent_color || '#666666');
  const margin = 40;
  const contentWidth = pageWidth - 2 * margin;

  // ────── PAGE 1: COVER ──────────────────────────────────────────────────
  doc.setFillColor(primary.r, primary.g, primary.b);
  doc.rect(0, 0, pageWidth, 100, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('Comparative Market Analysis', margin, 35);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  if (data.property_address) {
    doc.text(data.property_address, margin, 60);
  }
  if (data.property_type) {
    doc.setFontSize(10);
    doc.text(data.property_type, margin, 80);
  }

  // Agent info
  doc.setFontSize(11);
  doc.setTextColor(200, 200, 200);
  if (branding.agent_name) {
    doc.text(`Prepared by ${branding.agent_name}`, margin, pageHeight - 40);
  }
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  doc.setFontSize(9);
  doc.text(today, margin, pageHeight - 25);

  // KPI boxes
  doc.setFontSize(9);
  const kpiY = 120;
  const kpiHeight = 50;
  const kpiWidth = (contentWidth - 20) / 3;

  const kpis = [
    { label: 'Estimated Value', value: data.implied_value_range?.midpoint ? `$${(data.implied_value_range.midpoint / 1000000).toFixed(1)}M` : 'N/A' },
    { label: 'Comparable Sales', value: data.tiered_comps?.tiers?.reduce((sum, t) => sum + (t.comps?.length || 0), 0) || 'N/A' },
    { label: 'Confidence Level', value: data.confidence_level || 'Medium' },
  ];

  kpis.forEach((kpi, idx) => {
    const kpiX = margin + idx * (kpiWidth + 10);
    doc.setFillColor(primary.r, primary.g, primary.b);
    doc.rect(kpiX, kpiY, kpiWidth, kpiHeight, 'F');

    doc.setTextColor(accent.r, accent.g, accent.b);
    doc.setFont('helvetica', 'normal');
    doc.text(kpi.label, kpiX + 8, kpiY + 14);

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(String(kpi.value), kpiX + 8, kpiY + 32);
  });

  // ────── PAGE 2: MARKET OVERVIEW ────────────────────────────────────────
  doc.addPage();
  let y = margin;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primary.r, primary.g, primary.b);
  doc.text('Market Context', margin, y);
  y += 5;

  doc.setDrawColor(accent.r, accent.g, accent.b);
  doc.setLineWidth(1.5);
  doc.line(margin, y, margin + 100, y);
  y += 15;

  // Market stats
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(50, 50, 50);

  const marketStats = data.market_context || {};
  const stats = [
    ['Median Sale Price', marketStats.median_sale_price ? `$${(marketStats.median_sale_price / 1000).toFixed(0)}K` : 'N/A'],
    ['YoY Appreciation', marketStats.yoy_appreciation ? `${marketStats.yoy_appreciation.toFixed(1)}%` : 'N/A'],
    ['Avg Days on Market', marketStats.avg_days_on_market ? `${marketStats.avg_days_on_market} days` : 'N/A'],
    ['Sale-to-List Ratio', marketStats.sale_to_list_ratio ? `${(marketStats.sale_to_list_ratio * 100).toFixed(1)}%` : 'N/A'],
    ['Months of Inventory', marketStats.months_inventory ? `${marketStats.months_inventory.toFixed(1)}` : 'N/A'],
  ];

  stats.forEach((stat, idx) => {
    const rowY = y + idx * 18;
    if (idx % 2 === 0) {
      doc.setFillColor(244, 244, 244);
      doc.rect(margin, rowY - 8, contentWidth, 18, 'F');
    }
    doc.setTextColor(50, 50, 50);
    doc.text(stat[0], margin + 8, rowY + 2);
    doc.text(stat[1], margin + contentWidth - 8, rowY + 2, { align: 'right' });
  });

  // ────── PAGE 3-4: TIERED COMPARABLES ──────────────────────────────────
  doc.addPage();
  y = margin;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primary.r, primary.g, primary.b);
  doc.text('Comparable Sales Analysis', margin, y);
  y += 20;

  if (data.tiered_comps?.tiers) {
    data.tiered_comps.tiers.forEach((tier, tierIdx) => {
      // Tier header
      const tierColor = tier.tier_id === 'A' ? primary : tier.tier_id === 'B' ? accent : hexToRgb('#999999');
      doc.setFillColor(tierColor.r, tierColor.g, tierColor.b);
      doc.rect(margin, y, contentWidth, 20, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      const ppsf = tier.ppsf_range ? `$${tier.ppsf_range.low} – $${tier.ppsf_range.high}/SF` : '';
      doc.text(`${tier.tier_label} (${ppsf})`, margin + 8, y + 14);
      y += 22;

      // Comp table
      if (tier.comps && tier.comps.length > 0) {
        const headers = ['Address', 'Date', 'Price', 'SF', 'Raw $/SF', 'Adj $/SF', 'Condition'];
        const colWidths = [110, 50, 70, 50, 60, 70, 60];
        const rows = tier.comps.map(c => [
          c.address || '',
          c.sale_date || '',
          c.sale_price ? `$${(c.sale_price / 1000).toFixed(0)}K` : '',
          c.square_feet ? `${c.square_feet.toLocaleString()}` : '',
          c.raw_ppsf ? `$${c.raw_ppsf}` : '',
          c.adjusted_ppsf ? `$${c.adjusted_ppsf}` : '',
          c.condition_vs_subject || '',
        ]);

        y = drawTable(doc, margin, y, headers, rows, colWidths, {
          headerFill: tierColor.r * 256 * 256 + tierColor.g * 256 + tierColor.b,
          headerTextColor: '#FFFFFF',
          fontSize: 8,
          rowHeight: 16,
        });
        y += 10;
      }
    });
  }

  // Implied value range
  if (data.implied_value_range) {
    doc.setFillColor(primary.r, primary.g, primary.b);
    doc.rect(margin, y, contentWidth, 22, 'F');
    doc.setTextColor(accent.r, accent.g, accent.b);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    const low = data.implied_value_range.low ? `$${(data.implied_value_range.low / 1000000).toFixed(2)}M` : '';
    const high = data.implied_value_range.high ? `$${(data.implied_value_range.high / 1000000).toFixed(2)}M` : '';
    doc.text(`Implied Value Range: ${low} – ${high}`, margin + 8, y + 14);
    y += 26;
  }

  // Thin comp warning
  if (data.tiered_comps?.comp_date_window?.thin_comp_flag) {
    doc.setFontSize(8);
    doc.setTextColor(200, 0, 0);
    doc.text('⚠ Thin comp set — fewer than 4 comparable sales within 18 months. Valuation confidence is reduced.', margin, y);
  }
}

/**
 * Placeholder functions for other assessment types (to be built)
 */
function renderListingPricingPdf(doc, data, branding) {
  // TODO: Build listing_pricing template
}

function renderBuyerIntelligencePdf(doc, data, branding) {
  // TODO: Build buyer_intelligence template
}

function renderClientPortfolioPdf(doc, data, branding) {
  // TODO: Build client_portfolio template
}

function renderInvestmentPdf(doc, data, branding) {
  // TODO: Build investment_analysis template
}

function renderRentalMarketPdf(doc, data, branding) {
  // TODO: Build rental_analysis template
}

// ─── Helper: Email HTML Builder ────────────────────────────────────────────

function buildEmailHtml(analysis, branding) {
  const primary = branding.primary_color || '#333333';
  const accent = branding.accent_color || '#666666';
}