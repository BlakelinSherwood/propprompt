/**
 * generateReportPdfs — renders CMA, Listing Pricing, and Buyer Intelligence PDFs.
 * Called by generateDocuments. Returns { base64, filename }.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

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

    const { jsPDF } = await import('npm:jspdf@2.5.2');
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });

    if (!analysis.output_json) {
      await renderFallbackTextPdf(doc, analysis, branding);
    } else if (analysis.assessment_type === 'cma') {
      await renderCMAPdf(doc, analysis.output_json, branding);
    } else if (analysis.assessment_type === 'listing_pricing') {
      await renderListingPricingPdf(doc, analysis.output_json, branding, analysis.net_proceeds_json);
    } else if (analysis.assessment_type === 'buyer_intelligence') {
      await renderBuyerIntelligencePdf(doc, analysis.output_json, branding);
    } else {
      await renderFallbackTextPdf(doc, analysis, branding);
    }

    const arrayBuffer = doc.output('arraybuffer');
    const bytes = new Uint8Array(arrayBuffer);
    let base64 = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      base64 += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    base64 = btoa(base64);
    const LABELS = { listing_pricing: 'Listing_Pricing_Analysis', buyer_intelligence: 'Buyer_Intelligence_Report', cma: 'Comparative_Market_Analysis' };
    const filename = `${LABELS[analysis.assessment_type] || 'Analysis'}_${Date.now()}.pdf`;

    return Response.json({ base64, filename });
  } catch (err) {
    console.error('[generateReportPdfs] error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexToRgb(hex) {
  const clean = (hex || '#000000').replace('#', '');
  return { r: parseInt(clean.slice(0,2),16), g: parseInt(clean.slice(2,4),16), b: parseInt(clean.slice(4,6),16) };
}

function prettifyEnum(val) {
  if (!val) return val;
  return val.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

async function drawPageFrame(doc, branding, breadcrumb, pageTitle) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const primary = hexToRgb(branding.primary_color || '#1A3226');
  const accent = hexToRgb(branding.accent_color || '#B8982F');

  doc.setFillColor(250, 248, 244); doc.rect(0, 0, pageWidth, pageHeight, 'F');
  doc.setFillColor(accent.r, accent.g, accent.b);
  doc.rect(0, 0, pageWidth, 3, 'F'); doc.rect(0, 789, pageWidth, 3, 'F');
  doc.setFillColor(primary.r, primary.g, primary.b); doc.rect(0, 735, pageWidth, 57, 'F');

  const footerParts = [branding.agent_name, branding.org_name].filter(Boolean);
  doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(255, 255, 255);
  doc.text(footerParts.join(' · '), 40, 758);

  if (branding.org_logo_url) {
    try {
      const r = await fetch(branding.org_logo_url); const b = await r.arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(b)));
      const ext = branding.org_logo_url.toLowerCase().includes('.png') ? 'PNG' : 'JPEG';
      doc.addImage(`data:image/${ext.toLowerCase()};base64,${b64}`, ext, pageWidth-68, 740, 40, 18, undefined, 'FAST');
    } catch (e) { drawMonogram(doc, branding, primary, accent, pageWidth); }
  } else { drawMonogram(doc, branding, primary, accent, pageWidth); }

  if (breadcrumb) {
    doc.setFillColor(accent.r, accent.g, accent.b); doc.rect(38, 12, 2, 14, 'F');
    doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(accent.r, accent.g, accent.b);
    doc.text(breadcrumb.toUpperCase(), 44, 22);
  }
  if (pageTitle) {
    doc.setFontSize(pageTitle.length > 40 ? 17 : 20); doc.setFont('helvetica', 'bold'); doc.setTextColor(primary.r, primary.g, primary.b);
    doc.text(pageTitle, 40, 62);
    doc.setDrawColor(accent.r, accent.g, accent.b); doc.setLineWidth(1.5); doc.line(40, 68, 150, 68);
  }
}

function drawMonogram(doc, branding, primary, accent, pageWidth) {
  const mono = (branding.org_name || 'PP').split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase();
  doc.setFillColor(accent.r, accent.g, accent.b); doc.roundedRect(pageWidth-60, 741, 32, 20, 3, 3, 'F');
  doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(primary.r, primary.g, primary.b);
  doc.text(mono, pageWidth-44, 754, { align: 'center' });
}

function drawSectionDivider(doc, branding, sectionNum, sectionTitle, subtitle) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const primary = hexToRgb(branding.primary_color || '#1A3226');
  const accent = hexToRgb(branding.accent_color || '#B8982F');

  doc.setFillColor(primary.r, primary.g, primary.b); doc.rect(0, 0, pageWidth, pageHeight, 'F');
  doc.setFillColor(accent.r, accent.g, accent.b);
  doc.rect(0, 0, pageWidth, 4, 'F'); doc.rect(0, 789, pageWidth, 3, 'F');

  const gL = Math.min(255, primary.r+28), gLG = Math.min(255, primary.g+28), gLB = Math.min(255, primary.b+28);
  doc.setFontSize(200); doc.setFont('helvetica', 'bold'); doc.setTextColor(gL, gLG, gLB);
  doc.text(String(sectionNum).padStart(2,'0'), pageWidth-20, pageHeight-60, { align: 'right' });

  doc.setDrawColor(accent.r, accent.g, accent.b); doc.setLineWidth(1); doc.line(40, 140, 390, 140);
  doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(accent.r, accent.g, accent.b);
  doc.text(`SECTION ${String(sectionNum).padStart(2,'0')}`, 40, 160);
  doc.setFillColor(accent.r, accent.g, accent.b); doc.rect(40, 185, 3, 60, 'F');
  doc.setFontSize(32); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
  doc.text(doc.splitTextToSize(sectionTitle, 480).slice(0, 2), 52, 210);
  if (subtitle) { doc.setFontSize(11); doc.setFont('helvetica', 'normal'); doc.setTextColor(accent.r, accent.g, accent.b); doc.text(subtitle, 52, 265, { maxWidth: 480 }); }
  const footerText = [branding.agent_name, branding.org_name].filter(Boolean).join(' · ');
  doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(180, 180, 180); doc.text(footerText, 40, 758);
}

function drawTable(doc, x, y, headers, rows, colWidths, options = {}) {
  const { headerFill='#1A3226', headerTextColor='#FFFFFF', altRowFill='#F4F1EA', fontSize=8, headerFontSize=8, rowHeight=24, padding=8, branding=null } = options;
  const pageHeight = doc.internal.pageSize.getHeight();
  const totalWidth = colWidths.reduce((a,b)=>a+b, 0);
  let currentY = y;
  const parseColor = (hex) => { const c=(hex||'#000').replace('#',''); return {r:parseInt(c.slice(0,2),16),g:parseInt(c.slice(2,4),16),b:parseInt(c.slice(4,6),16)}; };
  const drawHeaderRow = () => {
    const hc=parseColor(headerFill); doc.setFillColor(hc.r,hc.g,hc.b); doc.rect(x,currentY,totalWidth,rowHeight+4,'F');
    doc.setFontSize(headerFontSize); doc.setFont('helvetica','bold');
    const htc=parseColor(headerTextColor); doc.setTextColor(htc.r,htc.g,htc.b);
    let cx=x+padding; headers.forEach((h,i)=>{doc.text(h,cx,currentY+(rowHeight+4)/2+3); cx+=colWidths[i];}); currentY+=rowHeight+4;
  };
  drawHeaderRow(); doc.setFontSize(fontSize); doc.setFont('helvetica','normal');
  for (let ri=0; ri<rows.length; ri++) {
    if (currentY+rowHeight>pageHeight-65) { doc.addPage(); if (branding) drawPageFrame(doc,branding,null,null); currentY=90; drawHeaderRow(); doc.setFontSize(fontSize); doc.setFont('helvetica','normal'); }
    const isAlt=ri%2!==0;
    if (isAlt) { const a=parseColor(altRowFill); doc.setFillColor(a.r,a.g,a.b); } else { doc.setFillColor(255,255,255); }
    doc.rect(x,currentY,totalWidth,rowHeight,'F');
    doc.setDrawColor(224,221,214); doc.setLineWidth(0.5); doc.line(x,currentY+rowHeight,x+totalWidth,currentY+rowHeight);
    doc.setTextColor(26,26,26); let cx=x+padding;
    rows[ri].forEach((cell,ci)=>{
      doc.text(doc.splitTextToSize(String(cell??''),colWidths[ci]-padding*2)[0], cx, currentY+rowHeight/2+3);
      cx+=colWidths[ci];
    });
    currentY+=rowHeight;
  }
  return currentY;
}

async function drawBrandedCover(doc, branding, reportType, address, metaLines) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const primary = hexToRgb(branding.primary_color || '#1A3226');
  const accent = hexToRgb(branding.accent_color || '#B8982F');
  const today = new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });

  doc.setFillColor(primary.r,primary.g,primary.b); doc.rect(0,0,pageWidth,pageHeight,'F');
  doc.setFillColor(accent.r,accent.g,accent.b); doc.rect(0,0,pageWidth,4,'F'); doc.rect(0,pageHeight-3,pageWidth,3,'F');

  let logoBottomY = 88;
  if (branding.org_logo_url) {
    try {
      const r=await fetch(branding.org_logo_url); const b=await r.arrayBuffer();
      const l64=btoa(String.fromCharCode(...new Uint8Array(b)));
      const lext=branding.org_logo_url.toLowerCase().includes('.png')?'PNG':'JPEG';
      doc.addImage(`data:image/${lext.toLowerCase()};base64,${l64}`,lext,pageWidth/2-70,72,140,50,undefined,'FAST'); logoBottomY=130;
    } catch(e) { doc.setFontSize(24);doc.setFont('helvetica','bold');doc.setTextColor(255,255,255);doc.text(branding.org_name||'',pageWidth/2,108,{align:'center'}); }
  } else { doc.setFontSize(24);doc.setFont('helvetica','bold');doc.setTextColor(255,255,255);doc.text(branding.org_name||'',pageWidth/2,108,{align:'center'}); }

  const pillW=280, pillH=26;
  doc.setFillColor(accent.r,accent.g,accent.b); doc.roundedRect(pageWidth/2-pillW/2,logoBottomY+10,pillW,pillH,4,4,'F');
  doc.setFontSize(8.5); doc.setFont('helvetica','bold'); doc.setTextColor(primary.r,primary.g,primary.b);
  doc.text(reportType.toUpperCase(),pageWidth/2,logoBottomY+10+pillH/2+3,{align:'center'});
  doc.setDrawColor(accent.r,accent.g,accent.b); doc.setLineWidth(1);
  doc.line(pageWidth/2-160,logoBottomY+48,pageWidth/2+160,logoBottomY+48);

  const addrParts=(address||'').split(',');
  const addrY=logoBottomY+70;
  doc.setFontSize(26); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255);
  doc.text(addrParts[0]?.trim()||'', pageWidth/2, addrY, {align:'center',maxWidth:460});
  const cityState=addrParts.slice(1).join(',').trim();
  if (cityState) { doc.setFontSize(13);doc.setFont('helvetica','normal');doc.setTextColor(accent.r,accent.g,accent.b);doc.text(cityState,pageWidth/2,addrY+22,{align:'center'}); }

  let metaY=addrY+50;
  doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(180,180,180);
  (metaLines||[]).forEach(line=>{doc.text(line,pageWidth/2,metaY,{align:'center'});metaY+=16;});
  doc.text(`${today}  ·  CONFIDENTIAL`,pageWidth/2,metaY+4,{align:'center'});
  if (branding.agent_name) { doc.setFontSize(10);doc.setFont('helvetica','bold');doc.text(`Prepared by ${branding.agent_name}`,pageWidth/2,metaY+20,{align:'center'}); }
  const ctact=[branding.agent_phone,branding.agent_email].filter(Boolean).join('  ·  ');
  if (ctact) { doc.setFontSize(9);doc.setFont('helvetica','normal');doc.setTextColor(accent.r,accent.g,accent.b);doc.text(ctact,pageWidth/2,metaY+36,{align:'center'}); }

  doc.setFillColor(Math.min(255,primary.r+12),Math.min(255,primary.g+12),Math.min(255,primary.b+12));
  doc.rect(0,pageHeight-38,pageWidth,38,'F');
  doc.setFillColor(accent.r,accent.g,accent.b); doc.rect(0,pageHeight-38,pageWidth,1.5,'F');
  doc.setFontSize(7);doc.setFont('helvetica','normal');doc.setTextColor(180,180,180);
  doc.text(branding.org_name||'',pageWidth/2,pageHeight-16,{align:'center'});
}

async function addClosingSummaryPage(doc, branding, title, tableRows) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const primary = hexToRgb(branding.primary_color || '#1A3226');
  const accent = hexToRgb(branding.accent_color || '#B8982F');
  doc.addPage();
  doc.setFillColor(primary.r,primary.g,primary.b); doc.rect(0,0,pageWidth,ph,'F');
  doc.setFillColor(accent.r,accent.g,accent.b); doc.rect(0,0,pageWidth,4,'F'); doc.rect(0,ph-3,pageWidth,3,'F');
  doc.setDrawColor(accent.r,accent.g,accent.b); doc.setLineWidth(1); doc.line(pageWidth/2-150,108,pageWidth/2+150,108);
  doc.setFontSize(16); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255);
  doc.text(title.toUpperCase(),pageWidth/2,134,{align:'center'});
  const ctX=pageWidth/2-190, ctW=380, rh=22;
  doc.setFillColor(accent.r,accent.g,accent.b); doc.roundedRect(ctX,150,ctW,rh,2,2,'F');
  doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(primary.r,primary.g,primary.b);
  doc.text('CATEGORY',ctX+10,150+rh/2+3); doc.text('FINDING',ctX+ctW/2+10,150+rh/2+3);
  let cty=150+rh;
  tableRows.forEach((row,ri)=>{
    doc.setFillColor(Math.min(255,primary.r+(ri%2===0?14:24)),Math.min(255,primary.g+(ri%2===0?14:24)),Math.min(255,primary.b+(ri%2===0?14:24)));
    doc.rect(ctX,cty,ctW,rh,'F');
    doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(200,200,200);
    doc.text(String(row[0]||''),ctX+10,cty+rh/2+3); doc.setTextColor(220,220,220);
    doc.text(String(row[1]||''),ctX+ctW/2+10,cty+rh/2+3); cty+=rh;
  });
  const contact=[branding.agent_name,branding.agent_phone,branding.agent_email].filter(Boolean).join('  ·  ');
  if (contact) { doc.setFontSize(9);doc.setFont('helvetica','normal');doc.setTextColor(180,180,180);doc.text(contact,pageWidth/2,cty+28,{align:'center'}); }
}

async function addDisclaimerPage(doc, branding) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin=40, contentWidth=pageWidth-2*margin;
  const primary = hexToRgb(branding.primary_color || '#1A3226');
  doc.addPage(); await drawPageFrame(doc, branding, 'Disclosures', 'Important Disclosures');
  let y=90;
  const paras = [
    'NOT LEGAL OR FINANCIAL ADVICE: This PropPrompt™ report is generated by artificial intelligence for informational and planning purposes only. It does not constitute legal, financial, tax, or professional real estate advice.',
    'NET PROCEEDS ESTIMATES: Estimated net proceeds are approximations and exclude federal and state capital gains taxes, depreciation recapture, mortgage prepayment penalties, HOA transfer fees, and other transaction costs.',
    'COMPARABLE SALES DATA: Comparable sales are sourced from publicly available MLS records, county registry data, and AI-assembled research. Adjustments applied to out-of-area comparables are estimates, not appraisal-grade adjustments.',
    'AVM ESTIMATES: Third-party Automated Valuation Model estimates are for informational purposes only and may not reflect property-specific conditions, recent renovations, or local market nuances.',
    'FAIR HOUSING COMPLIANCE: All archetype profiles, migration analysis, and marketing guidance comply with the Fair Housing Act. Profiles are defined by life stage, financial profile, and lifestyle — never by any protected class.',
    'AI-GENERATED CONTENT: This report uses large language model technology. Users are solely responsible for verifying accuracy before reliance.',
  ];
  doc.setFontSize(8.5);
  for (const para of paras) {
    const ci=para.indexOf(':');
    if (ci>0) {
      doc.setFont('helvetica','bold'); doc.setTextColor(primary.r,primary.g,primary.b); doc.text(para.slice(0,ci+1),margin,y);
      doc.setFont('helvetica','normal'); doc.setTextColor(60,60,60);
      const rest=doc.splitTextToSize(para.slice(ci+1).trim(),contentWidth);
      doc.text(rest,margin,y+12); y+=rest.length*12+18;
    } else {
      doc.setFont('helvetica','normal'); doc.setTextColor(60,60,60);
      const lines=doc.splitTextToSize(para,contentWidth); doc.text(lines,margin,y); y+=lines.length*12+14;
    }
  }
}

async function renderAvmSection(doc, data, branding, margin, contentWidth, primary, accent, fmt) {
  const ap=data.avm_perception??null, al=data.avm_analysis||{};
  const platforms=ap?.platforms||al.platforms||null;
  if (!platforms?.length) return;
  doc.addPage(); await drawPageFrame(doc,branding,'Section 02 · Valuation Analysis','Consumer AVM Perception');
  let y=90;
  doc.setFontSize(9);doc.setFont('helvetica','normal');doc.setTextColor(accent.r,accent.g,accent.b);
  doc.text('What the internet thinks your home is worth — and why the full picture is more nuanced',margin,y); y+=18;
  let hasNull=false;
  const colW=[88,90,80,80,50], totalW=colW.reduce((a,b)=>a+b,0), rh=24;
  doc.setFillColor(primary.r,primary.g,primary.b); doc.rect(margin,y,totalW,rh+4,'F');
  doc.setFontSize(8);doc.setFont('helvetica','bold');doc.setTextColor(255,255,255);
  let cx=margin+8; ['Platform','Estimate','Range Low','Range High','Trend'].forEach((h,i)=>{doc.text(h,cx,y+rh/2+5);cx+=colW[i];}); y+=rh+4;
  platforms.forEach((p,ri)=>{
    const raw=p.estimate, hasEst=raw!=null&&raw!=='null'&&raw!=='';
    if (!hasEst) hasNull=true;
    const disp=hasEst?(typeof raw==='number'?fmt(raw):raw):null;
    const row=[p.name||p.platform||'',disp,hasEst?(p.range_low?(typeof p.range_low==='number'?fmt(p.range_low):p.range_low):'—'):'—',hasEst?(p.range_high?(typeof p.range_high==='number'?fmt(p.range_high):p.range_high):'—'):'—',p.trend||'—'];
    ri%2!==0?doc.setFillColor(244,241,234):doc.setFillColor(255,255,255);
    doc.rect(margin,y,totalW,rh,'F');doc.setDrawColor(224,221,214);doc.setLineWidth(0.5);doc.line(margin,y+rh,margin+totalW,y+rh);
    cx=margin+8; row.forEach((cell,ci)=>{
      if (ci===1&&cell===null) { doc.setFontSize(7.5);doc.setFont('helvetica','italic');doc.setTextColor(150,150,150);doc.text('No estimate available',cx,y+rh/2+3); }
      else { doc.setFontSize(8);doc.setFont('helvetica','normal');doc.setTextColor(26,26,26);doc.text(String(cell||'—'),cx,y+rh/2+3); }
      cx+=colW[ci];
    }); y+=rh;
  }); y+=6;
  if (hasNull&&y+22<710) { doc.setFontSize(7.5);doc.setFont('helvetica','italic');doc.setTextColor(120,120,120);doc.text(doc.splitTextToSize('* This property may be too recent or have insufficient transaction history for this platform to generate an estimate.',contentWidth),margin,y); y+=20; }
  const gapDir=ap?.gap_direction||al.gap_analysis?.direction||null;
  const alignN=ap?.alignment_narrative||null;
  if (gapDir&&y+44<710) {
    const lbl=gapDir==='professional_higher'?'PROFESSIONAL ESTIMATE HIGHER':gapDir==='avm_higher'?'AVMs HIGHER':'AVMs ALIGNED WITH PROFESSIONAL RANGE';
    doc.setFillColor(primary.r,primary.g,primary.b);doc.roundedRect(margin,y,contentWidth,alignN?52:40,3,3,'F');
    doc.setFontSize(9);doc.setFont('helvetica','bold');doc.setTextColor(255,255,255);
    const cl=ap?.composite_average?`AVM Composite: ${ap.composite_average}  →  `:'';
    doc.text(`${cl}${lbl}${ap?.gap_percent?' ('+ap.gap_percent+')':''}`,margin+10,y+16);
    if (alignN) { doc.setFontSize(8.5);doc.setFont('helvetica','normal');doc.setTextColor(accent.r,accent.g,accent.b);doc.text(doc.splitTextToSize(alignN,contentWidth-20)[0],margin+10,y+34); }
  }
}

function drawPropertyContextSection(doc, branding, pc, margin, contentWidth, primary, accent, drawTable) {
  let y = 90;
  if (pc.walkability) {
    const w=pc.walkability;
    doc.setFontSize(10);doc.setFont('helvetica','bold');doc.setTextColor(primary.r,primary.g,primary.b);doc.text('Walkability & Transit',margin,y);y+=14;
    const sbW=(contentWidth-12)/3;
    [['WALK SCORE',w.walk_score,w.walk_label],['TRANSIT SCORE',w.transit_score,w.transit_label],['BIKE SCORE',w.bike_score,w.bike_label]].forEach(([label,val,sub],i)=>{
      const bx=margin+i*(sbW+6);
      doc.setFillColor(primary.r,primary.g,primary.b);doc.roundedRect(bx,y,sbW,54,3,3,'F');
      doc.setFontSize(6.5);doc.setFont('helvetica','bold');doc.setTextColor(accent.r,accent.g,accent.b);doc.text(label,bx+sbW/2,y+12,{align:'center'});
      doc.setFontSize(16);doc.setFont('helvetica','bold');doc.setTextColor(255,255,255);doc.text(val!=null?`${val}/100`:'N/A',bx+sbW/2,y+34,{align:'center'});
      doc.setFontSize(7);doc.setFont('helvetica','normal');doc.setTextColor(accent.r,accent.g,accent.b);doc.text(sub||'',bx+sbW/2,y+47,{align:'center',maxWidth:sbW-8});
    }); y+=64;
  }
  if (pc.flood_zone) {
    const fz=pc.flood_zone;
    doc.setFontSize(10);doc.setFont('helvetica','bold');doc.setTextColor(primary.r,primary.g,primary.b);doc.text('FEMA Flood Zone',margin,y);y+=12;
    const fc=fz.insurance_required?{r:180,g:40,b:40}:{r:22,g:101,b:52};
    doc.setFillColor(fc.r,fc.g,fc.b);doc.roundedRect(margin,y,contentWidth,42,3,3,'F');
    doc.setFontSize(13);doc.setFont('helvetica','bold');doc.setTextColor(255,255,255);doc.text(`Zone ${fz.flood_zone||'Unknown'} — ${fz.flood_zone_description||''}`,margin+12,y+16);
    doc.setFontSize(9);doc.setFont('helvetica','normal');doc.text(fz.insurance_required?'⚠ Flood insurance required':'✓ Standard zone — not required',margin+12,y+32);y+=54;
  }
  if (pc.schools?.assigned_schools?.length) {
    doc.setFontSize(10);doc.setFont('helvetica','bold');doc.setTextColor(primary.r,primary.g,primary.b);doc.text('Assigned Schools',margin,y);y+=12;
    const rows=pc.schools.assigned_schools.map(s=>[s.name||'',s.type||'',s.grades||'',s.distance_miles!=null?`${s.distance_miles} mi`:'',s.rating!=null?`${s.rating}/10`:'—']);
    y=drawTable(doc,margin,y,['School','Type','Grades','Distance','Rating'],rows,[200,70,60,65,55],{headerFill:branding.primary_color||'#1A3226',headerTextColor:'#FFFFFF',fontSize:8.5,rowHeight:24,branding});y+=8;
  }
  return y;
}

async function renderFallbackTextPdf(doc, analysis, branding) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const primary = hexToRgb(branding.primary_color || '#333333');
  const accent = hexToRgb(branding.accent_color || '#666666');
  doc.setFillColor(primary.r,primary.g,primary.b); doc.rect(0,0,pageWidth,70,'F');
  doc.setTextColor(255,255,255); doc.setFontSize(18); doc.setFont('helvetica','bold');
  doc.text(branding.org_name||'Analysis Report',40,44);
  doc.setTextColor(50,50,50); doc.setFontSize(14); doc.setFont('helvetica','bold');
  doc.text(analysis.assessment_type?.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())||'Analysis',40,105);
  if (analysis.intake_data?.address) { doc.setFontSize(10);doc.setFont('helvetica','normal');doc.setTextColor(100,100,100);doc.text(analysis.intake_data.address,40,121); }
  doc.setDrawColor(accent.r,accent.g,accent.b); doc.setLineWidth(1); doc.line(40,132,pageWidth-40,132);
  const outputText=analysis.output_text||'(No output available)';
  doc.setFontSize(10);doc.setFont('helvetica','normal');doc.setTextColor(50,50,50);
  const splitText=doc.splitTextToSize(outputText,pageWidth-80);
  let y=152;
  for (const line of splitText) {
    if (y+14>doc.internal.pageSize.getHeight()-80) { doc.addPage(); y=60; }
    doc.text(line,40,y); y+=14;
  }
}

async function renderCMAPdf(doc, data, branding) {
  const pageWidth=doc.internal.pageSize.getWidth(), margin=40, contentWidth=pageWidth-2*margin;
  const primary=hexToRgb(branding.primary_color||'#1A3226'), accent=hexToRgb(branding.accent_color||'#B8982F');
  const fmt=(n)=>n!=null?`$${Number(n).toLocaleString()}`:'N/A';
  const fmtPct=(n)=>n!=null?`${Number(n).toFixed(1)}%`:'N/A';
  const mc=data.market_context||{}, iv=data.tiered_comps?.implied_value_range||{};
  const totalComps=(data.tiered_comps?.tiers||[]).reduce((s,t)=>s+(t.comps?.length||0),0);

  await drawBrandedCover(doc,branding,'Comparative Market Analysis',data.property_address,[`${totalComps||0} Comparable Sales Analyzed`,`Market: ${mc.market_characterization||'See Report'}`]);

  doc.addPage(); drawSectionDivider(doc,branding,1,'Subject Property','Property details · condition assessment');
  doc.addPage(); await drawPageFrame(doc,branding,'Section 01 · Subject Property','Property & Market Overview');
  let y=90;
  if (mc.narrative) { doc.setFontSize(9);doc.setFont('helvetica','normal');doc.setTextColor(50,50,50);const nl=doc.splitTextToSize(mc.narrative,contentWidth);doc.text(nl.slice(0,7),margin,y);y+=Math.min(nl.length,7)*13+14; }
  drawTable(doc,margin,y,['Market Indicator','Value'],[
    ['Median Sale Price',mc.median_sale_price?fmt(mc.median_sale_price):'N/A'],
    ['YoY Appreciation',mc.yoy_appreciation?fmtPct(mc.yoy_appreciation):'N/A'],
    ['Avg Days on Market',mc.avg_days_on_market?`${mc.avg_days_on_market} days`:'N/A'],
    ['Sale-to-List Ratio',mc.sale_to_list_ratio?fmtPct(mc.sale_to_list_ratio*100):'N/A'],
    ['Months of Inventory',mc.months_inventory?`${mc.months_inventory} months`:'N/A'],
    ['Market Characterization',mc.market_characterization?prettifyEnum(mc.market_characterization):'N/A'],
  ],[contentWidth-130,130],{headerFill:branding.primary_color||'#1A3226',headerTextColor:'#FFFFFF',fontSize:9,rowHeight:26,branding});

  const pc=data.property_context||{};
  if (pc.walkability||pc.flood_zone||pc.schools) {
    doc.addPage(); await drawPageFrame(doc,branding,'Section 01 · Subject Property','Property Context');
    drawPropertyContextSection(doc,branding,pc,margin,contentWidth,primary,accent,drawTable);
  }

  doc.addPage(); drawSectionDivider(doc,branding,2,'Comparable Sales\nAnalysis','Tiered comparables · adjustments · PPSF range');
  doc.addPage(); await drawPageFrame(doc,branding,'Section 02 · Comparable Sales','Tiered Comparable Sales');
  y=90;
  if (data.tiered_comps?.tiers) {
    for (const tier of data.tiered_comps.tiers) {
      if (y+60>710) { doc.addPage(); await drawPageFrame(doc,branding,'Section 02 · Comparable Sales','Comparable Sales (cont.)'); y=90; }
      const tc=tier.tier_id==='A'?primary:tier.tier_id==='B'?accent:hexToRgb('#888888');
      doc.setFillColor(tc.r,tc.g,tc.b); doc.roundedRect(margin,y,contentWidth,22,3,3,'F');
      doc.setFontSize(9);doc.setFont('helvetica','bold');doc.setTextColor(255,255,255);
      const ppsf=tier.ppsf_range?`  ·  $${tier.ppsf_range.low}–$${tier.ppsf_range.high}/SF`:'';
      doc.text(`${tier.tier_label||'Tier '+tier.tier_id}${ppsf}`,margin+8,y+15); y+=26;
      if (tier.comps?.length) {
        y=drawTable(doc,margin,y,['Address','Date','Price','SF','$/SF Raw','$/SF Adj','Condition'],
          tier.comps.map(c=>[c.address||'',c.sale_date||'',c.sale_price?fmt(c.sale_price):'',c.square_feet?c.square_feet.toLocaleString():'',c.raw_ppsf?`$${c.raw_ppsf}`:'',c.adjusted_ppsf?`$${c.adjusted_ppsf}`:'',c.condition_vs_subject||'']),
          [130,52,68,42,55,55,60],{headerFill:branding.primary_color||'#1A3226',headerTextColor:'#FFFFFF',fontSize:7.5,rowHeight:22,branding});y+=10;
      }
    }
  }

  doc.addPage(); drawSectionDivider(doc,branding,3,'Valuation\nConvergence','Three independent methods · confidence range');
  doc.addPage(); await drawPageFrame(doc,branding,'Section 03 · Valuation Convergence','Valuation Summary');
  y=90;
  const v=data.valuation||{};
  if (v.narrative) { doc.setFontSize(9);doc.setFont('helvetica','normal');doc.setTextColor(50,50,50);const vl=doc.splitTextToSize(v.narrative,contentWidth);doc.text(vl.slice(0,10),margin,y);y+=Math.min(vl.length,10)*13+14; }
  if (iv.low&&iv.high) { doc.setFillColor(primary.r,primary.g,primary.b);doc.roundedRect(margin,y,contentWidth,38,3,3,'F');doc.setFontSize(11);doc.setFont('helvetica','bold');doc.setTextColor(accent.r,accent.g,accent.b);doc.text(`Implied Value Range: ${fmt(iv.low)} – ${fmt(iv.high)}  ·  Midpoint: ${fmt(iv.midpoint)}`,margin+10,y+24); }
  if (data.tiered_comps?.thin_comp_flag) { doc.setFontSize(8);doc.setTextColor(180,50,50);doc.text('⚠ Thin comp set — valuation confidence is reduced.',margin,y+50); }

  await renderAvmSection(doc,data,branding,margin,contentWidth,primary,accent,fmt);
  await addClosingSummaryPage(doc,branding,'CMA Summary',[
    ['Property Address',data.property_address||''],['Comparable Sales',String(totalComps||'N/A')],
    ['Implied Value Range',iv.low&&iv.high?`${fmt(iv.low)} – ${fmt(iv.high)}`:'See Report'],
    ['Value Midpoint',iv.midpoint?fmt(iv.midpoint):'See Report'],['Confidence Level',data.confidence_level||'Medium'],
    ['Market Characterization',mc.market_characterization?prettifyEnum(mc.market_characterization):'N/A'],
    ['Avg Days on Market',mc.avg_days_on_market?`${mc.avg_days_on_market} days`:'N/A'],
    ['Prepared By',branding.agent_name||''],
    ['Report Date',new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})],
  ]);
  await addDisclaimerPage(doc, branding);
}

async function renderListingPricingPdf(doc, data, branding, netProceedsJson=null) {
  const pageWidth=doc.internal.pageSize.getWidth(), pageHeight=doc.internal.pageSize.getHeight();
  const margin=40, contentWidth=pageWidth-2*margin;
  const primary=hexToRgb(branding.primary_color||'#1A3226'), accent=hexToRgb(branding.accent_color||'#B8982F');
  const fmt=(n)=>n!=null?`$${Number(n).toLocaleString()}`:'N/A';
  const fmtPct=(n)=>n!=null?`${Number(n).toFixed(1)}%`:'N/A';
  const v=data.valuation||{}, mc=data.market_context||{};
  const isPro=!!(data.buyer_archetypes?.length||data.migration_analysis?.feeder_markets?.length);
  const today=new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});
  const month=new Date().getMonth(), year=new Date().getFullYear();
  const season=month<3?'Winter':month<6?'Spring':month<9?'Summer':'Fall';
  const BODY_SIZE=10.5, LINE_H=15, BOTTOM=720;

  async function renderNarrative(text,breadcrumb,title,startY) {
    if (!text) return startY;
    let y=startY; doc.setFontSize(BODY_SIZE);doc.setFont('helvetica','normal');doc.setTextColor(50,50,50);
    for (const line of doc.splitTextToSize(text,contentWidth)) {
      if (y+LINE_H>BOTTOM) { doc.addPage();await drawPageFrame(doc,branding,breadcrumb,title);y=90;doc.setFontSize(BODY_SIZE);doc.setFont('helvetica','normal');doc.setTextColor(50,50,50); }
      doc.text(line,margin,y); y+=LINE_H;
    }
    return y+10;
  }

  // COVER
  doc.setFillColor(primary.r,primary.g,primary.b); doc.rect(0,0,pageWidth,pageHeight,'F');
  doc.setFillColor(accent.r,accent.g,accent.b); doc.rect(0,0,pageWidth,4,'F'); doc.rect(0,pageHeight-3,pageWidth,3,'F');
  let logoBottomY=88;
  if (branding.org_logo_url) {
    try { const r=await fetch(branding.org_logo_url);const b=await r.arrayBuffer();const l64=btoa(String.fromCharCode(...new Uint8Array(b)));const lext=branding.org_logo_url.toLowerCase().includes('.png')?'PNG':'JPEG';doc.addImage(`data:image/${lext.toLowerCase()};base64,${l64}`,lext,pageWidth/2-70,72,140,50,undefined,'FAST');logoBottomY=130;
    } catch(e) { doc.setFontSize(26);doc.setFont('helvetica','bold');doc.setTextColor(255,255,255);doc.text(branding.org_name||'PropPrompt',pageWidth/2,108,{align:'center'});logoBottomY=120; }
  } else { doc.setFontSize(26);doc.setFont('helvetica','bold');doc.setTextColor(255,255,255);doc.text(branding.org_name||'PropPrompt',pageWidth/2,108,{align:'center'});logoBottomY=120; }
  const pillW=290,pillH=26;
  doc.setFillColor(accent.r,accent.g,accent.b);doc.roundedRect(pageWidth/2-pillW/2,logoBottomY+10,pillW,pillH,4,4,'F');
  doc.setFontSize(8.5);doc.setFont('helvetica','bold');doc.setTextColor(primary.r,primary.g,primary.b);
  doc.text(`LISTING PRICING ANALYSIS  ·  ${season.toUpperCase()} ${year}`,pageWidth/2,logoBottomY+10+pillH/2+3,{align:'center'});
  doc.setDrawColor(accent.r,accent.g,accent.b);doc.setLineWidth(1);doc.line(pageWidth/2-160,logoBottomY+48,pageWidth/2+160,logoBottomY+48);
  const addrParts=(data.property_address||'').split(',');
  const addrY=logoBottomY+72;
  doc.setFontSize(28);doc.setFont('helvetica','bold');doc.setTextColor(255,255,255);doc.text(addrParts[0]?.trim()||'',pageWidth/2,addrY,{align:'center',maxWidth:460});
  if (addrParts.slice(1).join(',').trim()) { doc.setFontSize(14);doc.setFont('helvetica','normal');doc.setTextColor(accent.r,accent.g,accent.b);doc.text(addrParts.slice(1).join(',').trim(),pageWidth/2,addrY+22,{align:'center'}); }
  let metaY=addrY+52;
  doc.setFontSize(9);doc.setFont('helvetica','normal');doc.setTextColor(180,180,180);doc.text(`${today}  ·  CONFIDENTIAL`,pageWidth/2,metaY+6,{align:'center'});
  if (branding.agent_name) { doc.setFontSize(10);doc.setFont('helvetica','bold');doc.setTextColor(180,180,180);doc.text(`Prepared by ${branding.agent_name}`,pageWidth/2,metaY+22,{align:'center'}); }
  const cp=[branding.agent_phone,branding.agent_email].filter(Boolean);
  if (cp.length) { doc.setFontSize(9);doc.setFont('helvetica','normal');doc.setTextColor(accent.r,accent.g,accent.b);doc.text(cp.join('  ·  '),pageWidth/2,metaY+40,{align:'center'}); }
  doc.setFillColor(Math.min(255,primary.r+12),Math.min(255,primary.g+12),Math.min(255,primary.b+12));
  doc.rect(0,pageHeight-38,pageWidth,38,'F');doc.setFillColor(accent.r,accent.g,accent.b);doc.rect(0,pageHeight-38,pageWidth,1.5,'F');
  doc.setFontSize(7);doc.setFont('helvetica','normal');doc.setTextColor(180,180,180);doc.text(branding.org_name||'',pageWidth/2,pageHeight-16,{align:'center'});

  // SECTION 01
  doc.addPage(); drawSectionDivider(doc,branding,1,'Property & Market Context','Property details · market conditions · rate environment');
  doc.addPage(); await drawPageFrame(doc,branding,'Section 01 · Property & Market Context','Property & Market Overview');
  let y=90;
  if (data.executive_summary) y=await renderNarrative(data.executive_summary,'Section 01 · Property & Market Context','Property & Market Overview',y);
  const statBoxes=[
    {label:'MEDIAN SALE PRICE',value:mc.median_sale_price?fmt(mc.median_sale_price):'N/A'},
    {label:'YOY APPRECIATION',value:mc.yoy_appreciation?fmtPct(mc.yoy_appreciation):'N/A'},
    {label:'AVG DAYS ON MARKET',value:mc.avg_days_on_market?`${mc.avg_days_on_market}d`:'N/A'},
    {label:'SALE-TO-LIST RATIO',value:mc.sale_to_list_ratio?fmtPct(mc.sale_to_list_ratio*100):'N/A'},
  ];
  const boxW=(contentWidth-18)/4;
  if (y+60>BOTTOM) { doc.addPage();await drawPageFrame(doc,branding,'Section 01 · Property & Market Context','Market Snapshot');y=90; }
  statBoxes.forEach((sb,i)=>{
    const bx=margin+i*(boxW+6);
    doc.setFillColor(primary.r,primary.g,primary.b);doc.roundedRect(bx,y,boxW,52,3,3,'F');
    doc.setFontSize(6.5);doc.setFont('helvetica','bold');doc.setTextColor(accent.r,accent.g,accent.b);doc.text(sb.label,bx+boxW/2,y+14,{align:'center',maxWidth:boxW-8});
    doc.setFontSize(13);doc.setFont('helvetica','bold');doc.setTextColor(255,255,255);doc.text(sb.value,bx+boxW/2,y+36,{align:'center',maxWidth:boxW-8});
  }); y+=64;
  if (mc.narrative) { if (y+40>BOTTOM){doc.addPage();await drawPageFrame(doc,branding,'Section 01 · Property & Market Context','Market Conditions');y=90;} y=await renderNarrative(mc.narrative,'Section 01 · Property & Market Context','Market Conditions',y); }
  drawTable(doc,margin,y,['Market Indicator','Value'],[
    ['Median Sale Price',mc.median_sale_price?fmt(mc.median_sale_price):'N/A'],
    ['YoY Appreciation',mc.yoy_appreciation?fmtPct(mc.yoy_appreciation):'N/A'],
    ['Avg Days on Market',mc.avg_days_on_market?`${mc.avg_days_on_market} days`:'N/A'],
    ['Sale-to-List Ratio',mc.sale_to_list_ratio?fmtPct(mc.sale_to_list_ratio*100):'N/A'],
    ['Months of Inventory',mc.months_inventory?`${mc.months_inventory} months`:'N/A'],
    ['Market Characterization',mc.market_characterization?prettifyEnum(mc.market_characterization):'N/A'],
  ],[contentWidth-140,140],{headerFill:branding.primary_color||'#1A3226',headerTextColor:'#FFFFFF',fontSize:10,rowHeight:28,branding});

  const pc=data.property_context||{};
  if (pc.walkability||pc.flood_zone||pc.schools) {
    doc.addPage(); await drawPageFrame(doc,branding,'Section 01 · Property & Market Context','Property Context'); y=90;
    drawPropertyContextSection(doc,branding,pc,margin,contentWidth,primary,accent,drawTable);
  }

  // SECTION 02
  doc.addPage(); drawSectionDivider(doc,branding,2,'Valuation Analysis','Comparable sales · valuation convergence · AVM perception');
  doc.addPage(); await drawPageFrame(doc,branding,'Section 02 · Valuation Analysis','Tiered Comparable Sales'); y=90;
  if (data.tiered_comps?.tiers) {
    for (const tier of data.tiered_comps.tiers) {
      if (y+60>710){doc.addPage();await drawPageFrame(doc,branding,'Section 02 · Valuation Analysis','Comparable Sales (cont.)');y=90;}
      const tc=tier.tier_id==='A'?primary:tier.tier_id==='B'?accent:hexToRgb('#888888');
      doc.setFillColor(tc.r,tc.g,tc.b);doc.roundedRect(margin,y,contentWidth,22,3,3,'F');
      doc.setFontSize(9);doc.setFont('helvetica','bold');doc.setTextColor(255,255,255);
      const ppsf=tier.ppsf_range?`  ·  $${tier.ppsf_range.low}–$${tier.ppsf_range.high}/SF`:'';
      doc.text(`${tier.tier_label||'Tier '+tier.tier_id}${ppsf}`,margin+8,y+15);y+=26;
      if (tier.comps?.length) {
        y=drawTable(doc,margin,y,['Address','Date','Price','SF','$/SF Raw','$/SF Adj','Condition'],
          tier.comps.map(c=>[c.address||'',c.sale_date||'',c.sale_price?fmt(c.sale_price):'',c.square_feet?c.square_feet.toLocaleString():'',c.raw_ppsf?`$${c.raw_ppsf}`:'',c.adjusted_ppsf?`$${c.adjusted_ppsf}`:'',c.condition_vs_subject||'']),
          [130,52,68,42,52,52,56],{headerFill:branding.primary_color||'#1A3226',headerTextColor:'#FFFFFF',fontSize:7.5,rowHeight:22,branding});y+=10;
      }
    }
  }
  if (data.tiered_comps?.implied_value_range) {
    const ivr=data.tiered_comps.implied_value_range;
    if (y+36>710){doc.addPage();await drawPageFrame(doc,branding,'Section 02 · Valuation Analysis','Implied Value Range');y=90;}
    doc.setFillColor(primary.r,primary.g,primary.b);doc.roundedRect(margin,y,contentWidth,32,3,3,'F');
    doc.setFontSize(11);doc.setFont('helvetica','bold');doc.setTextColor(accent.r,accent.g,accent.b);
    doc.text(`Implied Value Range: ${fmt(ivr.low)} – ${fmt(ivr.high)}  ·  Midpoint: ${fmt(ivr.midpoint)}`,margin+10,y+21);y+=40;
  }
  if (v.narrative) {
    if (y+40>BOTTOM){doc.addPage();await drawPageFrame(doc,branding,'Section 02 · Valuation Analysis','Valuation Summary');y=90;}
    doc.setFontSize(11);doc.setFont('helvetica','bold');doc.setTextColor(primary.r,primary.g,primary.b);doc.text('Valuation Summary',margin,y);y+=16;
    y=await renderNarrative(v.narrative,'Section 02 · Valuation Analysis','Valuation Summary',y);
  }
  await renderAvmSection(doc,data,branding,margin,contentWidth,primary,accent,fmt);

  // SECTION 03: Buyer Intelligence (Pro+)
  if (isPro) {
    doc.addPage(); drawSectionDivider(doc,branding,3,'Buyer Demand Intelligence','Archetype profiles · migration patterns · employer targeting');
    const archetypes=data.buyer_archetypes||[];
    if (archetypes.length) {
      doc.addPage(); await drawPageFrame(doc,branding,'Section 03 · Buyer Demand Intelligence','Buyer Archetype Profiles'); y=90;
      for (const [idx,arch] of archetypes.entries()) {
        const pLines=doc.splitTextToSize(arch.profile||'',contentWidth-22);
        const useItems=(arch.language_use||[]).slice(0,4), avoidItems=(arch.language_avoid||[]).slice(0,3);
        const cardH=Math.max(80,44+pLines.length*LINE_H+(useItems.length?22:0));
        if (y+cardH>BOTTOM){doc.addPage();await drawPageFrame(doc,branding,'Section 03 · Buyer Demand Intelligence','Buyer Archetypes (cont.)');y=90;}
        doc.setFillColor(idx%2===0?247:252,idx%2===0?247:252,idx%2===0?244:252);doc.roundedRect(margin,y,contentWidth,cardH,3,3,'F');
        doc.setFillColor(primary.r,primary.g,primary.b);doc.roundedRect(margin,y,4,cardH,2,2,'F');
        doc.setFontSize(10);doc.setFont('helvetica','bold');doc.setTextColor(primary.r,primary.g,primary.b);doc.text(arch.archetype_name||'',margin+12,y+16);
        doc.setFontSize(9);doc.setFont('helvetica','normal');doc.setTextColor(accent.r,accent.g,accent.b);doc.text(`${arch.estimated_pool_pct||0}% of buyer pool`,margin+12,y+30);
        doc.setFontSize(BODY_SIZE);doc.setFont('helvetica','normal');doc.setTextColor(60,60,60);doc.text(pLines,margin+12,y+44);
        const langY=y+44+pLines.length*LINE_H+6;
        if (useItems.length) { doc.setFontSize(8);doc.setFont('helvetica','bold');doc.setTextColor(accent.r,accent.g,accent.b);doc.text('USE:',margin+12,langY);doc.setFont('helvetica','normal');doc.setTextColor(50,50,50);doc.text(useItems.join('  ·  '),margin+36,langY); }
        if (avoidItems.length) { doc.setFontSize(8);doc.setFont('helvetica','bold');doc.setTextColor(180,50,50);doc.text('AVOID:',margin+12,langY+14);doc.setFont('helvetica','normal');doc.setTextColor(50,50,50);doc.text(avoidItems.join('  ·  '),margin+44,langY+14); }
        y+=cardH+8;
      }
    }
    const mig=data.migration_analysis||{};
    if (mig.feeder_markets?.length||mig.employer_targets?.length) {
      doc.addPage(); await drawPageFrame(doc,branding,'Section 03 · Buyer Demand Intelligence','Migration & Employer Targeting'); y=90;
      if (mig.feeder_markets?.length) {
        doc.setFontSize(9);doc.setFont('helvetica','bold');doc.setTextColor(primary.r,primary.g,primary.b);doc.text('Top Feeder Markets',margin,y);y+=14;
        y=drawTable(doc,margin,y,['Feeder Market','Score','Primary Motivation','Price Psychology'],
          mig.feeder_markets.map(m=>[m.market||'',String(m.migration_score||''),m.primary_motivation||'',m.price_psychology||'']),
          [145,42,170,175],{headerFill:branding.primary_color||'#1A3226',headerTextColor:'#FFFFFF',fontSize:8,rowHeight:22,branding});y+=20;
      }
      if (mig.employer_targets?.length) {
        if (y+60>710){doc.addPage();await drawPageFrame(doc,branding,'Section 03 · Buyer Demand Intelligence','Employer Targeting Matrix');y=90;}
        doc.setFontSize(9);doc.setFont('helvetica','bold');doc.setTextColor(primary.r,primary.g,primary.b);doc.text('Employer Targeting Matrix',margin,y);y+=14;
        drawTable(doc,margin,y,['Company','Relevance','Target Roles','Commute'],
          mig.employer_targets.map(e=>[e.company||'',e.relevance||'',e.target_roles||'',e.commute_time||'']),
          [150,60,190,100],{headerFill:branding.primary_color||'#1A3226',headerTextColor:'#FFFFFF',fontSize:7.5,rowHeight:22,branding});
      }
    }
  }

  // SECTION 04: Pricing Strategy
  doc.addPage(); drawSectionDivider(doc,branding,4,'Pricing Strategy & Recommendation','Pricing scenarios · strategic recommendation · pre-listing timeline');
  doc.addPage(); await drawPageFrame(doc,branding,'Section 04 · Pricing Strategy','Pricing Scenarios'); y=90;
  if (data.pricing_scenarios?.length) {
    y=drawTable(doc,margin,y,['Scenario','Price','Est. DOM','Rationale'],
      data.pricing_scenarios.map(s=>[s.label||'',fmt(s.price),s.expected_dom||'',s.rationale||'']),
      [140,72,65,contentWidth-285],{headerFill:branding.primary_color||'#1A3226',headerTextColor:'#FFFFFF',fontSize:8.5,rowHeight:26,branding});y+=16;
  }
  if (v.strategic_list_price) {
    if (y+52>710){doc.addPage();await drawPageFrame(doc,branding,'Section 04 · Pricing Strategy','Strategic Recommendation');y=90;}
    doc.setFillColor(primary.r,primary.g,primary.b);doc.roundedRect(margin,y,contentWidth,48,3,3,'F');
    doc.setFontSize(8.5);doc.setFont('helvetica','bold');doc.setTextColor(accent.r,accent.g,accent.b);doc.text('RECOMMENDED STRATEGIC LIST PRICE',margin+10,y+14);
    doc.setFontSize(24);doc.setFont('helvetica','bold');doc.setTextColor(255,255,255);doc.text(fmt(v.strategic_list_price),margin+10,y+39);
    if (v.recommended_range_low) { doc.setFontSize(10);doc.setFont('helvetica','normal');doc.setTextColor(accent.r,accent.g,accent.b);doc.text(`Range: ${fmt(v.recommended_range_low)} – ${fmt(v.recommended_range_high)}`,margin+contentWidth*0.45,y+39); }
    y+=56;
  }

  // SECTION 05: Seller Financial Summary
  doc.addPage(); drawSectionDivider(doc,branding,5,'Seller Financial Summary','Estimated net proceeds · analysis summary');
  doc.addPage(); await drawPageFrame(doc,branding,'Section 05 · Seller Financial Summary','Estimated Net Proceeds'); y=90;
  if (!netProceedsJson?.scenarios?.length) {
    doc.setFillColor(244,241,234);doc.roundedRect(margin,y,contentWidth,44,3,3,'F');
    doc.setFontSize(9);doc.setFont('helvetica','italic');doc.setTextColor(100,100,100);
    doc.text('Seller net proceeds not calculated. Financial data was not provided during report setup.',margin+12,y+28,{maxWidth:contentWidth-24});y+=52;
  } else {
    const npS=netProceedsJson.scenarios;
    y=drawTable(doc,margin,y,['Scenario','Sale Price','Commission','Closing','Mortgage','Net Proceeds'],
      npS.map(s=>[s.label||'',s.sale_price||'',s.commission||'',s.closing_costs||'',s.mortgage_payoff||'',s.estimated?(s.net_proceeds+' *'):(s.net_proceeds||'')]),
      [contentWidth-390,80,80,80,80,90],{headerFill:branding.primary_color||'#1A3226',headerTextColor:'#FFFFFF',fontSize:8.5,rowHeight:28,branding});y+=10;
    if (npS.some(s=>s.estimated)&&y+22<710) { doc.setFontSize(7.5);doc.setFont('helvetica','italic');doc.setTextColor(120,120,120);doc.text('* Based on estimated mortgage payoff — verify with lender before sharing.',margin,y);y+=14; }
  }

  await addDisclaimerPage(doc, branding);
}

async function renderBuyerIntelligencePdf(doc, data, branding) {
  const pageWidth=doc.internal.pageSize.getWidth(), margin=40, contentWidth=pageWidth-2*margin;
  const primary=hexToRgb(branding.primary_color||'#1A3226'), accent=hexToRgb(branding.accent_color||'#B8982F');
  const fmt=(n)=>n!=null?`$${Number(n).toLocaleString()}`:'N/A';
  const archetypes=data.buyer_archetypes||[], mig=data.migration_analysis||{};

  await drawBrandedCover(doc,branding,'Buyer Intelligence Report',data.property_address,[`${archetypes.length} Buyer Archetypes Profiled`,`${(mig.feeder_markets||[]).length} Feeder Markets Analyzed`]);

  doc.addPage(); drawSectionDivider(doc,branding,1,'Market\nSnapshot','Current conditions · buyer competition · inventory');
  doc.addPage(); await drawPageFrame(doc,branding,'Section 01 · Market Snapshot','Market Conditions Overview');
  let y=90;
  const mc=data.market_context||{};
  if (mc.narrative) { doc.setFontSize(9);doc.setFont('helvetica','normal');doc.setTextColor(50,50,50);const nl=doc.splitTextToSize(mc.narrative,contentWidth);doc.text(nl.slice(0,8),margin,y);y+=Math.min(nl.length,8)*13+14; }
  drawTable(doc,margin,y,['Market Indicator','Value'],[
    ['Median Sale Price',mc.median_sale_price?fmt(mc.median_sale_price):'N/A'],
    ['Avg Days on Market',mc.avg_days_on_market?`${mc.avg_days_on_market} days`:'N/A'],
    ['Sale-to-List Ratio',mc.sale_to_list_ratio?`${(mc.sale_to_list_ratio*100).toFixed(1)}%`:'N/A'],
    ['Months of Inventory',mc.months_inventory?`${mc.months_inventory} months`:'N/A'],
  ],[contentWidth-130,130],{headerFill:branding.primary_color||'#1A3226',headerTextColor:'#FFFFFF',fontSize:9,rowHeight:26,branding});

  if (archetypes.length) {
    doc.addPage(); drawSectionDivider(doc,branding,2,'Buyer Archetype\nProfiles','Who is buying · language calibration · pool composition');
    doc.addPage(); await drawPageFrame(doc,branding,'Section 02 · Buyer Archetypes','Buyer Archetype Profiles'); y=90;
    archetypes.forEach((arch,idx)=>{
      const cardH=68;
      if (y+cardH>710){doc.addPage();drawPageFrame(doc,branding,'Section 02 · Buyer Archetypes','Buyer Archetypes (cont.)');y=90;}
      doc.setFillColor(idx%2===0?247:252,idx%2===0?247:252,244);doc.roundedRect(margin,y,contentWidth,cardH,3,3,'F');
      doc.setFillColor(primary.r,primary.g,primary.b);doc.roundedRect(margin,y,4,cardH,2,2,'F');
      doc.setFontSize(9);doc.setFont('helvetica','bold');doc.setTextColor(primary.r,primary.g,primary.b);doc.text(`${arch.archetype_name||''}  (${arch.estimated_pool_pct||0}%)`,margin+12,y+14);
      doc.setFontSize(8);doc.setFont('helvetica','normal');doc.setTextColor(60,60,60);doc.text(doc.splitTextToSize(arch.profile||'',contentWidth-22).slice(0,2),margin+12,y+28);
      if (arch.language_use?.length) { doc.setFontSize(7.5);doc.setFont('helvetica','bold');doc.setTextColor(accent.r,accent.g,accent.b);doc.text('USE: ',margin+12,y+56);doc.setFont('helvetica','normal');doc.setTextColor(50,50,50);doc.text(arch.language_use.slice(0,3).join('  ·  '),margin+30,y+56); }
      y+=cardH+6;
    });
  }

  doc.addPage(); drawSectionDivider(doc,branding,3,'Offer Strategy &\nPositioning','Price psychology · competitive tactics · timing');
  if (mig.feeder_markets?.length||mig.employer_targets?.length) {
    doc.addPage(); await drawPageFrame(doc,branding,'Section 03 · Offer Strategy','Migration & Employer Targeting'); y=90;
    if (mig.feeder_markets?.length) {
      doc.setFontSize(9);doc.setFont('helvetica','bold');doc.setTextColor(primary.r,primary.g,primary.b);doc.text('Top Feeder Markets',margin,y);y+=14;
      y=drawTable(doc,margin,y,['Feeder Market','Score','Primary Motivation','Price Psychology'],
        mig.feeder_markets.map(m=>[m.market||'',String(m.migration_score||''),m.primary_motivation||'',m.price_psychology||'']),
        [145,42,180,165],{headerFill:branding.primary_color||'#1A3226',headerTextColor:'#FFFFFF',fontSize:8,rowHeight:22,branding});y+=20;
    }
    if (mig.employer_targets?.length) {
      doc.setFontSize(9);doc.setFont('helvetica','bold');doc.setTextColor(primary.r,primary.g,primary.b);doc.text('Employer Targeting Matrix',margin,y);y+=14;
      drawTable(doc,margin,y,['Company','Relevance','Target Roles','Commute'],
        mig.employer_targets.map(e=>[e.company||'',e.relevance||'',e.target_roles||'',e.commute_time||'']),
        [150,60,190,100],{headerFill:branding.primary_color||'#1A3226',headerTextColor:'#FFFFFF',fontSize:7.5,rowHeight:22,branding});
    }
  }

  await addClosingSummaryPage(doc,branding,'Buyer Intelligence Summary',[
    ['Property Address',data.property_address||''],['Buyer Archetypes Profiled',String(archetypes.length)],
    ['Feeder Markets Analyzed',String((mig.feeder_markets||[]).length)],
    ['Employer Targets',String((mig.employer_targets||[]).length)],
    ['Market Characterization',mc.market_characterization||'N/A'],
    ['Avg Days on Market',mc.avg_days_on_market?`${mc.avg_days_on_market} days`:'N/A'],
    ['Prepared By',branding.agent_name||''],
    ['Report Date',new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})],
  ]);
  await addDisclaimerPage(doc, branding);
}