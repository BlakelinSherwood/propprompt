/**
 * pptxHelpers.js — Shared PPTX utility functions for PropPrompt branded reports.
 *
 * IMPORTANT: Deno backend functions cannot import from local files.
 * These functions must be copy-pasted (inlined) into each PPTX-generating
 * backend function that needs them. This file is the canonical source of truth.
 * When you update a function here, update it in all consumers too.
 *
 * Consumers: functions/generatePptx, functions/generateDocuments
 *
 * CRITICAL: Every color value comes from the resolved brand object.
 * NEVER hardcode hex colors. Always use brand.primary_color / brand.accent_color.
 */

// ─────────────────────────────────────────────────────────────
// FUNCTION 1: lightenHex(hex, percent)
// Takes a hex color and lightens it by a percentage.
// Used to generate the watermark number color from brand primary.
// ─────────────────────────────────────────────────────────────
function lightenHex(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, (num >> 16) + Math.round(((num >> 16) * percent) / 100));
  const g = Math.min(255, ((num >> 8) & 0x00FF) + Math.round((((num >> 8) & 0x00FF) * percent) / 100));
  const b = Math.min(255, (num & 0x0000FF) + Math.round(((num & 0x0000FF) * percent) / 100));
  return ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

// ─────────────────────────────────────────────────────────────
// FUNCTION 2: addFooterBar(slide, pptx, brand)
// Adds a branded footer bar to the bottom of any slide.
// Used on EVERY slide except the cover page.
// brand must have: primary_color, accent_color, org_name, email, website
// Optional: team_name, logo_url
// ─────────────────────────────────────────────────────────────
function addFooterBar(slide, pptx, brand) {
  const PRIMARY = brand.primary_color.replace('#', '');
  const ACCENT = brand.accent_color.replace('#', '');

  // Thin accent line at top of footer area
  slide.addShape(pptx.shapes.RECTANGLE, {
    x: 0, y: 5.25, w: 10, h: 0.015, fill: { color: ACCENT }
  });

  // Footer background bar (primary color)
  slide.addShape(pptx.shapes.RECTANGLE, {
    x: 0, y: 5.27, w: 10, h: 0.23, fill: { color: PRIMARY }
  });

  // Footer text (left side — team name, email, website)
  const footerText = brand.team_name
    ? brand.team_name + ' · ' + (brand.email || '') + ' · ' + (brand.website || '')
    : (brand.org_name || '') + ' · ' + (brand.email || '') + ' · ' + (brand.website || '');
  slide.addText(footerText, {
    x: 0.3, y: 5.27, w: 7, h: 0.23,
    fontSize: 7, fontFace: 'Arial', color: 'FFFFFF',
    align: 'left', valign: 'middle'
  });

  // Small logo on right side of footer
  if (brand.logo_url) {
    slide.addImage({
      path: brand.logo_url,
      x: 9.0, y: 5.27, w: 0.6, h: 0.22,
      sizing: { type: 'contain' }
    });
  }
}

// ─────────────────────────────────────────────────────────────
// FUNCTION 3: addContentSlideHeader(slide, sectionLabel, pageTitle, brand)
// Adds the section label + page title header to content slides.
// brand must have: primary_color, accent_color
// ─────────────────────────────────────────────────────────────
function addContentSlideHeader(slide, sectionLabel, pageTitle, brand) {
  const ACCENT = brand.accent_color.replace('#', '');
  const PRIMARY = brand.primary_color.replace('#', '');

  // Section label — small caps, accent color
  slide.addText(sectionLabel, {
    x: 0.5, y: 0.25, w: 5, h: 0.2,
    fontSize: 8, fontFace: 'Arial', color: ACCENT,
    bold: true, charSpacing: 1.5
  });

  // Page title — primary color, bold Georgia
  slide.addText(pageTitle, {
    x: 0.5, y: 0.45, w: 8, h: 0.45,
    fontSize: 22, fontFace: 'Georgia', color: PRIMARY, bold: true
  });
}

// ─────────────────────────────────────────────────────────────
// FUNCTION 4: addSectionDivider(pptx, sectionNumber, title, subtitle, brand)
// Creates a full-slide section divider.
// DESIGN: primary background, oversized watermark number, vertical
// accent bar, white title, accent subtitle, logo top-left, footer bar.
// brand must have: primary_color, accent_color
// Optional: logo_url
// ─────────────────────────────────────────────────────────────
function addSectionDivider(pptx, sectionNumber, title, subtitle, brand) {
  const PRIMARY = brand.primary_color.replace('#', '');
  const ACCENT = brand.accent_color.replace('#', '');
  const WATERMARK = lightenHex(brand.primary_color, 15);

  const slide = pptx.addSlide();
  slide.background = { color: PRIMARY };

  // Accent line below logo area
  slide.addShape(pptx.shapes.RECTANGLE, {
    x: 0.5, y: 0.95, w: 5.5, h: 0.025, fill: { color: ACCENT }
  });

  // Large watermark number — bleeds off left edge
  slide.addText(sectionNumber.toString().padStart(2, '0'), {
    x: -0.3, y: 1.2, w: 4.5, h: 4.0,
    fontSize: 220, fontFace: 'Georgia', color: WATERMARK,
    bold: true, align: 'left', valign: 'bottom'
  });

  // Vertical accent bar — left of title
  slide.addShape(pptx.shapes.RECTANGLE, {
    x: 0.88, y: 1.65, w: 0.035, h: 2.0, fill: { color: ACCENT }
  });

  // Title (white, bold, Georgia — on top of watermark)
  slide.addText(title, {
    x: 1.05, y: 1.65, w: 8.0, h: 1.5,
    fontSize: 42, fontFace: 'Georgia', color: 'FFFFFF',
    bold: true, align: 'left', valign: 'top', lineSpacing: 48
  });

  // Subtitle (accent color)
  slide.addText(subtitle, {
    x: 1.05, y: 3.15, w: 8.0, h: 0.45,
    fontSize: 13, fontFace: 'Arial', color: ACCENT,
    align: 'left', valign: 'top'
  });

  // Logo (top-left corner)
  if (brand.logo_url) {
    slide.addImage({
      path: brand.logo_url,
      x: 0.35, y: 0.12, w: 0.7, h: 0.7,
      sizing: { type: 'contain' }
    });
  }

  // Footer bar
  addFooterBar(slide, pptx, brand);

  return slide;
}

// ─────────────────────────────────────────────────────────────
// This file is documentation only — not a callable Deno endpoint.
// Inline the 4 functions above into any backend function that needs them.
// ─────────────────────────────────────────────────────────────
Deno.serve(() => Response.json({
  status: 'ok',
  message: 'pptxHelpers — inline these functions into your PPTX backend functions',
  functions: ['lightenHex', 'addFooterBar', 'addContentSlideHeader', 'addSectionDivider']
}));