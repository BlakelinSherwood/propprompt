import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * generatePortfolioPdf — renders the client_portfolio PDF and returns a base64 string of bytes.
 * Called by generateDocuments when assessment_type === 'client_portfolio'.
 * POST body: { analysisId, branding }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { analysisId, branding } = await req.json();
    if (!analysisId || !branding) return Response.json({ error: 'analysisId and branding required' }, { status: 400 });

    const analyses = await base44.asServiceRole.entities.Analysis.filter({ id: analysisId });
    const analysis = analyses[0];
    if (!analysis) return Response.json({ error: 'Analysis not found' }, { status: 404 });
    if (!analysis.output_json) return Response.json({ error: 'No output_json on analysis' }, { status: 400 });

    const { jsPDF } = await import('npm:jspdf@2.5.2');
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });

    await renderClientPortfolioPdf(doc, analysis.output_json, branding);

    const arrayBuffer = doc.output('arraybuffer');
    const bytes = new Uint8Array(arrayBuffer);
    const base64 = btoa(String.fromCharCode(...bytes));

    return Response.json({ base64, filename: `Client_Portfolio_Review_${Date.now()}.pdf` });
  } catch (err) {
    console.error('[generatePortfolioPdf] error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hexToRgb(hex) {
  const clean = (hex || '#000000').replace('#', '');
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function prettifyEnum(val) {
  if (!val) return val;
  return val.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
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

  // Ghost number watermark — bottom right, large
  const ghostNum = String(sectionNum).padStart(2, '0');
  const gL = Math.min(255, primary.r + 28);
  const gLG = Math.min(255, primary.g + 28);
  const gLB = Math.min(255, primary.b + 28);
  doc.setFontSize(200); doc.setFont('helvetica', 'bold'); doc.setTextColor(gL, gLG, gLB);
  doc.text(ghostNum, pageWidth - 20, pageHeight - 60, { align: 'right' });

  // Center content vertically — place at ~38% down the page
  const contentStartY = pageHeight * 0.38;
  const headerLineY = contentStartY - 56;

  doc.setDrawColor(accent.r, accent.g, accent.b); doc.setLineWidth(1);
  doc.line(40, headerLineY, 390, headerLineY);

  doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(accent.r, accent.g, accent.b);
  doc.text(`SECTION ${String(sectionNum).padStart(2, '0')}`, 40, headerLineY + 22);

  doc.setFillColor(accent.r, accent.g, accent.b);
  doc.rect(40, contentStartY + 4, 3, 60, 'F');

  doc.setFontSize(30); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
  const titleLines = doc.splitTextToSize(sectionTitle.replace(/\n/g, ' '), 460);
  doc.text(titleLines.slice(0, 2), 52, contentStartY + 20);
  const titleBlockH = Math.min(titleLines.length, 2) * 36;

  if (subtitle) {
    doc.setFontSize(11); doc.setFont('helvetica', 'normal'); doc.setTextColor(accent.r, accent.g, accent.b);
    doc.text(subtitle, 52, contentStartY + titleBlockH + 14, { maxWidth: 480 });
  }

  // Decorative horizontal rule below subtitle
  const ruleY = contentStartY + titleBlockH + 38;
  doc.setDrawColor(Math.min(255, primary.r + 35), Math.min(255, primary.g + 35), Math.min(255, primary.b + 35));
  doc.setLineWidth(0.5);
  doc.line(52, ruleY, pageWidth - 40, ruleY);

  // Section number in full text — bottom right accent
  doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(accent.r, accent.g, accent.b);
  doc.text(`SECTION ${String(sectionNum).padStart(2, '0')} OF 06`, pageWidth - 40, ruleY + 18, { align: 'right' });

  const footerText = [branding.agent_name, branding.org_name].filter(Boolean).join(' · ');
  doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(180, 180, 180);
  doc.text(footerText, 40, 758);
  doc.setFontSize(5.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(110, 110, 110);
  doc.text('Proprietary PropPrompt system built by Blake Sherwood | Sherwood & Company Team | Confidential', pageWidth / 2, 770, { align: 'center' });
}

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
  doc.setFontSize(5.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(160, 160, 160);
  doc.text('Proprietary PropPrompt system built by Blake Sherwood | Sherwood & Company Team | Confidential', pageWidth / 2, 770, { align: 'center' });

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

function drawTable(doc, x, y, headers, rows, colWidths, options = {}) {
  const { headerFill = '#1A3226', headerTextColor = '#FFFFFF', altRowFill = '#F4F1EA', fontSize = 8, headerFontSize = 8, rowHeight = 24, padding = 8, branding = null } = options;
  const pageHeight = doc.internal.pageSize.getHeight();
  const bottomMargin = 65;
  const totalWidth = colWidths.reduce((a, b) => a + b, 0);
  let currentY = y;
  const parseColor = (hex) => { const clean = (hex || '#000000').replace('#', ''); return { r: parseInt(clean.slice(0, 2), 16), g: parseInt(clean.slice(2, 4), 16), b: parseInt(clean.slice(4, 6), 16) }; };
  const drawHeaderRow = () => {
    const hc = parseColor(headerFill);
    doc.setFillColor(hc.r, hc.g, hc.b); doc.rect(x, currentY, totalWidth, rowHeight + 4, 'F');
    doc.setFontSize(headerFontSize); doc.setFont('helvetica', 'bold');
    const htc = parseColor(headerTextColor); doc.setTextColor(htc.r, htc.g, htc.b);
    let cellX = x + padding;
    headers.forEach((h, i) => { doc.text(h, cellX, currentY + (rowHeight + 4) / 2 + 3); cellX += colWidths[i]; });
    currentY += rowHeight + 4;
  };
  drawHeaderRow();
  doc.setFontSize(fontSize); doc.setFont('helvetica', 'normal');
  for (let ri = 0; ri < rows.length; ri++) {
    if (currentY + rowHeight > pageHeight - bottomMargin) { doc.addPage(); if (branding) drawPageFrame(doc, branding, null, null); currentY = 90; drawHeaderRow(); doc.setFontSize(fontSize); doc.setFont('helvetica', 'normal'); }
    const isAlt = ri % 2 !== 0;
    if (isAlt) { const arc = parseColor(altRowFill); doc.setFillColor(arc.r, arc.g, arc.b); } else { doc.setFillColor(255, 255, 255); }
    doc.rect(x, currentY, totalWidth, rowHeight, 'F');
    doc.setDrawColor(224, 221, 214); doc.setLineWidth(0.5); doc.line(x, currentY + rowHeight, x + totalWidth, currentY + rowHeight);
    doc.setTextColor(26, 26, 26);
    let cellX = x + padding;
    rows[ri].forEach((cell, ci) => {
      const maxW = colWidths[ci] - padding * 2;
      const wrapped = doc.splitTextToSize(String(cell ?? ''), maxW);
      doc.text(wrapped[0], cellX, currentY + rowHeight / 2 + 3);
      cellX += colWidths[ci];
    });
    currentY += rowHeight;
  }
  return currentY;
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
  doc.setFillColor(accent.r, accent.g, accent.b); doc.roundedRect(ctX, 150, ctW, rh, 2, 2, 'F');
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
  const margin = 40; const contentWidth = pageWidth - 2 * margin;
  const primary = hexToRgb(branding.primary_color || '#1A3226');
  doc.addPage(); await drawPageFrame(doc, branding, 'Disclosures', 'Important Disclosures');
  let y = 90;
  const paras = [
    'NOT LEGAL OR FINANCIAL ADVICE: This PropPrompt™ report is generated by artificial intelligence for informational and planning purposes only. It does not constitute legal, financial, tax, or professional real estate advice. All data and valuations should be independently verified by a licensed professional.',
    'NET PROCEEDS ESTIMATES: Estimated net proceeds are approximations and exclude federal and state capital gains taxes, depreciation recapture, mortgage prepayment penalties, HOA transfer fees, and other transaction costs.',
    'COMPARABLE SALES DATA: Comparable sales are sourced from publicly available MLS records, county registry data, and AI-assembled research. Adjustments are estimates, not appraisal-grade adjustments.',
    'AVM ESTIMATES: Third-party Automated Valuation Model estimates are for informational purposes only and may not reflect property-specific conditions, recent renovations, or local market nuances.',
    'EQUITY OPTIONS: All financial option analyses are estimates only. Rates, payoff balances, and market values should be verified with licensed lenders and appraisers before any financial decision.',
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
      const lines = doc.splitTextToSize(para, contentWidth); doc.text(lines, margin, y); y += lines.length * 12 + 14;
    }
  }
}

// ─── Main Renderer ────────────────────────────────────────────────────────────

async function renderClientPortfolioPdf(doc, data, branding) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - 2 * margin;
  const primary = hexToRgb(branding.primary_color || '#1A3226');
  const accent = hexToRgb(branding.accent_color || '#B8982F');
  const fmt = (n) => n != null ? `$${Number(n).toLocaleString()}` : 'N/A';
  const fmtPct = (n) => n != null ? `${Number(n).toFixed(1)}%` : 'N/A';
  const iv = data.tiered_comps?.implied_value_range || {};
  const BODY_SIZE = 10.5;
  const LINE_H = 15;
  const BOTTOM = 720;

  async function renderNarrative(text, breadcrumb, title, startY) {
    if (!text) return startY;
    let y = startY;
    doc.setFontSize(BODY_SIZE); doc.setFont('helvetica', 'normal'); doc.setTextColor(50, 50, 50);
    const lines = doc.splitTextToSize(text, contentWidth);
    for (const line of lines) {
      if (y + LINE_H > BOTTOM) { doc.addPage(); await drawPageFrame(doc, branding, breadcrumb, title); y = 90; doc.setFontSize(BODY_SIZE); doc.setFont('helvetica', 'normal'); doc.setTextColor(50, 50, 50); }
      doc.text(line, margin, y); y += LINE_H;
    }
    return y + 10;
  }

  // ── COVER — clean, no value reveal ──
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

  // Season/year pill
  const cpMonth = new Date().getMonth();
  const cpYear = new Date().getFullYear();
  const cpSeason = cpMonth < 3 ? 'Winter' : cpMonth < 6 ? 'Spring' : cpMonth < 9 ? 'Summer' : 'Fall';
  const pillLabel = `ANNUAL HOMEOWNER PORTFOLIO REVIEW  ·  ${cpSeason.toUpperCase()} ${cpYear}`;
  const pillW = 320; const pillH = 26; const pillY = logoBottomY + 16;
  doc.setFillColor(accent.r, accent.g, accent.b);
  doc.roundedRect(pageWidth / 2 - pillW / 2, pillY, pillW, pillH, 4, 4, 'F');
  doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(primary.r, primary.g, primary.b);
  doc.text(pillLabel, pageWidth / 2, pillY + pillH / 2 + 3, { align: 'center' });

  doc.setDrawColor(accent.r, accent.g, accent.b); doc.setLineWidth(1);
  doc.line(pageWidth / 2 - 160, pillY + pillH + 14, pageWidth / 2 + 160, pillY + pillH + 14);

  const addrParts = (data.property_address || '').split(',');
  const street = addrParts[0]?.trim() || '';
  const cityState = addrParts.slice(1).join(',').trim();
  const addrY = pillY + pillH + 56;
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
  // Decorative mid-section divider line
  const dividerY = metaY + 70;
  doc.setDrawColor(accent.r, accent.g, accent.b); doc.setLineWidth(0.5);
  doc.line(margin + 40, dividerY, pageWidth - margin - 40, dividerY);

  // Report contents preview block
  const sections = ['Property & Ownership Profile', 'Current Valuation & Comps', 'Equity Strategy Options', 'Design & Renovation Trends', 'Local Market Intelligence'];
  let secY = dividerY + 22;
  doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(accent.r, accent.g, accent.b);
  doc.text('REPORT INCLUDES', pageWidth / 2, secY, { align: 'center' }); secY += 14;
  sections.forEach((s, i) => {
    const numX = pageWidth / 2 - 120;
    doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(accent.r, accent.g, accent.b);
    doc.text(String(i + 1).padStart(2, '0'), numX, secY);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(160, 160, 160);
    doc.text(s, numX + 18, secY);
    secY += 16;
  });

  // Bottom footer bar
  doc.setFillColor(Math.min(255, primary.r + 12), Math.min(255, primary.g + 12), Math.min(255, primary.b + 12));
  doc.rect(0, pageHeight - 38, pageWidth, 38, 'F');
  doc.setFillColor(accent.r, accent.g, accent.b); doc.rect(0, pageHeight - 38, pageWidth, 1.5, 'F');
  doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(180, 180, 180);
  doc.text(branding.org_name || '', pageWidth / 2, pageHeight - 16, { align: 'center' });

  // ── SECTION 01: Ownership Profile ──
  doc.addPage();
  drawSectionDivider(doc, branding, 1, 'Your Property &\nOwnership Profile', 'What we know about the home and your ownership history');
  doc.addPage();
  await drawPageFrame(doc, branding, 'Section 01 · Ownership Profile', 'Property & Ownership Overview');
  let y = 90;
  if (data.executive_summary) {
    y = await renderNarrative(data.executive_summary, 'Section 01 · Ownership Profile', 'Property & Ownership Overview', y);
  }

  // Property detail stat blocks
  const propCtx = data.property_context || {};
  const intake = data.intake_data || {};
  const statItems = [
    { label: 'Year Built', value: data.year_built || intake.year_built || '—' },
    { label: 'Bedrooms', value: data.bedrooms || intake.bedrooms || '—' },
    { label: 'Bathrooms', value: data.bathrooms || intake.bathrooms || '—' },
    { label: 'Sq Ft (Above Grade)', value: data.sqft ? `${Number(data.sqft).toLocaleString()} SF` : (intake.sqft ? `${Number(intake.sqft).toLocaleString()} SF` : '—') },
    { label: 'Lot Size', value: data.lot_size_sqft ? `${Number(data.lot_size_sqft).toLocaleString()} SF` : '—' },
    { label: 'Property Type', value: data.property_style || intake.property_type || '—' },
    { label: 'Walk Score', value: propCtx.walkability?.walk_score != null ? `${propCtx.walkability.walk_score}/100` : '—' },
    { label: 'Flood Zone', value: propCtx.flood_zone?.flood_zone || '—' },
  ].filter(s => s.value !== '—');

  if (statItems.length > 0) {
    if (y + 80 > BOTTOM) { doc.addPage(); await drawPageFrame(doc, branding, 'Section 01 · Ownership Profile', 'Property Details'); y = 90; }
    y += 8;
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(primary.r, primary.g, primary.b);
    doc.text('Property Details', margin, y); y += 10;
    doc.setDrawColor(accent.r, accent.g, accent.b); doc.setLineWidth(1.5); doc.line(margin, y, margin + 120, y); y += 14;
    const cols = 4;
    const cardW = (contentWidth - (cols - 1) * 8) / cols;
    const cardH = 48;
    statItems.forEach((s, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = margin + col * (cardW + 8);
      const cy = y + row * (cardH + 8);
      doc.setFillColor(primary.r, primary.g, primary.b);
      doc.roundedRect(cx, cy, cardW, cardH, 3, 3, 'F');
      doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(accent.r, accent.g, accent.b);
      doc.text(s.label.toUpperCase(), cx + cardW / 2, cy + 14, { align: 'center' });
      doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
      const valStr = String(s.value);
      const valLines = doc.splitTextToSize(valStr, cardW - 8);
      doc.text(valLines[0], cx + cardW / 2, cy + 32, { align: 'center' });
    });
    const totalRows = Math.ceil(statItems.length / cols);
    y += totalRows * (cardH + 8) + 8;
  }

  // Schools block if available
  const schools = propCtx.schools?.assigned_schools || [];
  if (schools.length > 0) {
    if (y + 60 > BOTTOM) { doc.addPage(); await drawPageFrame(doc, branding, 'Section 01 · Ownership Profile', 'Schools'); y = 90; }
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(primary.r, primary.g, primary.b);
    doc.text('Assigned Schools', margin, y); y += 10;
    doc.setDrawColor(accent.r, accent.g, accent.b); doc.setLineWidth(1.5); doc.line(margin, y, margin + 120, y); y += 14;
    for (const sch of schools.slice(0, 4)) {
      const schLabel = `${sch.name} (${sch.type}, ${sch.grades})${sch.rating ? '  —  GreatSchools: ' + sch.rating + '/10' : ''}  ·  ${sch.distance_miles} mi`;
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(50, 50, 50);
      doc.text('•  ' + schLabel, margin + 8, y, { maxWidth: contentWidth - 10 }); y += 14;
    }
    y += 6;
  }

  // ── SECTION 02: Current Value ──
  if (data.tiered_comps?.tiers) {
    doc.addPage();
    drawSectionDivider(doc, branding, 2, 'What Your Home Is\nWorth Today', 'Comparable sales · assessed value ratio · appreciation model');
    doc.addPage();
    await drawPageFrame(doc, branding, 'Section 02 · Current Value', 'Comparable Sales & Valuation');
    y = 90;

    // 3-column valuation convergence cards with ghost numbers
    if (iv.low && data.valuation?.methods?.length) {
      const methods = data.valuation.methods.slice(0, 3);
      const cardW = (contentWidth - 12) / 3;
      const cardH = 130;
      methods.forEach((m, i) => {
        const cx = margin + i * (cardW + 6);
        doc.setFillColor(primary.r, primary.g, primary.b);
        doc.roundedRect(cx, y, cardW, cardH, 4, 4, 'F');
        doc.setFillColor(accent.r, accent.g, accent.b);
        doc.roundedRect(cx, y + cardH - 2, cardW, 2, 0, 0, 'F');
        // Ghost number
        const gL = Math.min(255, primary.r + 24); const gLG = Math.min(255, primary.g + 24); const gLB = Math.min(255, primary.b + 24);
        doc.setFontSize(64); doc.setFont('helvetica', 'bold'); doc.setTextColor(gL, gLG, gLB);
        doc.text(String(i + 1).padStart(2, '0'), cx + cardW - 8, y + 56, { align: 'right' });
        // Method title
        doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
        const tL = doc.splitTextToSize(m.method_name || m.name || '', cardW - 16);
        doc.text(tL.slice(0, 2), cx + 10, y + 22);
        // Divider
        doc.setDrawColor(accent.r, accent.g, accent.b); doc.setLineWidth(0.8);
        doc.line(cx + 10, y + 42, cx + cardW - 10, y + 42);
        // Range
        const rangeText = m.value_range || (m.low && m.high ? `${fmt(m.low)} – ${fmt(m.high)}` : (m.value ? fmt(m.value) : '—'));
        doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(accent.r, accent.g, accent.b);
        doc.text(rangeText, cx + 10, y + 60, { maxWidth: cardW - 14 });
        // Description
        if (m.description || m.rationale) {
          doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(200, 200, 200);
          const dL = doc.splitTextToSize(m.description || m.rationale || '', cardW - 16);
          doc.text(dL.slice(0, 3), cx + 10, y + 76);
        }
      });
      y += cardH + 12;

      // Convergence banner
      doc.setFillColor(accent.r, accent.g, accent.b);
      doc.roundedRect(margin, y, contentWidth, 32, 3, 3, 'F');
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(primary.r, primary.g, primary.b);
      doc.text(`ALL THREE METHODS CONVERGE ON  ${fmt(iv.low)} – ${fmt(iv.high)}`, pageWidth / 2, y + 13, { align: 'center' });
      doc.setFontSize(8); doc.setFont('helvetica', 'normal');
      doc.text(`Estimated Current Market Value (Midpoint): ${fmt(iv.midpoint)}  ·  This is a value estimate, not a list price.`, pageWidth / 2, y + 25, { align: 'center' });
      y += 44;
    } else if (iv.low) {
      doc.setFillColor(primary.r, primary.g, primary.b); doc.roundedRect(margin, y, contentWidth, 38, 3, 3, 'F');
      doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(accent.r, accent.g, accent.b);
      doc.text(`Estimated Value Range: ${fmt(iv.low)} – ${fmt(iv.high)}`, margin + 12, y + 24); y += 50;
    }

    // Comparable tiers
    for (const tier of data.tiered_comps.tiers) {
      if (!tier.comps?.length) continue;
      if (y + 60 > BOTTOM) { doc.addPage(); await drawPageFrame(doc, branding, 'Section 02 · Current Value', 'Comparable Sales (cont.)'); y = 90; }
      const tColor = tier.tier_id === 'A' ? primary : tier.tier_id === 'B' ? accent : hexToRgb('#888888');
      doc.setFillColor(tColor.r, tColor.g, tColor.b); doc.roundedRect(margin, y, contentWidth, 22, 3, 3, 'F');
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
      doc.text(tier.tier_label || 'Tier ' + tier.tier_id, margin + 8, y + 15); y += 26;
      const rows = tier.comps.map(c => [c.address || '', c.sale_date || '', c.sale_price ? fmt(c.sale_price) : '', c.adjusted_ppsf ? `$${c.adjusted_ppsf}` : '']);
      y = drawTable(doc, margin, y, ['Address', 'Date', 'Price', 'Adj $/SF'], rows, [220, 70, 85, contentWidth - 383], { headerFill: branding.primary_color || '#1A3226', headerTextColor: '#FFFFFF', fontSize: 9, rowHeight: 24, branding });
      y += 12;
    }

    if (data.valuation?.narrative) {
      if (y + 40 > BOTTOM) { doc.addPage(); await drawPageFrame(doc, branding, 'Section 02 · Current Value', 'Valuation Analysis'); y = 90; }
      doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(primary.r, primary.g, primary.b);
      doc.text('Valuation Analysis', margin, y); y += 16;
      y = await renderNarrative(data.valuation.narrative, 'Section 02 · Current Value', 'Valuation Analysis', y);
    }
  }

  // ── SECTION 03: Equity Options ──
  const equityOptions = data.equity_options || [];
  const portfolioOptions = data.portfolio_options || [];
  if (equityOptions.length || portfolioOptions.length) {
    doc.addPage();
    drawSectionDivider(doc, branding, 3, 'What Can You Do\nWith Your Equity?', 'Move up · downsize · HELOC · refinance · renovate');

    const firstOpt = equityOptions[0];
    const grossEquity = firstOpt?.financial_snapshot?.estimated_gross_equity ?? null;
    const netEquity = firstOpt?.financial_snapshot?.net_equity_available ?? null;
    doc.addPage();
    await drawPageFrame(doc, branding, 'Section 03 · Equity Options', 'Your Equity Position');
    y = 90;

    if (grossEquity || netEquity) {
      doc.setFillColor(primary.r, primary.g, primary.b);
      doc.roundedRect(margin, y, contentWidth, 64, 4, 4, 'F');
      doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(accent.r, accent.g, accent.b);
      doc.text('ESTIMATED GROSS EQUITY', margin + 14, y + 16);
      doc.setFontSize(26); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
      doc.text(grossEquity ? fmt(grossEquity) : '—', margin + 14, y + 44);
      if (netEquity) {
        doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(accent.r, accent.g, accent.b);
        doc.text(`Est. Net After Costs: ${fmt(netEquity)}`, margin + contentWidth * 0.5, y + 44);
      }
      y += 76;
      if (firstOpt?.financial_snapshot?.notes) {
        doc.setFontSize(7.5); doc.setFont('helvetica', 'italic'); doc.setTextColor(120, 120, 120);
        doc.text(firstOpt.financial_snapshot.notes, margin, y, { maxWidth: contentWidth }); y += 18;
      }
      y += 8;
    }

    const TIMING_COLORS = { favorable: { r: 22, g: 101, b: 52 }, neutral: { r: 101, g: 85, b: 22 }, unfavorable: { r: 153, g: 27, b: 27 } };
    const OPTION_ICONS = { move_up: 'UP', downsize: 'DN', heloc: 'HE', refinance: 'RF', renovate: 'RN' };
    const OPTION_LABELS = { move_up: 'Move Up', downsize: 'Down', heloc: 'HELOC', refinance: 'Refi', renovate: 'Reno' };

    for (const [idx, opt] of equityOptions.entries()) {
      const summaryLines = doc.splitTextToSize(opt.option_summary || '', contentWidth - 80);
      const prosLines = (opt.pros || []).slice(0, 3);
      const consLines = (opt.cons || []).slice(0, 2);
      const cardH = Math.max(110, 44 + summaryLines.length * 13 + (prosLines.length + consLines.length) * 13 + 22);
      if (y + cardH > BOTTOM) { doc.addPage(); await drawPageFrame(doc, branding, 'Section 03 · Equity Options', 'Equity Options (cont.)'); y = 90; }

      doc.setFillColor(idx % 2 === 0 ? 247 : 253, idx % 2 === 0 ? 247 : 253, 244);
      doc.roundedRect(margin, y, contentWidth, cardH, 4, 4, 'F');
      doc.setFillColor(primary.r, primary.g, primary.b); doc.roundedRect(margin, y, 5, cardH, 2, 2, 'F');
      doc.setFillColor(accent.r, accent.g, accent.b); doc.roundedRect(margin + 10, y + 10, 34, 22, 3, 3, 'F');
      doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(primary.r, primary.g, primary.b);
      doc.text(OPTION_LABELS[opt.id] || (opt.title || '').slice(0, 5).toUpperCase(), margin + 27, y + 24, { align: 'center', maxWidth: 30 });
      doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(primary.r, primary.g, primary.b);
      doc.text(opt.title || '', margin + 46, y + 16);
      doc.setFontSize(8.5); doc.setFont('helvetica', 'italic'); doc.setTextColor(accent.r, accent.g, accent.b);
      doc.text(opt.tagline || '', margin + 46, y + 28);

      const tc = TIMING_COLORS[opt.market_timing] || TIMING_COLORS.neutral;
      const timingW = 70;
      doc.setFillColor(tc.r, tc.g, tc.b); doc.roundedRect(margin + contentWidth - timingW - 5, y + 8, timingW, 18, 3, 3, 'F');
      doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
      doc.text((opt.market_timing || 'neutral').toUpperCase(), margin + contentWidth - timingW / 2 - 5, y + 20, { align: 'center' });

      let cy = y + 44;
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(50, 50, 50);
      doc.text(summaryLines, margin + 14, cy); cy += summaryLines.length * 13 + 8;

      if (prosLines.length) {
        doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(22, 101, 52);
        doc.text('✓ PROS', margin + 14, cy); doc.setFont('helvetica', 'normal');
        prosLines.forEach((p, pi) => { doc.setTextColor(40, 40, 40); doc.text(`• ${p}`, margin + 14, cy + 11 + pi * 12); });
      }
      if (consLines.length) {
        doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(153, 27, 27);
        doc.text('✗ CONS', margin + contentWidth / 2, cy); doc.setFont('helvetica', 'normal');
        consLines.forEach((c, ci) => { doc.setTextColor(40, 40, 40); doc.text(`• ${c}`, margin + contentWidth / 2, cy + 11 + ci * 12); });
      }
      cy += Math.max(prosLines.length, consLines.length) * 12 + 18;
      if (opt.ideal_if) {
        doc.setFontSize(7.5); doc.setFont('helvetica', 'italic'); doc.setTextColor(100, 100, 100);
        doc.text(`Ideal if: ${opt.ideal_if}`, margin + 14, cy, { maxWidth: contentWidth - 20 });
      }
      y += cardH + 10;
    }

    if (!equityOptions.length && portfolioOptions.length) {
      for (const [idx, opt] of portfolioOptions.entries()) {
        const desc = opt.description || opt.narrative || '';
        const descLines = doc.splitTextToSize(desc, contentWidth - 22);
        const cardH = Math.max(80, 36 + descLines.length * 13 + (opt.estimated_net_proceeds ? 20 : 4));
        if (y + cardH > BOTTOM) { doc.addPage(); await drawPageFrame(doc, branding, 'Section 03 · Equity Options', 'Portfolio Options (cont.)'); y = 90; }
        doc.setFillColor(idx % 2 === 0 ? 247 : 252, 247, 244); doc.roundedRect(margin, y, contentWidth, cardH, 3, 3, 'F');
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
  }

  // ── SECTION 04: Design & Renovation Trends ──
  const dt = data.design_trends || {};
  if (dt.kitchen_styles?.length || dt.paint_colors?.length || dt.popular_renovations?.length) {
    doc.addPage();
    drawSectionDivider(doc, branding, 4, `${dt.trend_year || new Date().getFullYear()} Design &\nRenovation Trends`, 'Kitchen styles · paint colors · top renovations by ROI');
    doc.addPage();
    await drawPageFrame(doc, branding, 'Section 04 · Design Trends', 'Design & Renovation Intelligence');
    y = 90;
    if (dt.intro) { const il=doc.splitTextToSize(dt.intro,contentWidth); doc.setFontSize(10); doc.setFont('helvetica','italic'); doc.setTextColor(80,80,80); doc.text(il,margin,y); y+=il.length*14+14; }
    if (dt.kitchen_styles?.length) {
      doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(primary.r,primary.g,primary.b); doc.text('Kitchen Styles Trending Now',margin,y); y+=12;
      doc.setDrawColor(accent.r,accent.g,accent.b); doc.setLineWidth(1.5); doc.line(margin,y,margin+180,y); y+=12;
      for (const [ki,ks] of dt.kitchen_styles.entries()) {
        const roiBadgeW = 100;
        const textMaxW = contentWidth - 24 - roiBadgeW - 12; // leave room for ROI badge column
        const dl=doc.splitTextToSize(ks.description||'',textMaxW);
        const rl=ks.relevance_to_subject?doc.splitTextToSize(`Relevance: ${ks.relevance_to_subject}`,textMaxW):[];
        const ch=Math.max(72,38+dl.length*13+rl.length*11+16);
        if(y+ch>BOTTOM){doc.addPage();await drawPageFrame(doc,branding,'Section 04 · Design Trends','Kitchen Styles (cont.)');y=90;}
        doc.setFillColor(ki%2===0?248:255,ki%2===0?245:255,240); doc.roundedRect(margin,y,contentWidth,ch,3,3,'F');
        doc.setFillColor(accent.r,accent.g,accent.b); doc.roundedRect(margin,y,4,ch,2,2,'F');
        doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(primary.r,primary.g,primary.b); doc.text(ks.trend||'',margin+14,y+16);
        if(ks.cost_range){doc.setFontSize(8);doc.setFont('helvetica','normal');doc.setTextColor(100,100,100);doc.text(ks.cost_range,margin+14,y+27);}
        if(ks.roi_estimate){
          // ROI badge on right — two lines with proper sizing
          const roiLines = doc.splitTextToSize(ks.roi_estimate, roiBadgeW - 8);
          const roiBadgeH = Math.max(20, roiLines.length * 11 + 8);
          doc.setFillColor(primary.r,primary.g,primary.b);
          doc.roundedRect(margin+contentWidth-roiBadgeW-4,y+8,roiBadgeW,roiBadgeH,2,2,'F');
          doc.setFontSize(7);doc.setFont('helvetica','bold');doc.setTextColor(accent.r,accent.g,accent.b);
          roiLines.forEach((rl2, ri) => {
            doc.text(rl2, margin+contentWidth-roiBadgeW/2-4, y+18+ri*10, {align:'center'});
          });
        }
        doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(50,50,50); doc.text(dl,margin+14,y+40);
        if(rl.length){doc.setFontSize(8);doc.setFont('helvetica','italic');doc.setTextColor(accent.r,accent.g,accent.b);doc.text(rl,margin+14,y+40+dl.length*13+4);}
        y+=ch+8;
      }
    }
    if (dt.popular_renovations?.length) {
      y += 16; // extra breathing room above this section
      if(y+80>BOTTOM){doc.addPage();await drawPageFrame(doc,branding,'Section 04 · Design Trends','Top Renovations by ROI');y=90;}
      doc.setFontSize(11);doc.setFont('helvetica','bold');doc.setTextColor(primary.r,primary.g,primary.b);doc.text('Top Renovations by ROI',margin,y);y+=12;
      doc.setDrawColor(accent.r,accent.g,accent.b);doc.setLineWidth(1.5);doc.line(margin,y,margin+170,y);y+=12;
      const renR=dt.popular_renovations.filter(r=>r.relevant_to_subject!==false).map(r=>[r.renovation||'',r.avg_cost||'—',r.avg_roi||'—',r.time_to_complete||'—',r.priority?r.priority.charAt(0).toUpperCase()+r.priority.slice(1):'—']);
      if(renR.length){y=drawTable(doc,margin,y,['Renovation','Est. Cost','Avg ROI','Timeline','Priority'],renR,[175,90,65,80,contentWidth-418],{headerFill:branding.primary_color||'#1A3226',headerTextColor:'#FFFFFF',fontSize:8.5,rowHeight:26,branding});y+=12;}
    }
  }

  // ── SECTION 05: Local Impact ──
  const li = data.local_impact || {};
  if (li.town_developments?.length || li.ma_housing_policies?.length) {
    doc.addPage();
    drawSectionDivider(doc, branding, 5, 'Local Impact &\nPolicy Watch', `What's happening in ${li.town || 'your town'} · MA housing policy · value trajectory`);
    doc.addPage();
    await drawPageFrame(doc, branding, 'Section 05 · Local Impact', 'Town Developments & Policy Intelligence');
    y = 90;
    if (li.agent_briefing) {
      const bLines = doc.splitTextToSize(li.agent_briefing, contentWidth - 24);
      const bH = Math.max(54, bLines.length * 13 + 20);
      doc.setFillColor(primary.r, primary.g, primary.b); doc.roundedRect(margin, y, contentWidth, bH, 4, 4, 'F');
      doc.setFontSize(6.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(accent.r, accent.g, accent.b); doc.text('AGENT BRIEFING', margin + 12, y + 13);
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(255, 255, 255); doc.text(bLines, margin + 12, y + 24);
      y += bH + 14;
    }
    if (li.town_developments?.length) {
      if (y + 40 > BOTTOM) { doc.addPage(); await drawPageFrame(doc, branding, 'Section 05 · Local Impact', 'Town Developments'); y = 90; }
      doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(primary.r, primary.g, primary.b); doc.text('Active & Upcoming Town Developments', margin, y); y += 10;
      doc.setDrawColor(accent.r, accent.g, accent.b); doc.setLineWidth(1.5); doc.line(margin, y, margin + 240, y); y += 12;
      for (const dev of li.town_developments) {
        const dL = doc.splitTextToSize(dev.description || '', contentWidth - 120);
        const iL = doc.splitTextToSize(dev.impact_reason || '', contentWidth - 120);
        const cH = Math.max(52, 30 + (dL.length + iL.length) * 12);
        if (y + cH > BOTTOM) { doc.addPage(); await drawPageFrame(doc, branding, 'Section 05 · Local Impact', 'Town Developments (cont.)'); y = 90; }
        const ic = dev.value_impact === 'positive' ? { r: 22, g: 101, b: 52 } : dev.value_impact === 'negative' ? { r: 153, g: 27, b: 27 } : { r: 100, g: 100, b: 100 };
        doc.setFillColor(248, 247, 244); doc.roundedRect(margin, y, contentWidth, cH, 3, 3, 'F');
        doc.setFillColor(ic.r, ic.g, ic.b); doc.roundedRect(margin, y, 5, cH, 2, 2, 'F');
        // Status badge with impact label + value_impact color
        const badgeLabel = dev.value_impact ? dev.value_impact.toUpperCase() : (dev.status || 'PROJECT').toUpperCase();
        doc.setFillColor(ic.r, ic.g, ic.b); doc.roundedRect(margin + contentWidth - 88, y + 7, 84, 18, 3, 3, 'F');
        doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
        doc.text(badgeLabel, margin + contentWidth - 46, y + 19, { align: 'center', maxWidth: 78 });
        doc.setFontSize(9.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(primary.r, primary.g, primary.b); doc.text(dev.project || '', margin + 14, y + 14, { maxWidth: contentWidth - 108 });
        if (dev.timeline) { doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(90, 90, 90); doc.text(`Timeline: ${dev.timeline}`, margin + 14, y + 25); }
        doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(50, 50, 50); doc.text(dL, margin + 14, y + 36);
        if (iL.length) { doc.setFontSize(8); doc.setFont('helvetica', 'italic'); doc.setTextColor(ic.r, ic.g, ic.b); doc.text(iL, margin + 14, y + 36 + dL.length * 12); }
        y += cH + 6;
      }
    }
    if (li.ma_housing_policies?.length) {
      if (y + 50 > BOTTOM) { doc.addPage(); await drawPageFrame(doc, branding, 'Section 05 · Local Impact', 'MA Housing Policy'); y = 90; }
      doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(primary.r, primary.g, primary.b); doc.text('Massachusetts Housing Policies Affecting This Property', margin, y); y += 10;
      doc.setDrawColor(accent.r, accent.g, accent.b); doc.setLineWidth(1.5); doc.line(margin, y, margin + 280, y); y += 12;
      for (const pol of li.ma_housing_policies) {
        const dL2 = doc.splitTextToSize(pol.description || '', contentWidth - 22);
        const iL2 = pol.impact_reason ? doc.splitTextToSize(pol.impact_reason, contentWidth - 22) : [];
        const cH2 = Math.max(52, 30 + (dL2.length + iL2.length) * 12);
        if (y + cH2 > BOTTOM) { doc.addPage(); await drawPageFrame(doc, branding, 'Section 05 · Local Impact', 'MA Policy (cont.)'); y = 90; }
        const pc = pol.owner_impact === 'positive' ? { r: 22, g: 101, b: 52 } : pol.owner_impact === 'negative' ? { r: 153, g: 27, b: 27 } : { r: 60, g: 80, b: 100 };
        doc.setFillColor(245, 245, 250); doc.roundedRect(margin, y, contentWidth, cH2, 3, 3, 'F');
        doc.setFillColor(pc.r, pc.g, pc.b); doc.roundedRect(margin, y, 5, cH2, 2, 2, 'F');
        doc.setFontSize(9.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(primary.r, primary.g, primary.b); doc.text(pol.policy || '', margin + 14, y + 14, { maxWidth: contentWidth - 100 });
        if (pol.effective_date) { doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(110, 110, 110); doc.text(`Effective: ${pol.effective_date}`, margin + 14, y + 24); }
        let cy3 = y + 34;
        doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(50, 50, 50); doc.text(dL2, margin + 14, cy3); cy3 += dL2.length * 12;
        if (iL2.length) { doc.setFontSize(8); doc.setFont('helvetica', 'italic'); doc.setTextColor(pc.r, pc.g, pc.b); doc.text(iL2, margin + 14, cy3); }
        y += cH2 + 6;
      }
    }
  }

  // ── SECTION 06: Market Context ──
  doc.addPage();
  drawSectionDivider(doc, branding, 6, 'Market Context &\nWhat to Watch', 'ADU development option · market conditions · value drivers');
  doc.addPage();
  await drawPageFrame(doc, branding, 'Section 06 · Market Context', 'Market Conditions & Value Drivers');
  y = 90;
  const mc = data.market_context || {};
  if (mc.narrative) {
    y = await renderNarrative(mc.narrative, 'Section 06 · Market Context', 'Market Conditions & Value Drivers', y);
  }
  const mcRows = [
    ['Median Sale Price', mc.median_sale_price ? fmt(mc.median_sale_price) : 'N/A'],
    ['YoY Appreciation', mc.yoy_appreciation ? fmtPct(mc.yoy_appreciation) : 'N/A'],
    ['Avg Days on Market', mc.avg_days_on_market ? `${mc.avg_days_on_market} days` : 'N/A'],
    ['Sale-to-List Ratio', mc.sale_to_list_ratio ? fmtPct(mc.sale_to_list_ratio * 100) : 'N/A'],
    ['Months of Inventory', mc.months_inventory ? `${mc.months_inventory} months` : 'N/A'],
    ['Market Characterization', mc.market_characterization ? prettifyEnum(mc.market_characterization) : 'N/A'],
  ].filter(r => r[1] !== 'N/A');
  if (mcRows.length && y + mcRows.length * 26 + 40 < BOTTOM) {
    drawTable(doc, margin, y, ['Market Indicator', 'Value'], mcRows, [contentWidth - 140, 140], { headerFill: branding.primary_color || '#1A3226', headerTextColor: '#FFFFFF', fontSize: 10, rowHeight: 28, branding });
  }
  if (data.adu_analysis?.narrative) {
    doc.addPage(); await drawPageFrame(doc, branding, 'Section 06 · Market Context', 'ADU Development Option'); y = 90;
    doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(primary.r, primary.g, primary.b);
    doc.text('ADU Development Option', margin, y); y += 18;
    y = await renderNarrative(data.adu_analysis.narrative, 'Section 06 · Market Context', 'ADU Development Option', y);
  }

  await addClosingSummaryPage(doc, branding, 'Portfolio Review Summary', [
    ['Property Address', data.property_address || ''],
    ['Estimated Value Range', iv.low && iv.high ? `${fmt(iv.low)} – ${fmt(iv.high)}` : 'See Report'],
    ['Value Midpoint', iv.midpoint ? fmt(iv.midpoint) : 'See Report'],
    ['Strategic Options Analyzed', String((data.equity_options || data.portfolio_options || []).length)],
    ['Market Characterization', mc.market_characterization ? prettifyEnum(mc.market_characterization) : 'N/A'],
    ['Avg Days on Market', mc.avg_days_on_market ? `${mc.avg_days_on_market} days` : 'N/A'],
    ['Prepared By', branding.agent_name || ''],
    ['Report Date', new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })],
  ]);
  await addDisclaimerPage(doc, branding);
}