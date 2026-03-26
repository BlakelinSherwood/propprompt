/**
 * fetchCompsFromBatchData
 * Tiered waterfall search for comparable sales via BatchData API.
 * Falls back to Perplexity sonar-pro deep search if standard tiers exhausted.
 * API key read from PlatformConfig at runtime — never hardcoded.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Map app property_type to BatchData propertyType codes
function toBatchDataType(propertyType) {
  const map = { single_family: 'SFR', condo: 'CONDO', multi_family: 'MF2TO4', land: 'LAND' };
  return map[propertyType] || 'SFR';
}

// Parse address string into parts: { street, city, state, zip }
function parseAddress(address) {
  // Expects: "123 Main St, Revere, MA 02151" or "123 Main St, Revere MA 02151"
  const zipMatch = address.match(/\b(\d{5}(?:-\d{4})?)\s*$/);
  const zip = zipMatch ? zipMatch[1] : '';
  const withoutZip = address.replace(zip, '').trim().replace(/,?\s*$/, '');
  const parts = withoutZip.split(',').map(p => p.trim());
  if (parts.length >= 3) {
    return { street: parts[0], city: parts[1], state: parts[2].replace(/\s+\d+.*/, '').trim(), zip };
  }
  if (parts.length === 2) {
    // "123 Main St, Revere MA"
    const cityState = parts[1].match(/^(.*?)\s+([A-Z]{2})$/);
    if (cityState) return { street: parts[0], city: cityState[1].trim(), state: cityState[2], zip };
    return { street: parts[0], city: parts[1], state: 'MA', zip };
  }
  return { street: address, city: '', state: 'MA', zip };
}

function normComp(c, tier, radius, isLarge) {
  const sp = c.last_sale_price || c.sale_price || c.salePrice || null;
  const sqft = c.building_sqft || c.sqft || c.square_feet || c.livingSquareFeet || null;
  const ppsf = (sp && sqft && sqft > 0) ? Math.round(sp / sqft) : null;
  const addr = (typeof c.address === 'object')
    ? [c.address.street, c.address.city, c.address.state, c.address.zip].filter(Boolean).join(', ')
    : (c.full_address || c.address || '');
  return {
    address: addr,
    sale_price: sp,
    sale_date: c.last_sale_date || c.sale_date || c.saleDate || '',
    sqft,
    bedrooms: isLarge ? null : (c.bedrooms || c.beds || null),
    bathrooms: isLarge ? null : (c.bathrooms || c.baths || null),
    price_per_sqft: ppsf,
    source: 'batchdata',
    search_tier: String(tier),
    search_radius: radius,
    perplexity_confirmed: false,
    perplexity_variance: null,
    agent_excluded: false,
    agent_notes: '',
    condition_vs_subject: 'similar',
  };
}

function dedupe(comps) {
  const seen = new Set();
  return comps.filter(c => {
    const key = c.address.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function callBatchData(apiKey, addrParts, criteria) {
  const body = {
    requests: [{
      address: { street: addrParts.street, city: addrParts.city, state: addrParts.state, zip: addrParts.zip },
      criteria,
    }],
  };
  console.log(`[fetchComps] BatchData call: type=${criteria.propertyType} radius=${criteria.radiusMiles} months=${criteria.soldWithinMonths}`);
  const res = await fetch('https://api.batchdata.com/api/v1/property/comps', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error(`[fetchComps] BatchData error ${res.status}:`, errText.slice(0, 300));
    throw new Error(`BatchData API returned ${res.status}. Check your API key and account status.`);
  }
  const data = await res.json();
  // BatchData wraps per-request results
  const results = data?.results?.[0]?.comps || data?.results?.[0]?.comparables
    || data?.results?.[0]?.properties || data?.results || data?.comps || data?.data || [];
  return Array.isArray(results) ? results : [];
}

async function runDeepSearch(perplexityKey, addrParts, intake) {
  const isLarge = (intake.sqft || 0) >= 4000;
  const bedsLine = isLarge ? 'large estate — use sqft only' : String(intake.bedrooms || 'unknown');
  const city = addrParts.city;
  const fullAddress = `${addrParts.street}, ${addrParts.city}, ${addrParts.state} ${addrParts.zip}`.trim();

  const systemPrompt = 'You are an expert real estate comparable sales researcher for a licensed real estate agent. Your job is to find the best available comparable sales for a subject property, even when standard MLS search comes up short. You have access to current web data. Return only valid JSON — no preamble, no markdown.';
  const userPrompt = `Find the best comparable sales for this property:\n\nSubject property:\n  Address:       ${fullAddress}\n  Property type: ${intake.property_type || 'single_family'}\n  Bedrooms:      ${bedsLine}\n  Bathrooms:     ${intake.bathrooms || 'unknown'}\n  Square feet:   ${intake.sqft || 'unknown'}\n  City:          ${city} — comps MUST be in ${city}\n\nStandard database searches returned fewer than 3 results. This property may be large, unusual, or in a low-turnover area.\n\nSearch Compass, Zillow, Redfin, Realtor.com, and any other public real estate sources for comparable sales. Consider:\n  - Expanding to similar neighborhoods or zip codes within the same city if the immediate area has low sales volume\n  - Similar-quality properties even if sqft range is wider\n  - Sales within the last 24 months\n  - For large properties: prioritize lot size and overall sqft over bedroom count\n\nReturn a JSON array of up to 10 comparable sales:\n[\n  {\n    "address": "full street address, city, state zip",\n    "sale_price": 950000,\n    "sale_date": "YYYY-MM-DD",\n    "sqft": 1800,\n    "bedrooms": 4,\n    "bathrooms": 2,\n    "price_per_sqft": 528,\n    "source_url": "https://...",\n    "source_site": "zillow | redfin | compass | realtor_com | other",\n    "relevance_note": "One sentence: why this is a good comp"\n  }\n]\n\nIf you genuinely cannot find 3 comparable sales in ${city} within 24 months for this property type, include the best 1-2 you found and add a field: "researcher_note": "explanation of what was searched and why volume is limited in this market."`;

  const res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${perplexityKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'sonar-pro',
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
    }),
  });
  if (!res.ok) throw new Error(`Perplexity deep search error ${res.status}`);
  const data = await res.json();
  const text = (data.choices?.[0]?.message?.content || '').trim();
  let clean = text;
  if (clean.startsWith('```')) clean = clean.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  // Strip any leading/trailing non-JSON content
  const arrStart = clean.indexOf('[');
  const arrEnd = clean.lastIndexOf(']');
  if (arrStart !== -1 && arrEnd !== -1) clean = clean.slice(arrStart, arrEnd + 1);
  return JSON.parse(clean);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { checkOnly = false, forceRefresh = false } = body;

    // Read API key from PlatformConfig (server-side only)
    const configs = await base44.asServiceRole.entities.PlatformConfig.list();
    const config = configs[0] || {};
    const apiKey = config.batchdata_api_key;

    if (!apiKey || apiKey.trim() === '') {
      return Response.json({
        success: false,
        configured: false,
        error: 'batchdata_key_missing',
        message: 'BatchData API key is not configured. Go to Admin → AI Models & Settings → API Keys to add your key.',
      });
    }

    if (checkOnly) return Response.json({ success: true, configured: true });

    const { address, bedrooms, bathrooms, sqft, property_type } = body;
    if (!address) return Response.json({ success: false, error: 'address_required' }, { status: 400 });

    const addrParts = parseAddress(address);
    const batchType = toBatchDataType(property_type || 'single_family');
    const isLarge = (sqft || 0) >= 4000;
    const beds = Number(bedrooms) || 0;
    const baths = Number(bathrooms) || 0;
    const sqftNum = Number(sqft) || 0;

    console.log(`[fetchComps] address="${address}" beds=${beds} baths=${baths} sqft=${sqftNum} type=${batchType} large=${isLarge}`);

    // Build tier definitions
    const tiers = isLarge
      ? [
          { tier: 1, months: 12, radii: [0.5, 1.0, 2.0], sqftPct: 0.20 },
          { tier: 2, months: 18, radii: [0.5, 1.0, 2.0, 3.0], sqftPct: 0.30 },
          { tier: 3, months: 24, radii: [1.0, 2.0, 3.0, 5.0], sqftPct: 0.40 },
        ]
      : [
          { tier: 1, months: 12, radii: [0.5, 1.0, 2.0], sqftPct: 0.20, bedsPm: 1, bathsPm: 1 },
          { tier: 2, months: 18, radii: [0.5, 1.0, 2.0], sqftPct: 0.30, bedsPm: 1, bathsPm: 1 },
          { tier: 3, months: 18, radii: [0.5, 1.0, 2.0, 3.0], sqftPct: 0.35, bedsPm: 2, bathsPm: null },
          { tier: 4, months: 24, radii: [1.0, 2.0, 3.0], sqftPct: 0.40, bedsPm: 2, bathsPm: null },
        ];

    let candidates = [];
    let finalTier = null;
    let finalRadius = null;
    let apiError = null;

    outerLoop:
    for (const tierDef of tiers) {
      for (const radius of tierDef.radii) {
        const criteria = {
          propertyType: batchType,
          radiusMiles: radius,
          maxResults: 10,
          soldWithinMonths: tierDef.months,
          sqftRange: sqftNum > 0 ? { min: Math.round(sqftNum * (1 - tierDef.sqftPct)), max: Math.round(sqftNum * (1 + tierDef.sqftPct)) } : undefined,
        };
        if (!isLarge) {
          if (tierDef.bedsPm && beds > 0) criteria.bedroomsRange = { min: Math.max(1, beds - tierDef.bedsPm), max: beds + tierDef.bedsPm };
          if (tierDef.bathsPm && baths > 0) criteria.bathroomsRange = { min: Math.max(1, baths - tierDef.bathsPm), max: baths + tierDef.bathsPm };
        }
        // Remove undefined
        Object.keys(criteria).forEach(k => criteria[k] === undefined && delete criteria[k]);

        try {
          const raw = await callBatchData(apiKey, addrParts, criteria);
          const normed = raw.map(c => normComp(c, tierDef.tier, radius, isLarge));
          console.log(`[fetchComps] Tier ${tierDef.tier} radius ${radius}: ${normed.length} results`);

          if (normed.length >= 3) {
            // Stop here
            const merged = dedupe([...candidates, ...normed]);
            finalTier = String(tierDef.tier);
            finalRadius = radius;
            return Response.json({
              success: true,
              comps: merged,
              search_tier: finalTier,
              search_radius: finalRadius,
              large_property_flag: isLarge,
              deep_search_used: false,
              comps_fetched_at: new Date().toISOString(),
            });
          }

          // Accumulate 1-2 partial results
          candidates = dedupe([...candidates, ...normed]);
        } catch (e) {
          console.error(`[fetchComps] Tier ${tierDef.tier} radius ${radius} error:`, e.message);
          apiError = e.message;
        }
      }
    }

    // If accumulated candidates >= 3, use them
    if (candidates.length >= 3) {
      return Response.json({
        success: true,
        comps: candidates,
        search_tier: 'multi_tier',
        search_radius: null,
        large_property_flag: isLarge,
        deep_search_used: false,
        comps_fetched_at: new Date().toISOString(),
      });
    }

    // All standard tiers exhausted — deep search fallback
    console.log(`[fetchComps] Standard tiers exhausted (${candidates.length} candidates). Running deep search.`);
    const perplexityKey = config.perplexity_api_key;
    if (!perplexityKey) {
      // No perplexity key — return what we have
      return Response.json({
        success: true,
        comps: candidates,
        search_tier: 'multi_tier',
        search_radius: null,
        large_property_flag: isLarge,
        deep_search_used: false,
        comps_fetched_at: new Date().toISOString(),
        low_volume: true,
      });
    }

    try {
      const deepComps = await runDeepSearch(perplexityKey, addrParts, { sqft, bedrooms, bathrooms, property_type });
      const researcherNote = deepComps.find(c => c.researcher_note)?.researcher_note || null;

      const normalized = deepComps
        .filter(c => c.address && c.sale_price)
        .map(c => ({
          address: c.address,
          sale_price: c.sale_price,
          sale_date: c.sale_date || '',
          sqft: c.sqft || null,
          bedrooms: isLarge ? null : (c.bedrooms || null),
          bathrooms: isLarge ? null : (c.bathrooms || null),
          price_per_sqft: c.price_per_sqft || (c.sqft ? Math.round(c.sale_price / c.sqft) : null),
          source: 'perplexity_deep_search',
          search_tier: 'agent_deep_search',
          search_radius: null,
          perplexity_confirmed: true,
          perplexity_variance: null,
          listing_url: c.source_url || null,
          relevance_note: c.relevance_note || null,
          agent_excluded: false,
          agent_notes: '',
          condition_vs_subject: 'similar',
        }));

      const merged = dedupe([...candidates, ...normalized]);
      return Response.json({
        success: true,
        comps: merged,
        search_tier: 'agent_deep_search',
        search_radius: null,
        large_property_flag: isLarge,
        deep_search_used: true,
        researcher_note: researcherNote,
        comps_fetched_at: new Date().toISOString(),
      });
    } catch (deepErr) {
      console.error('[fetchComps] Deep search error:', deepErr.message);
      return Response.json({
        success: true,
        comps: candidates,
        search_tier: candidates.length > 0 ? 'multi_tier' : '0',
        search_radius: null,
        large_property_flag: isLarge,
        deep_search_used: false,
        comps_fetched_at: new Date().toISOString(),
        low_volume: true,
      });
    }

  } catch (error) {
    console.error('[fetchCompsFromBatchData] error:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});