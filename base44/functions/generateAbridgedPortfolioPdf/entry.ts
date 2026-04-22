import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * generateAbridgedPortfolioPdf — 2-3 page "quick read" portfolio summary.
 * Page 1: AVM table + Valuation Convergence (3 methods) + Equity Analysis
 * Page 2: Market Overview + Financial Options Overview
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

    await renderAbridgedPortfolioPdf(doc, analysis.output_json, branding, analysis);

    const arrayBuffer = doc.output('arraybuffer');
    const bytes = new Uint8Array(arrayBuffer);
    const base64 = btoa(String.fromCharCode(...bytes));

    return Response.json({ base64, filename: `Abridged_Portfolio_Review_${Date.now()}.pdf` });
  } catch (err) {
    console.error('[generateAbridgedPortfolioPdf] error:', err.message);
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

function fmt(n) {
  return n != null ? `$${Number(n).toLocaleString()}` : 'N/A';
}

function fmtPct(n) {
  return n != null ? `${Number(n).toFixed(1)}%` : 'N/A';
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

  const footerParts = [branding.agent_name, branding.org_name].filter(Boolean);
  doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(255, 255, 255);
  doc.text(footerParts.join(' · '), 40, 758);

  // Logo or monogram
  if (branding.org_logo_url) {
    try {
      const r = await fetch(branding.org_logo_url);
      const b = await r.arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(b)));
      const ext = branding.org_logo_url.toLowerCase().includes('.png') ? 'PNG' : 'JPEG';
      doc.addImage(`data:image/${ext.toLowerCase()};base64,${b64}`, ext, pageWidth - 68, 740, 40, 18, undefined, 'FAST');
    } catch (e) {
      drawMonogram(doc, branding, primary, accent, pageWidth);
    }
  } else {
    drawMonogram(doc, branding, primary, accent, pageWidth);
  }

  if (breadcrumb) {
    doc.setFillColor(accent.r, accent.g, accent.b);
    doc.rect(38, 12, 2, 14, 'F');
    doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(accent.r, accent.g, accent.b);
    doc.text(breadcrumb.toUpperCase(), 44, 22);
  }
  if (pageTitle) {
    doc.setFontSize(pageTitle.length > 40 ? 17 : 20);
    doc.setFont('helvetica', 'bold'); doc.setTextColor(primary.r, primary.g, primary.b);
    doc.text(pageTitle, 40, 62);
    doc.setDrawColor(accent.r, accent.g, accent.b); doc.setLineWidth(1.5);
    doc.line(40, 68, 150, 68);
  }
}

function drawMonogram(doc, branding, primary, accent, pageWidth) {
  const mono = (branding.org_name || 'PP').split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase();
  doc.setFillColor(accent.r, accent.g, accent.b);
  doc.roundedRect(pageWidth - 60, 741, 32, 20, 3, 3, 'F');
  doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(primary.r, primary.g, primary.b);
  doc.text(mono, pageWidth - 44, 754, { align: 'center' });
}

function drawSectionLabel(doc, x, y, text, accent) {
  doc.setFontSize(7); doc.setFont('helvetica', 'bold');
  doc.setTextColor(accent.r, accent.g, accent.b);
  doc.text(text.toUpperCase(), x, y);
}

function drawTable(doc, x, y, headers, rows, colWidths, options = {}) {
  const { headerFill = '#1A3226', headerTextColor = '#FFFFFF', altRowFill = '#F4F1EA', fontSize = 8, headerFontSize = 8, rowHeight = 24, padding = 8 } = options;
  const totalWidth = colWidths.reduce((a, b) => a + b, 0);
  let currentY = y;
  const parseColor = (hex) => {
    const c = (hex || '#000').replace('#', '');
    return { r: parseInt(c.slice(0, 2), 16), g: parseInt(c.slice(2, 4), 16), b: parseInt(c.slice(4, 6), 16) };
  };
  const hc = parseColor(headerFill);
  doc.setFillColor(hc.r, hc.g, hc.b);
  doc.rect(x, currentY, totalWidth, rowHeight + 4, 'F');
  doc.setFontSize(headerFontSize); doc.setFont('helvetica', 'bold');
  const htc = parseColor(headerTextColor); doc.setTextColor(htc.r, htc.g, htc.b);
  let cx = x + padding;
  headers.forEach((h, i) => { doc.text(h, cx, currentY + (rowHeight + 4) / 2 + 3); cx += colWidths[i]; });
  currentY += rowHeight + 4;
  doc.setFontSize(fontSize); doc.setFont('helvetica', 'normal');
  for (let ri = 0; ri < rows.length; ri++) {
    const isAlt = ri % 2 !== 0;
    if (isAlt) { const a = parseColor(altRowFill); doc.setFillColor(a.r, a.g, a.b); } else { doc.setFillColor(255, 255, 255); }
    doc.rect(x, currentY, totalWidth, rowHeight, 'F');
    doc.setDrawColor(224, 221, 214); doc.setLineWidth(0.5);
    doc.line(x, currentY + rowHeight, x + totalWidth, currentY + rowHeight);
    doc.setTextColor(26, 26, 26);
    let cellX = x + padding;
    rows[ri].forEach((cell, ci) => {
      doc.text(doc.splitTextToSize(String(cell ?? ''), colWidths[ci] - padding * 2)[0], cellX, currentY + rowHeight / 2 + 3);
      cellX += colWidths[ci];
    });
    currentY += rowHeight;
  }
  return currentY;
}

// ─── Main Renderer ────────────────────────────────────────────────────────────

async function renderAbridgedPortfolioPdf(doc, data, branding, analysis) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  const contentWidth = pageWidth - 2 * margin;
  const primary = hexToRgb(branding.primary_color || '#1A3226');
  const accent = hexToRgb(branding.accent_color || '#B8982F');
  const iv = data.tiered_comps?.implied_value_range || {};
  const mc = data.market_context || {};
  const BOTTOM = 720;

  // ── COVER ──────────────────────────────────────────────────────────────────
  const pageHeight = doc.internal.pageSize.getHeight();
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
      doc.setFontSize(24); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
      doc.text(branding.org_name || '', pageWidth / 2, 94, { align: 'center' });
    }
  } else {
    doc.setFontSize(24); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
    doc.text(branding.org_name || '', pageWidth / 2, 94, { align: 'center' });
  }

  const cpMonth = new Date().getMonth();
  const cpYear = new Date().getFullYear();
  const cpSeason = cpMonth < 3 ? 'Winter' : cpMonth < 6 ? 'Spring' : cpMonth < 9 ? 'Summer' : 'Fall';
  const pillLabel = `ABRIDGED PORTFOLIO REVIEW  ·  ${cpSeason.toUpperCase()} ${cpYear}`;
  const pillW = 300; const pillH = 26; const pillY = logoBottomY + 16;
  doc.setFillColor(accent.r, accent.g, accent.b);
  doc.roundedRect(pageWidth / 2 - pillW / 2, pillY, pillW, pillH, 4, 4, 'F');
  doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(primary.r, primary.g, primary.b);
  doc.text(pillLabel, pageWidth / 2, pillY + pillH / 2 + 3, { align: 'center' });

  doc.setDrawColor(accent.r, accent.g, accent.b); doc.setLineWidth(1);
  doc.line(pageWidth / 2 - 140, pillY + pillH + 14, pageWidth / 2 + 140, pillY + pillH + 14);

  const addrParts = (data.property_address || '').split(',');
  const addrY = pillY + pillH + 54;
  doc.setFontSize(26); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
  doc.text(addrParts[0]?.trim() || '', pageWidth / 2, addrY, { align: 'center', maxWidth: 460 });
  if (addrParts.slice(1).join(',').trim()) {
    doc.setFontSize(12); doc.setFont('helvetica', 'normal'); doc.setTextColor(accent.r, accent.g, accent.b);
    doc.text(addrParts.slice(1).join(',').trim(), pageWidth / 2, addrY + 20, { align: 'center' });
  }

  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  let metaY = addrY + 50;
  doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(180, 180, 180);
  doc.text(`${today}  ·  CONFIDENTIAL`, pageWidth / 2, metaY, { align: 'center' });
  if (branding.agent_name) {
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(180, 180, 180);
    doc.text(`Prepared by ${branding.agent_name}`, pageWidth / 2, metaY + 16, { align: 'center' });
  }
  const ctact = [branding.agent_phone, branding.agent_email].filter(Boolean).join('  ·  ');
  if (ctact) {
    doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(accent.r, accent.g, accent.b);
    doc.text(ctact, pageWidth / 2, metaY + 32, { align: 'center' });
  }
  doc.setFillColor(Math.min(255, primary.r + 12), Math.min(255, primary.g + 12), Math.min(255, primary.b + 12));
  doc.rect(0, pageHeight - 38, pageWidth, 38, 'F');
  doc.setFillColor(accent.r, accent.g, accent.b); doc.rect(0, pageHeight - 38, pageWidth, 1.5, 'F');
  doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(180, 180, 180);
  doc.text(branding.org_name || '', pageWidth / 2, pageHeight - 16, { align: 'center' });

  // ── PAGE 1: AVM + Valuation Convergence + Equity Analysis ──────────────────
  doc.addPage();
  await drawPageFrame(doc, branding, 'Abridged Portfolio Review', 'Valuation & Equity Summary');
  let y = 90;

  // AVM Table
  const ap = data.avm_perception || data.avm_analysis || {};
  const avmPlatforms = ap.platforms || [];
  if (avmPlatforms.length) {
    drawSectionLabel(doc, margin, y, 'Consumer AVM Perception', accent);
    y += 12;
    const avmColWidths = [110, 90, 75, 75, 55, 65];
    const avmRows = avmPlatforms.map(p => {
      const est = p.estimate;
      const hasEst = est != null && est !== 'null' && est !== '';
      const dispEst = hasEst ? (typeof est === 'number' ? fmt(est) : est) : 'N/A';
      return [
        p.name || p.platform || '',
        dispEst,
        hasEst && p.range_low ? (typeof p.range_low === 'number' ? fmt(p.range_low) : p.range_low) : '—',
        hasEst && p.range_high ? (typeof p.range_high === 'number' ? fmt(p.range_high) : p.range_high) : '—',
        p.trend || '—',
        p.retrieved_date || '—',
      ];
    });
    // Composite row
    if (ap.composite_average) {
      avmRows.push(['AVM Composite / Our Est.', ap.composite_average, '', '', '', '']);
    }
    y = drawTable(doc, margin, y, ['Platform', 'Estimate', 'Low', 'High', 'Trend', 'Retrieved'], avmRows, avmColWidths, {
      headerFill: branding.primary_color || '#1A3226',
      headerTextColor: '#FFFFFF',
      headerFontSize: 7.5,
      fontSize: 8,
      rowHeight: 21,
      padding: 7,
    });
    y += 14;
  }

  // Valuation Convergence — 3 cards
  if (data.valuation?.methods?.length || iv.low) {
    if (y + 140 > BOTTOM) { doc.addPage(); await drawPageFrame(doc, branding, 'Abridged Portfolio Review', 'Valuation Convergence'); y = 90; }
    drawSectionLabel(doc, margin, y, 'Valuation Convergence — Three Independent Methods', accent);
    y += 12;

    const methods = (data.valuation?.methods || []).slice(0, 3);
    if (methods.length === 3) {
      const cardW = (contentWidth - 12) / 3;
      const cardH = 116;
      methods.forEach((m, i) => {
        const cx = margin + i * (cardW + 6);
        doc.setFillColor(primary.r, primary.g, primary.b);
        doc.roundedRect(cx, y, cardW, cardH, 4, 4, 'F');
        // Ghost number
        const gL = Math.min(255, primary.r + 24);
        const gLG = Math.min(255, primary.g + 24);
        const gLB = Math.min(255, primary.b + 24);
        doc.setFontSize(52); doc.setFont('helvetica', 'bold'); doc.setTextColor(gL, gLG, gLB);
        doc.text(String(i + 1).padStart(2, '0'), cx + cardW - 6, y + 46, { align: 'right' });
        // Method name
        doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
        const tLines = doc.splitTextToSize(m.method_name || m.name || '', cardW - 14);
        doc.text(tLines.slice(0, 2), cx + 8, y + 18);
        // Divider line
        doc.setDrawColor(accent.r, accent.g, accent.b); doc.setLineWidth(0.8);
        doc.line(cx + 8, y + 38, cx + cardW - 8, y + 38);
        // Range
        const rangeText = m.value_range || (m.low && m.high ? `${fmt(m.low)} – ${fmt(m.high)}` : (m.value ? fmt(m.value) : '—'));
        doc.setFontSize(9.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(accent.r, accent.g, accent.b);
        doc.text(rangeText, cx + 8, y + 56, { maxWidth: cardW - 14 });
        // Description
        if (m.description || m.rationale) {
          doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(190, 190, 190);
          const dLines = doc.splitTextToSize(m.description || m.rationale || '', cardW - 14);
          doc.text(dLines.slice(0, 3), cx + 8, y + 72);
        }
      });
      y += cardH + 8;
    }

    // Convergence banner
    if (iv.low && iv.high) {
      doc.setFillColor(accent.r, accent.g, accent.b);
      doc.roundedRect(margin, y, contentWidth, 28, 3, 3, 'F');
      doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(primary.r, primary.g, primary.b);
      doc.text(`ALL THREE METHODS CONVERGE ON  ${fmt(iv.low)} – ${fmt(iv.high)}`, pageWidth / 2, y + 11, { align: 'center' });
      doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
      doc.text(`Estimated Current Market Value (Midpoint): ${fmt(iv.midpoint)}`, pageWidth / 2, y + 22, { align: 'center' });
      y += 38;
    }
    y += 8;
  }

  // Equity Analysis table
  const equityOptions = data.equity_options || [];
  const firstOpt = equityOptions[0];
  const snap = firstOpt?.financial_snapshot || {};
  if (snap.estimated_market_value || snap.estimated_gross_equity || iv.midpoint) {
    if (y + 150 > BOTTOM) { doc.addPage(); await drawPageFrame(doc, branding, 'Abridged Portfolio Review', 'Equity Analysis'); y = 90; }
    drawSectionLabel(doc, margin, y, 'Equity Analysis', accent);
    y += 12;

    const estValue = snap.estimated_market_value || iv.midpoint;
    const mortgageBal = snap.mortgage_balance || analysis?.seller_mortgage_payoff || null;
    const helocBal = snap.heloc_balance || null;
    const grossEquity = snap.estimated_gross_equity || (estValue && mortgageBal ? estValue - mortgageBal : null);
    const purchasePrice = snap.purchase_price || data.purchase_price || null;
    const ltv = estValue && mortgageBal ? ((mortgageBal / estValue) * 100).toFixed(0) + '%' : null;

    // Equity position block (dark table-style)
    const equityRows = [
      ['EQUITY POSITION TODAY', '', ''],
      ['Estimated Current Market Value', estValue ? fmt(estValue) : '—', '[ESTIMATED midpoint]'],
      mortgageBal ? ['– Estimated Mortgage Balance', `(${fmt(mortgageBal)})`, snap.mortgage_notes || '[ESTIMATED]'] : null,
      helocBal ? ['– HELOC Balance', fmt(helocBal), snap.heloc_notes || ''] : ['– HELOC Balance', '$0', 'None found on registry'],
      grossEquity ? ['ESTIMATED GROSS EQUITY', `~${fmt(grossEquity)}`, '[ESTIMATED]'] : null,
    ].filter(Boolean);

    const rh = 22;
    const cW1 = 230, cW2 = 110, cW3 = contentWidth - cW1 - cW2;

    equityRows.forEach((row, ri) => {
      const isHeader = row[2] === '' || row[0].startsWith('EQUITY') || row[0].startsWith('ESTIMATED GROSS');
      if (isHeader) {
        doc.setFillColor(primary.r, primary.g, primary.b);
      } else {
        doc.setFillColor(ri % 2 === 0 ? 255 : 244, ri % 2 === 0 ? 255 : 241, ri % 2 === 0 ? 255 : 234);
      }
      doc.rect(margin, y, contentWidth, rh, 'F');
      doc.setDrawColor(220, 217, 210); doc.setLineWidth(0.4);
      doc.line(margin, y + rh, margin + contentWidth, y + rh);

      if (isHeader) {
        doc.setFontSize(8); doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text(row[0], margin + 8, y + rh / 2 + 3);
      } else {
        doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(40, 40, 40);
        doc.text(row[0], margin + 8, y + rh / 2 + 3);
        const isGrossEquity = row[0] === 'ESTIMATED GROSS EQUITY';
        if (isGrossEquity) {
          doc.setFont('helvetica', 'bold'); doc.setTextColor(accent.r, accent.g, accent.b);
        } else {
          doc.setFont('helvetica', 'bold'); doc.setTextColor(primary.r, primary.g, primary.b);
        }
        doc.text(row[1], margin + cW1 + 8, y + rh / 2 + 3);
        doc.setFont('helvetica', 'normal'); doc.setTextColor(110, 110, 110); doc.setFontSize(7);
        doc.text(row[2], margin + cW1 + cW2 + 8, y + rh / 2 + 3, { maxWidth: cW3 - 10 });
      }
      y += rh;
    });

    // LTV row
    if (ltv) {
      y += 4;
      doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(primary.r, primary.g, primary.b);
      doc.text(`LTV Today (est.): ${ltv}  —  ${Number(ltv) < 50 ? 'Excellent equity position' : Number(ltv) < 70 ? 'Good equity position' : 'Standard equity position'}`, margin, y + 10);
      y += 18;
    }
    y += 8;
  }

  // ── PAGE 2: Market Overview + Financial Options ─────────────────────────────
  doc.addPage();
  await drawPageFrame(doc, branding, 'Abridged Portfolio Review', 'Market & Financial Overview');
  y = 90;

  // Market Overview
  drawSectionLabel(doc, margin, y, `${mc.market || data.property_address?.split(',')[1]?.trim() || ''} Market Overview`, accent);
  y += 12;

  // Market stat boxes (4 across)
  const statBoxes = [
    { label: 'MEDIAN PRICE', value: mc.median_sale_price ? fmt(mc.median_sale_price) : 'N/A' },
    { label: 'DAYS ON MARKET', value: mc.avg_days_on_market ? `~${mc.avg_days_on_market} Days` : 'N/A' },
    { label: 'COMPETE SCORE', value: mc.compete_score || mc.market_characterization || 'N/A' },
    { label: 'YOY PRICE CHANGE', value: mc.yoy_appreciation ? `+${fmtPct(mc.yoy_appreciation)}` : 'N/A' },
  ].filter(sb => sb.value !== 'N/A');

  if (statBoxes.length) {
    const boxW = (contentWidth - (statBoxes.length - 1) * 8) / statBoxes.length;
    const boxH = 62;
    statBoxes.forEach((sb, i) => {
      const bx = margin + i * (boxW + 8);
      doc.setFillColor(primary.r, primary.g, primary.b);
      doc.roundedRect(bx, y, boxW, boxH, 3, 3, 'F');
      doc.setFontSize(6.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(accent.r, accent.g, accent.b);
      doc.text(sb.label, bx + boxW / 2, y + 14, { align: 'center', maxWidth: boxW - 8 });
      doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
      doc.text(sb.value, bx + boxW / 2, y + 40, { align: 'center', maxWidth: boxW - 8 });
    });
    y += boxH + 12;
  }

  // Market narrative bullets (right side) and conditions box (left side)
  const conditions = mc.current_conditions || mc.key_conditions || [];
  const opportunities = mc.opportunities_risks || mc.opportunities || [];

  const halfW = (contentWidth - 12) / 2;

  if (conditions.length || mc.narrative) {
    const leftX = margin;
    const rightX = margin + halfW + 12;
    let leftY = y;
    let rightY = y;

    // Left: Current conditions
    doc.setFillColor(248, 246, 240);
    doc.setDrawColor(primary.r, primary.g, primary.b);
    doc.setLineWidth(0.8);
    const condH = Math.max(80, 24 + Math.min(conditions.length || 5, 6) * 14 + 8);
    doc.roundedRect(leftX, leftY, halfW, condH, 3, 3, 'F');
    doc.rect(leftX, leftY, halfW, 18, 'F');
    doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(primary.r, primary.g, primary.b);
    doc.text('CURRENT MARKET CONDITIONS', leftX + 8, leftY + 12);
    leftY += 22;
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(40, 40, 40);
    const condBullets = conditions.length ? conditions.slice(0, 6) : mc.narrative ? doc.splitTextToSize(mc.narrative, halfW - 16).slice(0, 7) : [];
    condBullets.forEach(bullet => {
      const text = typeof bullet === 'string' ? `• ${bullet}` : `• ${bullet.text || bullet}`;
      const lines = doc.splitTextToSize(text, halfW - 16);
      doc.text(lines.slice(0, 2), leftX + 8, leftY);
      leftY += lines.length <= 1 ? 12 : 22;
    });

    // Right: Opportunities & risks
    if (opportunities.length) {
      doc.setFillColor(248, 246, 240);
      doc.roundedRect(rightX, rightY, halfW, condH, 3, 3, 'F');
      doc.setFillColor(accent.r, accent.g, accent.b);
      doc.rect(rightX, rightY, halfW, 18, 'F');
      doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(primary.r, primary.g, primary.b);
      doc.text('OPPORTUNITIES & RISKS TO WATCH', rightX + 8, rightY + 12);
      rightY += 22;
      doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(40, 40, 40);
      opportunities.slice(0, 6).forEach(item => {
        const isRisk = item.type === 'risk' || item.icon === '⚠';
        const prefix = isRisk ? '⚠ ' : '✓ ';
        const text = typeof item === 'string' ? `${prefix}${item}` : `${prefix}${item.text || item}`;
        const lines = doc.splitTextToSize(text, halfW - 16);
        doc.setTextColor(isRisk ? 120 : 40, 40, 40);
        doc.text(lines.slice(0, 2), rightX + 8, rightY);
        rightY += lines.length <= 1 ? 12 : 22;
      });
    } else if (mc.narrative && conditions.length) {
      // Show narrative on right
      const narLines = doc.splitTextToSize(mc.narrative, halfW - 14);
      doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(50, 50, 50);
      doc.text(narLines.slice(0, 7), rightX, rightY);
    }

    y = Math.max(y, leftY, rightY) + 14;
    if (y > condH + 100) y = y; // ensure we used the right y
    else y = y + condH - 40; // approximate
    y = Math.min(y, BOTTOM - 80);
  }

  // Financial Options Overview table
  if (y + 60 < BOTTOM && (equityOptions.length || data.portfolio_options?.length)) {
    const allOptions = equityOptions.length ? equityOptions : (data.portfolio_options || []);
    drawSectionLabel(doc, margin, y, 'Financial Options Overview', accent);
    y += 12;

    // Header row
    const optColWidths = [24, 130, 90, 160, contentWidth - 412];
    doc.setFillColor(primary.r, primary.g, primary.b);
    const hRH = 22;
    doc.rect(margin, y, contentWidth, hRH, 'F');
    doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
    let hcx = margin + 6;
    ['#', 'Option', 'Equity Accessible', 'Best Scenario', 'Key Trade-Off'].forEach((h, i) => {
      doc.text(h, hcx, y + hRH / 2 + 3);
      hcx += optColWidths[i];
    });
    y += hRH;

    const optLetters = 'ABCDEFG';
    allOptions.slice(0, 7).forEach((opt, oi) => {
      const rh2 = 26;
      if (y + rh2 > BOTTOM) return;
      doc.setFillColor(oi % 2 === 0 ? 255 : 244, oi % 2 === 0 ? 255 : 241, oi % 2 === 0 ? 255 : 234);
      doc.rect(margin, y, contentWidth, rh2, 'F');
      doc.setDrawColor(224, 221, 214); doc.setLineWidth(0.4);
      doc.line(margin, y + rh2, margin + contentWidth, y + rh2);

      // Letter badge
      doc.setFillColor(primary.r, primary.g, primary.b);
      doc.roundedRect(margin + 3, y + 4, 18, 18, 2, 2, 'F');
      doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(accent.r, accent.g, accent.b);
      doc.text(optLetters[oi] || String(oi + 1), margin + 12, y + 16, { align: 'center' });

      const title = opt.title || opt.label || opt.option_summary?.split(' ').slice(0, 3).join(' ') || '';
      const equityAmt = opt.financial_snapshot?.net_equity_available ? fmt(opt.financial_snapshot.net_equity_available) : (opt.equity_accessible || '—');
      const best = opt.best_scenario || (opt.pros || [])[0] || '—';
      const tradeoff = opt.key_tradeoff || opt.tagline || (opt.cons || [])[0] || '—';

      doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(primary.r, primary.g, primary.b);
      doc.text(doc.splitTextToSize(title, optColWidths[1] - 8)[0], margin + optColWidths[0] + 6, y + rh2 / 2 + 3);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(40, 40, 40);
      doc.text(doc.splitTextToSize(equityAmt, optColWidths[2] - 8)[0], margin + optColWidths[0] + optColWidths[1] + 6, y + rh2 / 2 + 3);
      doc.setTextColor(70, 70, 70);
      doc.text(doc.splitTextToSize(String(best), optColWidths[3] - 8)[0], margin + optColWidths[0] + optColWidths[1] + optColWidths[2] + 6, y + rh2 / 2 + 3);
      doc.setTextColor(120, 120, 120);
      doc.text(doc.splitTextToSize(String(tradeoff), optColWidths[4] - 8)[0], margin + optColWidths[0] + optColWidths[1] + optColWidths[2] + optColWidths[3] + 6, y + rh2 / 2 + 3);

      y += rh2;
    });
    y += 14;
  }

  // Disclaimer footer
  doc.setFontSize(6.5); doc.setFont('helvetica', 'italic'); doc.setTextColor(140, 140, 140);
  const disclaimer = 'This abridged report is AI-generated for informational purposes only. Not legal or financial advice. All valuations and equity estimates should be verified with licensed professionals.';
  const disLines = doc.splitTextToSize(disclaimer, contentWidth);
  if (y + disLines.length * 10 < BOTTOM) {
    doc.text(disLines, margin, y + 8);
  }
}