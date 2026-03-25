import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ─── Shared PPTX Helpers (inlined from functions/pptxHelpers.js) ────────────
// CRITICAL: All colors come from the brand object. Never hardcode hex values.

function lightenHex(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, (num >> 16) + Math.round(((num >> 16) * percent) / 100));
  const g = Math.min(255, ((num >> 8) & 0x00FF) + Math.round((((num >> 8) & 0x00FF) * percent) / 100));
  const b = Math.min(255, (num & 0x0000FF) + Math.round(((num & 0x0000FF) * percent) / 100));
  return ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

function addFooterBar(slide, pptx, brand) {
  const PRIMARY = brand.primary_color.replace('#', '');
  const ACCENT = brand.accent_color.replace('#', '');
  slide.addShape(pptx.shapes.RECTANGLE, {
    x: 0, y: 5.25, w: 10, h: 0.015, fill: { color: ACCENT }
  });
  slide.addShape(pptx.shapes.RECTANGLE, {
    x: 0, y: 5.27, w: 10, h: 0.23, fill: { color: PRIMARY }
  });
  const footerText = brand.team_name
    ? brand.team_name + ' · ' + (brand.email || '') + ' · ' + (brand.website || '')
    : (brand.org_name || '') + ' · ' + (brand.email || '') + ' · ' + (brand.website || '');
  slide.addText(footerText, {
    x: 0.3, y: 5.27, w: 7, h: 0.23,
    fontSize: 7, fontFace: 'Arial', color: 'FFFFFF',
    align: 'left', valign: 'middle'
  });
  if (brand.logo_url) {
    slide.addImage({ path: brand.logo_url, x: 9.0, y: 5.27, w: 0.6, h: 0.22, sizing: { type: 'contain' } });
  }
}

function addContentSlideHeader(slide, sectionLabel, pageTitle, brand) {
  const ACCENT = brand.accent_color.replace('#', '');
  const PRIMARY = brand.primary_color.replace('#', '');
  slide.addText(sectionLabel, {
    x: 0.5, y: 0.25, w: 5, h: 0.2,
    fontSize: 8, fontFace: 'Arial', color: ACCENT, bold: true, charSpacing: 1.5
  });
  slide.addText(pageTitle, {
    x: 0.5, y: 0.45, w: 8, h: 0.45,
    fontSize: 22, fontFace: 'Georgia', color: PRIMARY, bold: true
  });
}

function addSectionDivider(pptx, sectionNumber, title, subtitle, brand) {
  const PRIMARY = brand.primary_color.replace('#', '');
  const ACCENT = brand.accent_color.replace('#', '');
  const WATERMARK = lightenHex(brand.primary_color, 15);
  const slide = pptx.addSlide();
  slide.background = { color: PRIMARY };
  slide.addShape(pptx.shapes.RECTANGLE, {
    x: 0.5, y: 0.95, w: 5.5, h: 0.025, fill: { color: ACCENT }
  });
  slide.addText(sectionNumber.toString().padStart(2, '0'), {
    x: -0.3, y: 1.2, w: 4.5, h: 4.0,
    fontSize: 220, fontFace: 'Georgia', color: WATERMARK,
    bold: true, align: 'left', valign: 'bottom'
  });
  slide.addShape(pptx.shapes.RECTANGLE, {
    x: 0.88, y: 1.65, w: 0.035, h: 2.0, fill: { color: ACCENT }
  });
  slide.addText(title, {
    x: 1.05, y: 1.65, w: 8.0, h: 1.5,
    fontSize: 42, fontFace: 'Georgia', color: 'FFFFFF',
    bold: true, align: 'left', valign: 'top', lineSpacing: 48
  });
  slide.addText(subtitle, {
    x: 1.05, y: 3.15, w: 8.0, h: 0.45,
    fontSize: 13, fontFace: 'Arial', color: ACCENT,
    align: 'left', valign: 'top'
  });
  if (brand.logo_url) {
    slide.addImage({ path: brand.logo_url, x: 0.35, y: 0.12, w: 0.7, h: 0.7, sizing: { type: 'contain' } });
  }
  addFooterBar(slide, pptx, brand);
  return slide;
}
// ─── End Shared PPTX Helpers ─────────────────────────────────────────────────

/**
 * generatePptx — Server-side branded PPTX generator.
 * Called internally by generateDocuments when format = 'pptx'.
 * Also callable directly: POST { analysisId, branding }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { analysisId, branding } = await req.json();
    if (!analysisId) return Response.json({ error: 'analysisId required' }, { status: 400 });

    const analyses = await base44.asServiceRole.entities.Analysis.filter({ id: analysisId });
    const analysis = analyses[0];
    if (!analysis) return Response.json({ error: 'Analysis not found' }, { status: 404 });

    const resolvedBranding = branding || (await resolveBranding(base44, analysisId));

    const { bytes, filename } = await buildPptx(analysis, resolvedBranding);

    const mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    const blob = new Blob([bytes], { type: mimeType });
    const file = new File([blob], filename, { type: mimeType });
    const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file });

    await base44.asServiceRole.entities.Analysis.update(analysisId, {
      output_pptx_url: file_url,
      pptx_url: file_url,
      last_exported_at: new Date().toISOString(),
      last_export_format: 'pptx',
    });

    console.log(`[generatePptx] created ${filename} => ${file_url}`);
    return Response.json({ url: file_url, filename });

  } catch (err) {
    console.error('[generatePptx] error:', err.message, err.stack);
    return Response.json({ error: err.message }, { status: 500 });
  }
});

// ─── Core PPTX builder ────────────────────────────────────────────────────────

export async function buildPptx(analysis, b) {
  const PptxGenJS = (await import('npm:pptxgenjs@3.12.0')).default;
  const pptx = new PptxGenJS();

  pptx.defineLayout({ name: 'LETTER_LANDSCAPE', width: 11, height: 8.5 });
  pptx.layout = 'LETTER_LANDSCAPE';
  pptx.author = b.agent_name || b.org_name || '';
  pptx.company = b.org_name || '';
  pptx.subject = ASSESSMENT_LABELS[analysis.assessment_type] || 'Analysis';

  const pri = hex(b.primary_color);
  const acc = hex(b.accent_color);
  const bg  = hex(b.background_color);

  const dateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  // ── Structured deck builders (new) ──────────────────────────────────────────
  const structuredBuilders = {
    'cma': buildCMADeck,
    'listing_pricing': buildListingPricingDeck,
    'buyer_intelligence': buildBuyerIntelligenceDeck,
    'client_portfolio': buildClientPortfolioDeck,
    'investment_analysis': buildInvestmentDeck,
    'rental_analysis': buildRentalMarketDeck,
  };

  const builder = structuredBuilders[analysis.assessment_type];

  if (builder && analysis.output_json) {
    // Use structured deck builder
    return buildStructuredPptx(pptx, analysis, b, pri, acc, bg, dateStr, builder);
  }

  // Fall back to narrative deck (existing code)
  // ── Parse sections from output_text ─────────────────────────────────────────
  const sections = parseAnalysisSections(analysis.output_text || '');

  for (let sIdx = 0; sIdx < sections.length; sIdx++) {
    const section = sections[sIdx];
    const sectionNum = String(sIdx + 1).padStart(2, '0');

    // ── Section divider slide ──────────────────────────────────────────────────
    const divider = pptx.addSlide();
    divider.background = { color: pri };

    // Section number
    divider.addText(sectionNum, {
      x: 0.5, y: 0.5, w: 2, h: 1.0,
      fontSize: 48, bold: true, color: acc,
      fontFace: 'Georgia',
    });

    // Section title
    divider.addText(section.title, {
      x: 0.5, y: 1.6, w: 9, h: 0.8,
      fontSize: 24, bold: true, color: 'FFFFFF',
      fontFace: 'Georgia',
    });

    // Optional subtitle (first line of body if short)
    const subtitle = getSubtitle(section.body);
    if (subtitle) {
      divider.addText(subtitle, {
        x: 0.5, y: 2.5, w: 9, h: 0.5,
        fontSize: 13, italic: true, color: 'CCCCCC',
        fontFace: 'Calibri',
      });
    }

    // Org logo — bottom right
    if (b.org_logo_url) {
      divider.addImage({ path: b.org_logo_url, x: 9.5, y: 7.9, w: 1.3, h: 0.4, sizing: { type: 'contain', w: 1.3, h: 0.4 } });
    }

    // ── Content slides (one or more) ───────────────────────────────────────────
    const contentChunks = chunkContent(section.body, 1100);
    for (let cIdx = 0; cIdx < contentChunks.length; cIdx++) {
      const content = pptx.addSlide();
      content.background = { color: bg };

      // Top bar
      content.addShape(pptx.ShapeType.rect, {
        x: 0, y: 0, w: 11, h: 0.08,
        fill: { color: pri }, line: { color: pri },
      });

      // Breadcrumb
      content.addText(`${b.org_name || ''}  /  ${section.title}`.toUpperCase(), {
        x: 0.3, y: 0.12, w: 10.4, h: 0.25,
        fontSize: 7.5, color: acc, fontFace: 'Calibri',
        charSpacing: 1.5,
      });

      // Slide title
      const slideTitle = cIdx === 0 ? section.title : `${section.title} (cont.)`;
      content.addText(slideTitle, {
        x: 0.3, y: 0.42, w: 10.4, h: 0.6,
        fontSize: 20, bold: true, color: pri,
        fontFace: 'Georgia',
      });

      // Body text
      content.addText(contentChunks[cIdx], {
        x: 0.3, y: 1.15, w: 10.4, h: 6.75,
        fontSize: 11, color: '1A1A1A',
        fontFace: 'Calibri', valign: 'top', wrap: true, paraSpaceAfter: 4,
      });

      // Footer bar
      content.addShape(pptx.ShapeType.rect, {
        x: 0, y: 8.25, w: 11, h: 0.25,
        fill: { color: pri }, line: { color: pri },
      });
      const footerLeft = [b.org_name, b.org_phone].filter(Boolean).join('  |  ');
      if (footerLeft) {
        content.addText(footerLeft, {
          x: 0.2, y: 8.27, w: 8, h: 0.2,
          fontSize: 8, color: 'FFFFFF', fontFace: 'Calibri',
        });
      }
      content.addText(`${sIdx + 1}.${cIdx + 1}`, {
        x: 9.5, y: 8.27, w: 1.3, h: 0.2,
        fontSize: 8, color: 'FFFFFF', fontFace: 'Calibri', align: 'right',
      });
    }
  }

  // ── Final slide: Agent Signature ──────────────────────────────────────────
  const finale = pptx.addSlide();
  finale.background = { color: pri };

  // Org logo — centered, upper zone
  if (b.org_logo_url) {
    finale.addImage({ path: b.org_logo_url, x: 4.0, y: 0.5, w: 3.0, h: 1.0, sizing: { type: 'contain', w: 3.0, h: 1.0 } });
  }

  // Horizontal rule
  finale.addShape(pptx.ShapeType.line, {
    x: 1.5, y: 1.8, w: 8, h: 0,
    line: { color: acc, width: 1.5 },
  });

  // Agent headshot (circle crop via roundRect trick)
  let agentYStart = 2.1;
  if (b.agent_headshot_url) {
    finale.addImage({
      path: b.agent_headshot_url,
      x: 4.72, y: 2.1, w: 1.1, h: 1.1,
      rounding: true,
    });
    agentYStart = 3.35;
  }

  // Agent name
  finale.addText(b.agent_name || '', {
    x: 0.5, y: agentYStart, w: 10, h: 0.6,
    fontSize: 18, bold: true, color: 'FFFFFF',
    fontFace: 'Georgia', align: 'center',
  });

  // Agent title
  if (b.agent_title) {
    finale.addText(b.agent_title, {
      x: 0.5, y: agentYStart + 0.65, w: 10, h: 0.4,
      fontSize: 12, color: 'DDDDDD', fontFace: 'Calibri', align: 'center',
    });
  }

  // Phone | Email
  const contactLine = [b.agent_phone, b.agent_email].filter(Boolean).join('   |   ');
  if (contactLine) {
    finale.addText(contactLine, {
      x: 0.5, y: agentYStart + 1.15, w: 10, h: 0.4,
      fontSize: 11, color: 'DDDDDD', fontFace: 'Calibri', align: 'center',
    });
  }

  // Personal tagline
  if (b.agent_tagline) {
    finale.addText(b.agent_tagline, {
      x: 0.5, y: agentYStart + 1.65, w: 10, h: 0.4,
      fontSize: 11, italic: true, color: 'CCCCCC',
      fontFace: 'Calibri', align: 'center',
    });
  }

  // Org address / website — bottom
  const orgFooter = [b.org_address, b.org_website].filter(Boolean).join('   ·   ');
  if (orgFooter) {
    finale.addText(orgFooter, {
      x: 0.5, y: 7.9, w: 10, h: 0.35,
      fontSize: 9, color: 'CCCCCC', fontFace: 'Calibri', align: 'center',
    });
  }

  // ── Write to buffer ─────────────────────────────────────────────────────────
  const pptxBase64 = await pptx.write({ outputType: 'base64' });
  const bytes = Uint8Array.from(atob(pptxBase64), c => c.charCodeAt(0));
  const safeLabel = (ASSESSMENT_LABELS[analysis.assessment_type] || 'Analysis').replace(/\s+/g, '_');
  const filename = `${safeLabel}_${Date.now()}.pptx`;

  return { bytes, filename };
}

// ─── Structured PPTX Builder Wrapper ──────────────────────────────────────────

async function buildStructuredPptx(pptx, analysis, b, pri, acc, bg, dateStr, builder) {
  // Cover slide (shared)
  const cover = pptx.addSlide();
  cover.background = { color: pri };

  if (b.org_logo_url) {
    cover.addImage({ path: b.org_logo_url, x: 4.0, y: 0.6, w: 3.0, h: 1.2, sizing: { type: 'contain', w: 3.0, h: 1.2 } });
  } else {
    cover.addText(b.org_name || '', {
      x: 0.5, y: 0.6, w: 10, h: 1.2,
      fontSize: 32, bold: true, color: 'FFFFFF',
      fontFace: 'Georgia', align: 'center',
    });
  }

  const address = analysis.intake_data?.address || '';
  if (address) {
    cover.addText(address, {
      x: 0.5, y: 2.3, w: 10, h: 0.7,
      fontSize: 20, bold: true, color: 'FFFFFF',
      fontFace: 'Georgia', align: 'center',
    });
  }

  const assessLabel = ASSESSMENT_LABELS[analysis.assessment_type] || 'Analysis';
  cover.addText(assessLabel.toUpperCase(), {
    x: 3.5, y: 3.2, w: 4, h: 0.45,
    fontSize: 10, bold: true, color: 'FFFFFF',
    fontFace: 'Calibri', align: 'center',
    fill: { color: acc },
    shape: pptx.ShapeType.roundRect,
    rectRadius: 0.08,
  });

  cover.addShape(pptx.ShapeType.line, {
    x: 1.5, y: 4.2, w: 8, h: 0,
    line: { color: acc, width: 1.5 },
  });

  cover.addText(`Prepared by ${b.agent_name || ''}`, {
    x: 0.5, y: 4.4, w: 10, h: 0.4,
    fontSize: 11, color: 'FFFFFF', fontFace: 'Calibri', align: 'center',
  });
  cover.addText(dateStr, {
    x: 0.5, y: 4.85, w: 10, h: 0.35,
    fontSize: 10, color: 'DDDDDD', fontFace: 'Calibri', align: 'center',
  });

  // Call structured builder
  await builder(pptx, analysis.output_json, b, { pri, acc, bg });

  // Finale slide (shared)
  const finale = pptx.addSlide();
  finale.background = { color: pri };

  if (b.org_logo_url) {
    finale.addImage({ path: b.org_logo_url, x: 4.0, y: 0.5, w: 3.0, h: 1.0, sizing: { type: 'contain', w: 3.0, h: 1.0 } });
  }

  finale.addShape(pptx.ShapeType.line, {
    x: 1.5, y: 1.8, w: 8, h: 0,
    line: { color: acc, width: 1.5 },
  });

  let agentYStart = 2.1;
  if (b.agent_headshot_url) {
    finale.addImage({
      path: b.agent_headshot_url,
      x: 4.72, y: 2.1, w: 1.1, h: 1.1,
      rounding: true,
    });
    agentYStart = 3.35;
  }

  finale.addText(b.agent_name || '', {
    x: 0.5, y: agentYStart, w: 10, h: 0.6,
    fontSize: 18, bold: true, color: 'FFFFFF',
    fontFace: 'Georgia', align: 'center',
  });

  if (b.agent_title) {
    finale.addText(b.agent_title, {
      x: 0.5, y: agentYStart + 0.65, w: 10, h: 0.4,
      fontSize: 12, color: 'DDDDDD', fontFace: 'Calibri', align: 'center',
    });
  }

  const contactLine = [b.agent_phone, b.agent_email].filter(Boolean).join('   |   ');
  if (contactLine) {
    finale.addText(contactLine, {
      x: 0.5, y: agentYStart + 1.15, w: 10, h: 0.4,
      fontSize: 11, color: 'DDDDDD', fontFace: 'Calibri', align: 'center',
    });
  }

  if (b.agent_tagline) {
    finale.addText(b.agent_tagline, {
      x: 0.5, y: agentYStart + 1.65, w: 10, h: 0.4,
      fontSize: 11, italic: true, color: 'CCCCCC',
      fontFace: 'Calibri', align: 'center',
    });
  }

  const orgFooter = [b.org_address, b.org_website].filter(Boolean).join('   ·   ');
  if (orgFooter) {
    finale.addText(orgFooter, {
      x: 0.5, y: 7.9, w: 10, h: 0.35,
      fontSize: 9, color: 'CCCCCC', fontFace: 'Calibri', align: 'center',
    });
  }

  // Write to buffer
  const pptxBase64 = await pptx.write({ outputType: 'base64' });
  const bytes = Uint8Array.from(atob(pptxBase64), c => c.charCodeAt(0));
  const safeLabel = (ASSESSMENT_LABELS[analysis.assessment_type] || 'Analysis').replace(/\s+/g, '_');
  const filename = `${safeLabel}_${Date.now()}.pptx`;

  return { bytes, filename };
}

// ─── Structured Deck Builders ─────────────────────────────────────────────────

/**
 * buildCMADeck — Comparative Market Analysis structured deck
 */
async function buildCMADeck(pptx, data, b, colors) {
  const { pri, acc, bg } = colors;
  const margin = 0.3;
  const contentWidth = 11 - 2 * margin;

  // ──── SLIDE 1: Market Context ────────────────────────────────────────────────
  const s1 = pptx.addSlide();
  s1.background = { color: bg };
  addSlideHeader(pptx, s1, 'Market Context', pri, acc, b, margin);

  const marketStats = data.market_context || {};
  const marketRows = [
    ['Median Sale Price', marketStats.median_sale_price ? `$${(marketStats.median_sale_price / 1000).toFixed(0)}K` : 'N/A'],
    ['YoY Appreciation', marketStats.yoy_appreciation ? `${marketStats.yoy_appreciation.toFixed(1)}%` : 'N/A'],
    ['Avg Days on Market', marketStats.avg_days_on_market ? `${marketStats.avg_days_on_market} days` : 'N/A'],
    ['Sale-to-List Ratio', marketStats.sale_to_list_ratio ? `${(marketStats.sale_to_list_ratio * 100).toFixed(1)}%` : 'N/A'],
    ['Months of Inventory', marketStats.months_inventory ? `${marketStats.months_inventory.toFixed(1)}` : 'N/A'],
  ];

  s1.addTable(marketRows, {
    x: margin, y: 1.3, w: contentWidth, h: 3.5,
    border: { pt: 0.5, color: 'CCCCCC' },
    rowH: 0.6,
    colW: [contentWidth * 0.5, contentWidth * 0.5],
    fill: { color: 'F8F8F8' },
    align: 'left',
    fontSize: 10,
    fontFace: 'Calibri',
  });

  addSlideFooter(pptx, s1, b, margin);

  // ──── SLIDE 2: Tiered Comparables Table ──────────────────────────────────────
  if (data.tiered_comps?.tiers) {
    const s2 = pptx.addSlide();
    s2.background = { color: bg };
    addSlideHeader(pptx, s2, 'Comparable Sales Analysis', pri, acc, b, margin);

    let currentY = 1.3;

    for (const tier of data.tiered_comps.tiers) {
      if (!tier.comps || tier.comps.length === 0) continue;

      // Tier label
      const tierColor = tier.tier_id === 'A' ? pri : tier.tier_id === 'B' ? acc : 'AAAAAA';
      s2.addShape(pptx.ShapeType.rect, {
        x: margin, y: currentY, w: contentWidth, h: 0.3,
        fill: { color: tierColor }, line: { color: tierColor },
      });
      s2.addText(`${tier.tier_label} (${tier.ppsf_range?.low || 'N/A'} – ${tier.ppsf_range?.high || 'N/A'}/SF)`, {
        x: margin + 0.1, y: currentY, w: contentWidth - 0.2, h: 0.3,
        fontSize: 9, bold: true, color: 'FFFFFF', valign: 'middle',
      });
      currentY += 0.4;

      // Comp rows
      const compRows = tier.comps.map(c => [
        c.address || '',
        c.sale_date || '',
        c.sale_price ? `$${(c.sale_price / 1000).toFixed(0)}K` : '',
        c.square_feet ? `${c.square_feet.toLocaleString()}` : '',
        c.raw_ppsf ? `$${c.raw_ppsf}` : '',
        c.adjusted_ppsf ? `$${c.adjusted_ppsf}` : '',
      ]);

      s2.addTable(compRows, {
        x: margin, y: currentY, w: contentWidth, h: Math.min(tier.comps.length * 0.35, 3),
        border: { pt: 0.5, color: 'CCCCCC' },
        rowH: 0.35,
        colW: [contentWidth * 0.25, contentWidth * 0.12, contentWidth * 0.13, contentWidth * 0.12, contentWidth * 0.15, contentWidth * 0.15],
        fill: { color: 'F8F8F8' },
        align: 'left',
        fontSize: 8,
        fontFace: 'Calibri',
      });
      currentY += Math.min(tier.comps.length * 0.35, 3) + 0.3;
    }

    addSlideFooter(pptx, s2, b, margin);
  }

  // ──── SLIDE 3: Implied Value Range ──────────────────────────────────────────
  if (data.implied_value_range) {
    const s3 = pptx.addSlide();
    s3.background = { color: bg };
    addSlideHeader(pptx, s3, 'Valuation Summary', pri, acc, b, margin);

    const low = data.implied_value_range.low ? `$${(data.implied_value_range.low / 1000000).toFixed(2)}M` : 'N/A';
    const high = data.implied_value_range.high ? `$${(data.implied_value_range.high / 1000000).toFixed(2)}M` : 'N/A';

    s3.addShape(pptx.ShapeType.rect, {
      x: margin, y: 1.5, w: contentWidth, h: 1.5,
      fill: { color: pri }, line: { color: pri },
    });
    s3.addText('Implied Value Range', {
      x: margin + 0.15, y: 1.65, w: contentWidth - 0.3, h: 0.35,
      fontSize: 12, bold: true, color: acc,
    });
    s3.addText(`${low} – ${high}`, {
      x: margin + 0.15, y: 2.05, w: contentWidth - 0.3, h: 0.8,
      fontSize: 32, bold: true, color: 'FFFFFF', fontFace: 'Georgia',
    });

    if (data.tiered_comps?.comp_date_window?.thin_comp_flag) {
      s3.addText('⚠ Thin comp set — fewer than 4 comparable sales within 18 months. Valuation confidence is reduced.', {
        x: margin, y: 3.3, w: contentWidth, h: 0.6,
        fontSize: 9, color: 'CC0000', italic: true,
      });
    }

    addSlideFooter(pptx, s3, b, margin);
  }
}

// ─── Structured Deck Placeholders ─────────────────────────────────────────────

async function buildListingPricingDeck(pptx, data, b, colors) {
  // TODO: Build listing_pricing deck
}

async function buildBuyerIntelligenceDeck(pptx, data, b, colors) {
  // TODO: Build buyer_intelligence deck
}

async function buildClientPortfolioDeck(pptx, data, b, colors) {
  // TODO: Build client_portfolio deck
}

async function buildInvestmentDeck(pptx, data, b, colors) {
  // TODO: Build investment_analysis deck
}

async function buildRentalMarketDeck(pptx, data, b, colors) {
  // TODO: Build rental_analysis deck
}

// ─── Slide Helper Functions ───────────────────────────────────────────────────

function addSlideHeader(pptx, slide, title, pri, acc, b, margin) {
  // Top bar
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 11, h: 0.08,
    fill: { color: pri }, line: { color: pri },
  });

  // Breadcrumb
  slide.addText(`${b.org_name || ''}  /  ${title}`.toUpperCase(), {
    x: 0.3, y: 0.12, w: 10.4, h: 0.25,
    fontSize: 7.5, color: acc, fontFace: 'Calibri', charSpacing: 1.5,
  });

  // Slide title
  slide.addText(title, {
    x: 0.3, y: 0.42, w: 10.4, h: 0.6,
    fontSize: 18, bold: true, color: pri, fontFace: 'Georgia',
  });
}

function addSlideFooter(pptx, slide, b, margin) {
  // Footer bar
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 8.25, w: 11, h: 0.25,
    fill: { color: 'CCCCCC' }, line: { color: 'CCCCCC' },
  });
  const footerLeft = [b.org_name, b.org_phone].filter(Boolean).join('  |  ');
  if (footerLeft) {
    slide.addText(footerLeft, {
      x: 0.2, y: 8.27, w: 8, h: 0.2,
      fontSize: 8, color: '333333', fontFace: 'Calibri',
    });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ASSESSMENT_LABELS = {
  listing_pricing: 'Listing Pricing Analysis',
  buyer_intelligence: 'Buyer Intelligence Report',
  investment_analysis: 'Investment Analysis',
  cma: 'Comparative Market Analysis',
  rental_analysis: 'Rental Analysis',
};

/** Strip '#' and ensure 6-char hex, defaulting to neutral gray */
function hex(color) {
  return (color || '#333333').replace('#', '');
}

/** Extract a short subtitle from the first non-empty line of a body block */
function getSubtitle(body) {
  if (!body) return null;
  const firstLine = body.split('\n').find(l => l.trim() && !l.startsWith('#'));
  if (!firstLine) return null;
  const clean = firstLine.replace(/\*\*/g, '').replace(/\*/g, '').trim();
  return clean.length <= 100 ? clean : null;
}

/** Chunk text into segments of ~maxChars, splitting at newlines */
function chunkContent(text, maxChars) {
  const cleaned = text.replace(/\*\*/g, '').replace(/\*/g, '').trim();
  if (cleaned.length <= maxChars) return cleaned ? [cleaned] : [''];

  const chunks = [];
  let remaining = cleaned;
  while (remaining.length > maxChars) {
    let splitAt = remaining.lastIndexOf('\n', maxChars);
    if (splitAt < maxChars * 0.5) splitAt = maxChars;
    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks.length ? chunks : [''];
}

/**
 * Parse output_text into sections split on H1/H2 markdown headings.
 * Returns [{ title, body }]
 */
function parseAnalysisSections(text) {
  const lines = text.split('\n');
  const sections = [];
  let current = null;

  for (const line of lines) {
    const h = line.match(/^#{1,2}\s+(.+)/);
    if (h) {
      if (current) sections.push(current);
      current = { title: h[1].trim(), body: '' };
    } else if (current) {
      current.body += line + '\n';
    } else if (line.trim()) {
      current = { title: 'Overview', body: line + '\n' };
    }
  }
  if (current) sections.push(current);
  return sections.length ? sections : [{ title: 'Analysis', body: text }];
}

/** Inline branding resolver fallback (when called standalone) */
async function resolveBranding(base44, analysisId) {
  const res = await base44.functions.invoke('resolveBranding', { analysisId });
  return res?.data?.branding;
}