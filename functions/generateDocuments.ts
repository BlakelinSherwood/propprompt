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

    const { analysisId, format = 'pdf' } = await req.json();

    const [analyses, branding] = await Promise.all([
      base44.asServiceRole.entities.Analysis.filter({ id: analysisId }),
      resolveBranding(base44, analysisId),
    ]);

    const analysis = analyses[0];
    if (!analysis) return Response.json({ error: 'Analysis not found' }, { status: 404 });

    if (format === 'pdf') {
      const url = await generatePDF(base44, analysis, branding, analysisId);
      await base44.asServiceRole.entities.Analysis.update(analysisId, { output_pdf_url: url });
      return Response.json({ success: true, url, format: 'pdf' });
    }

    if (format === 'pptx') {
      const url = await generatePPTX(base44, analysis, branding, analysisId);
      await base44.asServiceRole.entities.Analysis.update(analysisId, { output_pptx_url: url });
      return Response.json({ success: true, url, format: 'pptx' });
    }

    return Response.json({ error: 'Invalid format' }, { status: 400 });
  } catch (error) {
    console.error('generateDocuments error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// ─── Branding resolution (inline for reliability) ──────────────────────────
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
    org_tagline:      tb.tagline          || bb.tagline          || '',
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

// ─── Helpers ────────────────────────────────────────────────────────────────
function hexToRgb(hex) {
  const h = (hex || '#333333').replace('#', '');
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}

// ─── PDF generation ─────────────────────────────────────────────────────────
async function generatePDF(base44, analysis, b, analysisId) {
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

  // Page 1
  drawHeader();
  let y = mT + 6;

  // Title block
  doc.setFontSize(16); doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primary);
  doc.text(ASSESSMENT_LABELS[analysis.assessment_type] || 'Analysis', mL, y); y += 8;

  if (analysis.intake_data?.address) {
    doc.setFontSize(11); doc.setFont('helvetica', 'normal');
    doc.setTextColor(102, 102, 102);
    doc.text(analysis.intake_data.address, mL, y); y += 6;
  }

  doc.setFontSize(9);
  doc.text(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), mL, y);
  y += 8;

  // Divider
  doc.setDrawColor(...accent); doc.setLineWidth(0.5);
  doc.line(mL, y, pageW - mR, y); y += 6;

  // Content
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

  // Disclaimer
  y += 4;
  doc.setFillColor(...accent); doc.rect(mL, y, cW, 0.3, 'F'); y += 5;
  const disc = 'DISCLAIMER: This AI-generated analysis is provided for informational purposes only and does not constitute legal, financial, or professional real estate advice. All valuations and recommendations should be verified by a licensed real estate professional. PropPrompt™ analyses are tools to augment, not replace, professional judgment.';
  doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
  doc.setTextColor(102, 102, 102);
  doc.text(doc.splitTextToSize(disc, cW), mL, y);

  // Fix page footers
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) { doc.setPage(p); drawFooter(p, total); }

  const pdfBytes = new Uint8Array(doc.output('arraybuffer'));
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const file = new File([blob], `analysis-${analysisId}-${Date.now()}.pdf`, { type: 'application/pdf' });
  const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file });
  return file_url;
}

// ─── PPTX generation ────────────────────────────────────────────────────────
async function generatePPTX(base44, analysis, b, analysisId) {
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

  // Cover slide
  const cover = pptx.addSlide();
  cover.background = { color: pri };
  cover.addText(orgName, { x: 0.5, y: 1.2, w: 10, h: 1.2, fontSize: 32, bold: true, color: 'FFFFFF', fontFace: 'Georgia', align: 'center' });
  if (address) cover.addText(address, { x: 0.5, y: 2.8, w: 10, h: 0.6, fontSize: 18, color: 'FFFFFF', fontFace: 'Calibri', align: 'center' });
  cover.addText(assessLabel.toUpperCase(), { x: 3.5, y: 3.7, w: 4, h: 0.4, fontSize: 10, bold: true, color: 'FFFFFF', fill: { color: acc }, align: 'center' });
  cover.addText(`${b.agent_name || ''}  |  ${dateStr}`, { x: 0.5, y: 5.5, w: 10, h: 0.4, fontSize: 11, color: 'FFFFFF', fontFace: 'Calibri', align: 'center' });

  // Parse sections from output
  const sections = parseSections(analysis.output_text || '');

  for (const section of sections) {
    // Section divider
    const div = pptx.addSlide();
    div.background = { color: pri };
    div.addText(section.title, { x: 0.5, y: 2.5, w: 10, h: 1.2, fontSize: 28, bold: true, color: 'FFFFFF', fontFace: 'Georgia', align: 'left' });

    // Content slide
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

  // Final agent slide
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
  const blob = new Blob([pptxBytes], { type: mimeType });
  const file = new File([blob], `analysis-${analysisId}-${Date.now()}.pptx`, { type: mimeType });
  const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file });
  return file_url;
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