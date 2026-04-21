/**
 * generateDocsExtra — Investment & Rental PDF renderers
 * Invoked by generateDocuments as a sub-function.
 * POST body: { analysisId, format: 'investment' | 'rental', branding }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  return { r: parseInt(clean.slice(0, 2), 16), g: parseInt(clean.slice(2, 4), 16), b: parseInt(clean.slice(4, 6), 16) };
}

async function drawPageFrame(doc, branding, breadcrumb, pageTitle) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const primary = hexToRgb(branding.primary_color || '#1A3226');
  const accent = hexToRgb(branding.accent_color || '#B8982F');
  doc.setFillColor(250, 248, 244); doc.rect(0, 0, pageWidth, pageHeight, 'F');
  doc.setFillColor(accent.r, accent.g, accent.b); doc.rect(0, 0, pageWidth, 3, 'F'); doc.rect(0, 789, pageWidth, 3, 'F');
  doc.setFillColor(primary.r, primary.g, primary.b); doc.rect(0, 735, pageWidth, 57, 'F');
  const fp = []; if (branding.agent_name) fp.push(branding.agent_name); if (branding.org_name) fp.push(branding.org_name);
  doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(255, 255, 255); doc.text(fp.join(' · '), 40, 758);
  const monogram = (branding.org_name || 'PP').split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase();
  doc.setFillColor(accent.r, accent.g, accent.b); doc.roundedRect(pageWidth - 60, 741, 32, 20, 3, 3, 'F');
  doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(primary.r, primary.g, primary.b); doc.text(monogram, pageWidth - 44, 754, { align: 'center' });
  if (breadcrumb) { doc.setFillColor(accent.r, accent.g, accent.b); doc.rect(38, 12, 2, 14, 'F'); doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(accent.r, accent.g, accent.b); doc.text(breadcrumb.toUpperCase(), 44, 22); }
  if (pageTitle) { const ts = pageTitle.length > 40 ? 17 : 20; doc.setFontSize(ts); doc.setFont('helvetica', 'bold'); doc.setTextColor(primary.r, primary.g, primary.b); doc.text(pageTitle, 40, 62); doc.setDrawColor(accent.r, accent.g, accent.b); doc.setLineWidth(1.5); doc.line(40, 68, 150, 68); }
}

function drawSectionDivider(doc, branding, sectionNum, sectionTitle, subtitle) {
  const pageWidth = doc.internal.pageSize.getWidth(); const pageHeight = doc.internal.pageSize.getHeight();
  const primary = hexToRgb(branding.primary_color || '#1A3226'); const accent = hexToRgb(branding.accent_color || '#B8982F');
  doc.setFillColor(primary.r, primary.g, primary.b); doc.rect(0, 0, pageWidth, pageHeight, 'F');
  doc.setFillColor(accent.r, accent.g, accent.b); doc.rect(0, 0, pageWidth, 4, 'F'); doc.rect(0, 789, pageWidth, 3, 'F');
  doc.setDrawColor(accent.r, accent.g, accent.b); doc.setLineWidth(1); doc.line(40, 140, 390, 140);
  doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(accent.r, accent.g, accent.b); doc.text(`SECTION ${String(sectionNum).padStart(2, '0')}`, 40, 160);
  doc.setFillColor(accent.r, accent.g, accent.b); doc.rect(40, 185, 3, 60, 'F');
  doc.setFontSize(32); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255); doc.text(doc.splitTextToSize(sectionTitle, 480).slice(0, 2), 52, 210);
  if (subtitle) { doc.setFontSize(11); doc.setFont('helvetica', 'normal'); doc.setTextColor(accent.r, accent.g, accent.b); doc.text(subtitle, 52, 265, { maxWidth: 480 }); }
  const ft = [branding.agent_name, branding.org_name].filter(Boolean).join(' · ');
  doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(180, 180, 180); doc.text(ft, 40, 758);
}

function drawTable(doc, x, y, headers, rows, colWidths, options = {}) {
  const { headerFill = '#1A3226', headerTextColor = '#FFFFFF', altRowFill = '#F4F1EA', fontSize = 8, headerFontSize = 8, rowHeight = 24, padding = 8, branding = null } = options;
  const pageHeight = doc.internal.pageSize.getHeight(); const bottomMargin = 65; const totalWidth = colWidths.reduce((a, b) => a + b, 0); let currentY = y;
  const parseColor = (hex) => { const c = (hex || '#000000').replace('#', ''); return { r: parseInt(c.slice(0,2),16), g: parseInt(c.slice(2,4),16), b: parseInt(c.slice(4,6),16) }; };
  const drawHeader = () => {
    const hc = parseColor(headerFill); doc.setFillColor(hc.r, hc.g, hc.b); doc.rect(x, currentY, totalWidth, rowHeight + 4, 'F');
    doc.setFontSize(headerFontSize); doc.setFont('helvetica', 'bold'); const htc = parseColor(headerTextColor); doc.setTextColor(htc.r, htc.g, htc.b);
    let cx = x + padding; headers.forEach((h, i) => { doc.text(h, cx, currentY + (rowHeight + 4) / 2 + 3); cx += colWidths[i]; }); currentY += rowHeight + 4;
  };
  drawHeader(); doc.setFontSize(fontSize); doc.setFont('helvetica', 'normal');
  for (let ri = 0; ri < rows.length; ri++) {
    if (currentY + rowHeight > pageHeight - bottomMargin) { doc.addPage(); if (branding) drawPageFrame(doc, branding, null, null); currentY = 90; drawHeader(); doc.setFontSize(fontSize); doc.setFont('helvetica', 'normal'); }
    if (ri % 2 !== 0) { const arc = parseColor(altRowFill); doc.setFillColor(arc.r, arc.g, arc.b); } else { doc.setFillColor(255, 255, 255); }
    doc.rect(x, currentY, totalWidth, rowHeight, 'F'); doc.setDrawColor(224, 221, 214); doc.setLineWidth(0.5); doc.line(x, currentY + rowHeight, x + totalWidth, currentY + rowHeight);
    doc.setTextColor(26, 26, 26); let cx = x + padding;
    rows[ri].forEach((cell, ci) => { const ct = String(cell ?? ''); const isN = !isNaN(cell) && cell !== '' && cell !== null; const cx2 = isN ? cx + colWidths[ci] - padding : cx; doc.text(doc.splitTextToSize(ct, colWidths[ci] - padding * 2)[0], cx2, currentY + rowHeight / 2 + 3, { align: isN ? 'right' : 'left' }); cx += colWidths[ci]; });
    currentY += rowHeight;
  }
  return currentY;
}

async function drawBrandedCover(doc, branding, reportType, address, metaLines) {
  const pageWidth = doc.internal.pageSize.getWidth(); const pageHeight = doc.internal.pageSize.getHeight();
  const primary = hexToRgb(branding.primary_color || '#1A3226'); const accent = hexToRgb(branding.accent_color || '#B8982F');
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  doc.setFillColor(primary.r, primary.g, primary.b); doc.rect(0, 0, pageWidth, pageHeight, 'F');
  doc.setFillColor(accent.r, accent.g, accent.b); doc.rect(0, 0, pageWidth, 4, 'F'); doc.rect(0, pageHeight - 3, pageWidth, 3, 'F');
  let lbY = 88;
  if (branding.org_logo_url) { try { const lr = await fetch(branding.org_logo_url); const l64 = btoa(String.fromCharCode(...new Uint8Array(await lr.arrayBuffer()))); const lext = branding.org_logo_url.toLowerCase().includes('.png') ? 'PNG' : 'JPEG'; doc.addImage(`data:image/${lext.toLowerCase()};base64,${l64}`, lext, pageWidth/2-70, 72, 140, 50, undefined, 'FAST'); lbY = 130; } catch { doc.setFontSize(24); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255); doc.text(branding.org_name||'', pageWidth/2, 108, {align:'center'}); } }
  else { doc.setFontSize(24); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255); doc.text(branding.org_name||'', pageWidth/2, 108, {align:'center'}); }
  const pW=280; const pH=26; doc.setFillColor(accent.r,accent.g,accent.b); doc.roundedRect(pageWidth/2-pW/2, lbY+10, pW, pH, 4, 4, 'F');
  doc.setFontSize(8.5); doc.setFont('helvetica','bold'); doc.setTextColor(primary.r,primary.g,primary.b); doc.text(reportType.toUpperCase(), pageWidth/2, lbY+10+pH/2+3, {align:'center'});
  doc.setDrawColor(accent.r,accent.g,accent.b); doc.setLineWidth(1); doc.line(pageWidth/2-160, lbY+48, pageWidth/2+160, lbY+48);
  const ap = (address||'').split(','); const addrY = lbY+70;
  doc.setFontSize(26); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255); doc.text(ap[0]?.trim()||'', pageWidth/2, addrY, {align:'center',maxWidth:460});
  if (ap.slice(1).join(',').trim()) { doc.setFontSize(13); doc.setFont('helvetica','normal'); doc.setTextColor(accent.r,accent.g,accent.b); doc.text(ap.slice(1).join(',').trim(), pageWidth/2, addrY+22, {align:'center'}); }
  let mY = addrY+50; doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(180,180,180);
  (metaLines||[]).forEach(l=>{doc.text(l,pageWidth/2,mY,{align:'center'});mY+=16;});
  doc.text(`${today}  ·  CONFIDENTIAL`, pageWidth/2, mY+4, {align:'center'});
  if(branding.agent_name){doc.setFontSize(10);doc.setFont('helvetica','bold');doc.text(`Prepared by ${branding.agent_name}`,pageWidth/2,mY+20,{align:'center'});}
  const ct=[branding.agent_phone,branding.agent_email].filter(Boolean).join('  ·  ');
  if(ct){doc.setFontSize(9);doc.setFont('helvetica','normal');doc.setTextColor(accent.r,accent.g,accent.b);doc.text(ct,pageWidth/2,mY+36,{align:'center'});}
}

async function addClosingSummaryPage(doc, branding, title, tableRows) {
  const pw = doc.internal.pageSize.getWidth(); const ph = doc.internal.pageSize.getHeight();
  const primary = hexToRgb(branding.primary_color||'#1A3226'); const accent = hexToRgb(branding.accent_color||'#B8982F');
  doc.addPage(); doc.setFillColor(primary.r,primary.g,primary.b); doc.rect(0,0,pw,ph,'F');
  doc.setFillColor(accent.r,accent.g,accent.b); doc.rect(0,0,pw,4,'F'); doc.rect(0,ph-3,pw,3,'F');
  doc.setDrawColor(accent.r,accent.g,accent.b); doc.setLineWidth(1); doc.line(pw/2-150,108,pw/2+150,108);
  doc.setFontSize(16); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255); doc.text(title.toUpperCase(), pw/2, 134, {align:'center'});
  const ctX=pw/2-190; const ctW=380; const rh=22;
  doc.setFillColor(accent.r,accent.g,accent.b); doc.roundedRect(ctX,150,ctW,rh,2,2,'F');
  doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(primary.r,primary.g,primary.b);
  doc.text('CATEGORY',ctX+10,150+rh/2+3); doc.text('FINDING',ctX+ctW/2+10,150+rh/2+3);
  let cty=150+rh;
  tableRows.forEach((row,ri)=>{
    doc.setFillColor(Math.min(255,primary.r+(ri%2===0?14:24)),Math.min(255,primary.g+(ri%2===0?14:24)),Math.min(255,primary.b+(ri%2===0?14:24))); doc.rect(ctX,cty,ctW,rh,'F');
    doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(200,200,200); doc.text(String(row[0]||''),ctX+10,cty+rh/2+3);
    doc.setTextColor(220,220,220); doc.text(String(row[1]||''),ctX+ctW/2+10,cty+rh/2+3); cty+=rh;
  });
  const contact=[branding.agent_name,branding.agent_phone,branding.agent_email].filter(Boolean).join('  ·  ');
  if(contact){doc.setFontSize(9);doc.setFont('helvetica','normal');doc.setTextColor(180,180,180);doc.text(contact,pw/2,cty+28,{align:'center'});}
}

async function addDisclaimerPage(doc, branding) {
  const pw = doc.internal.pageSize.getWidth(); const margin = 40; const cW = pw - 2*margin;
  const primary = hexToRgb(branding.primary_color||'#1A3226');
  doc.addPage(); await drawPageFrame(doc, branding, 'Disclosures', 'Important Disclosures');
  let y = 90;
  const paras = [
    'NOT LEGAL OR FINANCIAL ADVICE: This PropPrompt™ report is generated by artificial intelligence for informational and planning purposes only.',
    'NET PROCEEDS ESTIMATES: Estimated net proceeds are approximations and exclude capital gains taxes, prepayment penalties, and other costs.',
    'COMPARABLE SALES DATA: Comparable sales are sourced from publicly available MLS records, county registry data, and AI-assembled research.',
    'AVM ESTIMATES: Third-party Automated Valuation Model estimates are for informational purposes only.',
    'FAIR HOUSING COMPLIANCE: All archetype profiles and marketing guidance comply with the Fair Housing Act.',
    'AI-GENERATED CONTENT: This report uses large language model technology. Users are solely responsible for verifying accuracy.',
  ];
  doc.setFontSize(8.5);
  for (const para of paras) {
    const ci = para.indexOf(':');
    if (ci > 0) { doc.setFont('helvetica','bold'); doc.setTextColor(primary.r,primary.g,primary.b); doc.text(para.slice(0,ci+1),margin,y); doc.setFont('helvetica','normal'); doc.setTextColor(60,60,60); const rest=doc.splitTextToSize(para.slice(ci+1).trim(),cW); doc.text(rest,margin,y+12); y+=rest.length*12+18; }
    else { doc.setFont('helvetica','normal'); doc.setTextColor(60,60,60); const ln=doc.splitTextToSize(para,cW); doc.text(ln,margin,y); y+=ln.length*12+14; }
  }
}

async function renderInvestmentPdf(doc, data, branding) {
  const pw = doc.internal.pageSize.getWidth(); const margin = 40; const cW = pw - 2*margin;
  const primary = hexToRgb(branding.primary_color||'#1A3226'); const accent = hexToRgb(branding.accent_color||'#B8982F');
  const fmt = (n) => n != null ? `$${Number(n).toLocaleString()}` : 'N/A';
  const fmtPct = (n) => n != null ? `${Number(n).toFixed(1)}%` : 'N/A';
  const v = data.valuation||{}; const mc = data.market_context||{};

  await drawBrandedCover(doc, branding, 'Investment Analysis', data.property_address, [`Confidence: ${v.confidence_level||'Medium'}`, `Market: ${mc.market_characterization||'See Report'}`]);

  doc.addPage(); drawSectionDivider(doc, branding, 1, 'Property &\nMarket Overview', 'Subject property · market conditions · investment context');
  doc.addPage(); await drawPageFrame(doc, branding, 'Section 01 · Market Overview', 'Property & Market Overview');
  let y = 90;
  if (data.executive_summary) { doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(50,50,50); const ln=doc.splitTextToSize(data.executive_summary,cW); doc.text(ln.slice(0,16),margin,y); y+=Math.min(ln.length,16)*13+14; }
  const mRows = [['Median Sale Price',mc.median_sale_price?fmt(mc.median_sale_price):'N/A'],['YoY Appreciation',mc.yoy_appreciation?fmtPct(mc.yoy_appreciation):'N/A'],['Avg Days on Market',mc.avg_days_on_market?`${mc.avg_days_on_market} days`:'N/A'],['Months of Inventory',mc.months_inventory?`${mc.months_inventory}`:'N/A']];
  if(y+120<710) drawTable(doc,margin,y,['Indicator','Value'],mRows,[cW-130,130],{headerFill:branding.primary_color||'#1A3226',headerTextColor:'#FFFFFF',fontSize:9,rowHeight:26,branding});

  doc.addPage(); drawSectionDivider(doc, branding, 2, 'Income Approach\nAnalysis', 'Cap rate · GRM · cash-on-cash return · rent comps');
  if (data.tiered_comps?.tiers) {
    doc.addPage(); await drawPageFrame(doc, branding, 'Section 02 · Income Approach', 'Comparable Sales Analysis'); y=90;
    for (const tier of data.tiered_comps.tiers) {
      if(y+60>710){doc.addPage();await drawPageFrame(doc,branding,'Section 02 · Income Approach','Comparable Sales (cont.)');y=90;}
      const tC=tier.tier_id==='A'?primary:tier.tier_id==='B'?accent:hexToRgb('#888888');
      doc.setFillColor(tC.r,tC.g,tC.b); doc.roundedRect(margin,y,cW,22,3,3,'F'); doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255); doc.text(tier.tier_label||'Tier '+tier.tier_id,margin+8,y+15); y+=26;
      if(tier.comps?.length){ const rows=tier.comps.map(c=>[c.address||'',c.sale_date||'',c.sale_price?fmt(c.sale_price):'',c.adjusted_ppsf?`$${c.adjusted_ppsf}`:'',c.condition_vs_subject||'']); y=drawTable(doc,margin,y,['Address','Date','Price','Adj $/SF','Condition'],rows,[155,55,75,65,cW-358],{headerFill:branding.primary_color||'#1A3226',headerTextColor:'#FFFFFF',fontSize:7.5,rowHeight:22,branding}); y+=10; }
    }
  }

  doc.addPage(); drawSectionDivider(doc, branding, 3, 'Financial\nProjections', 'Five-year model · appreciation · cash flow scenarios');
  if (data.pricing_scenarios?.length) {
    doc.addPage(); await drawPageFrame(doc, branding, 'Section 03 · Financial Projections', 'Pricing Scenarios'); y=90;
    drawTable(doc,margin,y,['Scenario','Price','Est. DOM','Rationale'],data.pricing_scenarios.map(s=>[s.label||'',fmt(s.price),s.expected_dom||'',s.rationale||'']),[140,72,65,cW-285],{headerFill:branding.primary_color||'#1A3226',headerTextColor:'#FFFFFF',fontSize:8.5,rowHeight:26,branding});
  }

  doc.addPage(); drawSectionDivider(doc, branding, 4, 'Risk Assessment &\nRecommendation', 'Vacancy risk · market headwinds · investment thesis');
  doc.addPage(); await drawPageFrame(doc, branding, 'Section 04 · Risk Assessment', 'Risk Assessment & Recommendation'); y=90;
  if(v.narrative){ doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(50,50,50); doc.text(doc.splitTextToSize(v.narrative,cW).slice(0,22),margin,y); }

  const ivr = data.tiered_comps?.implied_value_range||{};
  await addClosingSummaryPage(doc, branding, 'Investment Analysis Summary', [['Property Address',data.property_address||''],['Value Range',ivr.low&&ivr.high?`${fmt(ivr.low)} – ${fmt(ivr.high)}`:'See Report'],['Confidence Level',v.confidence_level||'Medium'],['Market Characterization',mc.market_characterization||'N/A'],['YoY Appreciation',mc.yoy_appreciation?fmtPct(mc.yoy_appreciation):'N/A'],['Months of Inventory',mc.months_inventory?`${mc.months_inventory}`:'N/A'],['Prepared By',branding.agent_name||''],['Report Date',new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})]]);
  await addDisclaimerPage(doc, branding);
}

async function renderRentalMarketPdf(doc, data, branding) {
  const pw = doc.internal.pageSize.getWidth(); const margin = 40; const cW = pw - 2*margin;
  const primary = hexToRgb(branding.primary_color||'#1A3226'); const accent = hexToRgb(branding.accent_color||'#B8982F');
  const fmt = (n) => n != null ? `$${Number(n).toLocaleString()}` : 'N/A';
  const mc = data.market_context||{};

  await drawBrandedCover(doc, branding, 'Rental Market Analysis', data.property_address, [`Market: ${mc.market_characterization||'See Report'}`, `Analysis Year: ${new Date().getFullYear()}`]);

  doc.addPage(); drawSectionDivider(doc, branding, 1, 'Property &\nRental Context', 'Subject property · rental market conditions · tenant demand');
  doc.addPage(); await drawPageFrame(doc, branding, 'Section 01 · Rental Context', 'Property & Rental Market Overview'); let y=90;
  if(data.executive_summary){ doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(50,50,50); const ln=doc.splitTextToSize(data.executive_summary,cW); doc.text(ln.slice(0,22),margin,y); y+=Math.min(ln.length,22)*13+14; }

  doc.addPage(); drawSectionDivider(doc, branding, 2, 'Rent Range &\nComparables', 'Comparable rentals · achievable rent · positioning');
  doc.addPage(); await drawPageFrame(doc, branding, 'Section 02 · Rent Comparables', 'Rent Range & Comparable Rentals'); y=90;
  if(mc.narrative){ doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(50,50,50); const ml=doc.splitTextToSize(mc.narrative,cW); doc.text(ml.slice(0,20),margin,y); y+=Math.min(ml.length,20)*13+14; }
  const mStats=[['Avg Days on Market',mc.avg_days_on_market?`${mc.avg_days_on_market} days`:'N/A'],['Months of Inventory',mc.months_inventory?`${mc.months_inventory}`:'N/A'],['Market Characterization',mc.market_characterization||'N/A']];
  if(y+90<710) drawTable(doc,margin,y,['Indicator','Value'],mStats,[cW-130,130],{headerFill:branding.primary_color||'#1A3226',headerTextColor:'#FFFFFF',fontSize:9,rowHeight:26,branding});

  doc.addPage(); drawSectionDivider(doc, branding, 3, 'Landlord Economics\n& Risk Profile', 'Cash flow · vacancy risk · rent control exposure · recommendations');
  doc.addPage(); await drawPageFrame(doc, branding, 'Section 03 · Landlord Economics', 'Cash Flow & Risk Profile'); y=90;
  const v=data.valuation||{};
  if(v.narrative){ doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(50,50,50); doc.text(doc.splitTextToSize(v.narrative,cW).slice(0,22),margin,y); }

  await addClosingSummaryPage(doc, branding, 'Rental Analysis Summary', [['Property Address',data.property_address||''],['Market Characterization',mc.market_characterization||'N/A'],['Avg Days on Market',mc.avg_days_on_market?`${mc.avg_days_on_market} days`:'N/A'],['Months of Inventory',mc.months_inventory?`${mc.months_inventory}`:'N/A'],['Prepared By',branding.agent_name||''],['Report Date',new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})]]);
  await addDisclaimerPage(doc, branding);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { analysisId, subFormat, branding } = await req.json();
    if (!analysisId || !subFormat || !branding) return Response.json({ error: 'analysisId, subFormat, branding required' }, { status: 400 });

    const analyses = await base44.asServiceRole.entities.Analysis.filter({ id: analysisId });
    const analysis = analyses[0];
    if (!analysis || !analysis.output_json) return Response.json({ error: 'Analysis not found or no output_json' }, { status: 404 });

    const { jsPDF } = await import('npm:jspdf@2.5.2');
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });

    if (subFormat === 'investment') {
      await renderInvestmentPdf(doc, analysis.output_json, branding);
    } else if (subFormat === 'rental') {
      await renderRentalMarketPdf(doc, analysis.output_json, branding);
    } else {
      return Response.json({ error: `Unknown subFormat: ${subFormat}` }, { status: 400 });
    }

    const arrayBuffer = doc.output('arraybuffer');
    const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
    const file = new File([blob], `${subFormat}_${Date.now()}.pdf`, { type: 'application/pdf' });
    const uploadRes = await base44.asServiceRole.integrations.Core.UploadFile({ file });
    const fileUrl = uploadRes?.file_url;
    if (!fileUrl) throw new Error('File upload failed');

    return Response.json({ url: fileUrl });
  } catch (err) {
    console.error('[generateDocsExtra] error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});