/**
 * fetchCompsFromBatchData
 * Tiered waterfall comparable sales search via BatchData POST API.
 * Falls back to Perplexity sonar-pro deep search if < 3 results after all tiers.
 * API key read from PlatformConfig at runtime — never hardcoded.
 * Does NOT save to DB — caller manages persistence.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

function toBatchDataType(propertyType) {
  const map = { single_family: 'SFR', condo: 'CONDO', multi_family: 'MF2TO4', land: 'LAND' };
  return map[propertyType] || 'SFR';
}

function parseAddress(address) {
  const parts = address.split(',').map(s => s.trim());
  const street = parts[0] || '';
  const city = parts[1] || '';
  const stateZip = (parts[2] || '').trim().split(/\s+/);
  const state = stateZip[0] || '';
  const zip = stateZip[1] || '';
  return { street, city, state, zip };
}

function normalizeComp(c, tier, radius) {
  const sale_price = c.last_sale_price || c.salePrice || c.sale_price || null;
  const sqft = c.building_sqft || c.buildingSqFt || c.sqft || c.square_feet || null;
  return {
    address: c.address?.full || c.fullAddress || c.full_address || (typeof c.address === 'string' ? c.address : '') || '',
    sale_price,
    sale_date: c.last_sale_date || c.saleDate || c.sale_date || null,
    sqft,
    bedrooms: c.bedrooms || c.beds || null,
    bathrooms: c.bathrooms || c.baths || null,
    price_per_sqft: (sale_price && sqft) ? Math.round(sale_price / sqft) : null,
    source: 'batchdata',
    search_tier: tier,
    search_radius: radius,
    perplexity_confirmed: false,
    perplexity_variance: null,
    agent_excluded: false,
    agent_notes: '',
  };
}

async function callBatchData(apiKey, parsedAddress, criteria) {
  const body = {
    requests: [{
      address: {
        street: parsedAddress.street,
        city: parsedAddress.city,
        state: parsedAddress.state,
        zip: parsedAddress.zip,
      },
      criteria,
    }],
  };
  const res = await fetch('https://api.batchdata.com/api/v1/property/comps', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`BatchData ${res.status}: ${errText.slice(0, 300)}`);
  }
  return res.json();
}

function extractComps(data) {
  return data?.results?.[0]?.comparables
    || data?.results?.[0]?.comps
    || data?.results
    || data?.comps
    || data?.data
    || [];
}

function dedupe(arr) {
  const seen = new Set();
  return arr.filter(c => {
    const key = (c.address || '').toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { address, bedrooms, bathrooms, sqft, propertyType, checkOnly = false, forceRefresh = false } = body;

    // Read API key from PlatformConfig
    const configs = await base44.asServiceRole.entities.PlatformConfig.list();
    const config = configs[0] || {};
    const apiKey = config.batchdata_api_key;

    if (!apiKey || apiKey.trim() === '') {
      return Response.json({ success: false, configured: false, error: 'batchdata_key_missing', message: 'BatchData API key is not configured. Go to Admin → AI Settings → API Keys to add your key.' });
    }

    if (checkOnly) return Response.json({ success: true, configured: true });

    if (!address) return Response.json({ success: false, error: 'address_required', message: 'address is required' }, { status: 400 });

    const parsed = parseAddress(address);
    const batchDataType = toBatchDataType(propertyType || 'single_family');
    const numBeds = bedrooms ? Number(bedrooms) : null;
    const numBaths = bathrooms ? Number(bathrooms) : null;
    const numSqft = sqft ? Number(sqft) : null;
    const isLargeProperty = numSqft != null && numSqft >= 4000;

    console.log(`[fetchCompsFromBatchData] Starting for: ${address} | type: ${batchDataType} | sqft: ${numSqft} | large: ${isLargeProperty}`);

    // ── TIER WATERFALL ──────────────────────────────────────────────────────
    let allCandidates = [];
    let winningTier = null;
    let winningRadius = null;

    const tiers = isLargeProperty ? [
      { tier: 1, months: 12, sqftPct: 0.20, radii: [0.5, 1.0, 2.0] },
      { tier: 2, months: 18, sqftPct: 0.30, radii: [0.5, 1.0, 2.0, 3.0] },
      { tier: 3, months: 24, sqftPct: 0.40, radii: [1.0, 2.0, 3.0, 5.0] },
    ] : [
      { tier: 1, months: 12, bedRange: 1, bathRange: 1, sqftPct: 0.20, radii: [0.5, 1.0, 2.0] },
      { tier: 2, months: 18, bedRange: 1, bathRange: 1, bathMin: 1, sqftPct: 0.30, radii: [0.5, 1.0, 2.0] },
      { tier: 3, months: 18, bedRange: 2, bathRange: null, sqftPct: 0.35, radii: [0.5, 1.0, 2.0, 3.0] },
      { tier: 4, months: 24, bedRange: 2, bathRange: null, sqftPct: 0.40, radii: [1.0, 2.0, 3.0] },
    ];

    outer: for (const t of tiers) {
      for (const radius of t.radii) {
        const criteria = {
          propertyType: batchDataType,
          radiusMiles: radius,
          maxResults: 10,
          soldWithinMonths: t.months,
        };

        if (numSqft) {
          criteria.sqftRange = { min: Math.round(numSqft * (1 - t.sqftPct)), max: Math.round(numSqft * (1 + t.sqftPct)) };
        }

        if (!isLargeProperty) {
          if (numBeds != null && t.bedRange != null) {
            criteria.bedroomsRange = { min: Math.max(1, numBeds - t.bedRange), max: numBeds + t.bedRange };
          }
          if (numBaths != null && t.bathRange != null) {
            const bathMin = t.bathMin ? Math.max(t.bathMin, numBaths - t.bathRange) : Math.max(1, numBaths - t.bathRange);
            criteria.bathroomsRange = { min: bathMin, max: numBaths + t.bathRange };
          }
        }

        console.log(`[fetchCompsFromBatchData] Tier ${t.tier} @ ${radius}mi | months:${t.months} | criteria:`, JSON.stringify(criteria));

        let data;
        try {
          data = await callBatchData(apiKey, parsed, criteria);
        } catch (err) {
          console.error(`[fetchCompsFromBatchData] Tier ${t.tier} @ ${radius}mi error:`, err.message);
          continue;
        }

        const rawComps = extractComps(data);
        const normalized = rawComps.map(c => normalizeComp(c, t.tier, radius)).filter(c => c.address);
        const existingAddrs = new Set(allCandidates.map(c => c.address.toLowerCase()));
        const newOnes = normalized.filter(c => !existingAddrs.has(c.address.toLowerCase()));
        allCandidates = [...allCandidates, ...newOnes];

        console.log(`[fetchCompsFromBatchData] Tier ${t.tier} @ ${radius}mi: ${normalized.length} new (total: ${allCandidates.length})`);

        if (allCandidates.length >= 3) {
          winningTier = allCandidates.length > normalized.length ? 'multi_tier' : String(t.tier);
          winningRadius = radius;
          break outer;
        }
      }
    }

    // If enough via accumulation
    if (allCandidates.length >= 3 && !winningTier) {
      winningTier = 'multi_tier';
      const lastTier = tiers[tiers.length - 1];
      winningRadius = lastTier.radii[lastTier.radii.length - 1];
    }

    // ── DEEP SEARCH FALLBACK ─────────────────────────────────────────────────
    let researcherNote = null;
    let isDeepSearch = false;

    if (allCandidates.length < 3) {
      console.log(`[fetchCompsFromBatchData] Escalating to deep search. Candidates so far: ${allCandidates.length}`);
      isDeepSearch = true;
      winningTier = 'agent_deep_search';

      const perpKey = config.perplexity_api_key;
      if (perpKey) {
        const bedsLine = isLargeProperty ? 'large estate — use sqft only' : String(numBeds || 'unknown');
        const bathsLine = isLargeProperty ? 'N/A' : String(numBaths || 'unknown');
        const deepPrompt = `Find the best comparable sales for this property:

Subject property:
  Address:       ${address}
  Property type: ${propertyType || 'single_family'}
  Bedrooms:      ${bedsLine}
  Bathrooms:     ${bathsLine}
  Square feet:   ${numSqft || 'unknown'}
  City:          ${parsed.city} — comps MUST be in ${parsed.city}

Standard database searches returned fewer than 3 results. This property may be large, unusual, or in a low-turnover area.

Search Compass, Zillow, Redfin, Realtor.com, and any other public real estate sources for comparable sales. Consider:
  - Expanding to similar neighborhoods or zip codes within the same city if the immediate area has low sales volume
  - Similar-quality properties even if sqft range is wider
  - Sales within the last 24 months
  - For large properties: prioritize lot size and overall sqft over bedroom count

Return a JSON array of up to 10 comparable sales:
[{"address":"full street address, city, state zip","sale_price":950000,"sale_date":"YYYY-MM-DD","sqft":1800,"bedrooms":4,"bathrooms":2,"price_per_sqft":528,"source_url":"https://...","source_site":"zillow","relevance_note":"One sentence why this is a good comp"}]

If you genuinely cannot find 3 comparable sales in ${parsed.city} within 24 months for this property type, include the best 1-2 you found and add a field: "researcher_note": "explanation of what was searched and why volume is limited in this market."`;

        try {
          const deepRes = await fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${perpKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'sonar-pro',
              messages: [
                { role: 'system', content: 'You are an expert real estate comparable sales researcher for a licensed real estate agent. Return only valid JSON — no preamble, no markdown.' },
                { role: 'user', content: deepPrompt },
              ],
            }),
          });

          if (deepRes.ok) {
            const deepData = await deepRes.json();
            let deepText = (deepData.choices?.[0]?.message?.content || '').trim();
            if (deepText.startsWith('```')) deepText = deepText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
            const arr = JSON.parse(deepText);
            const deepComps = Array.isArray(arr) ? arr : (arr.comps || []);

            for (const c of deepComps) {
              if (c.researcher_note) researcherNote = c.researcher_note;
            }

            const normalizedDeep = deepComps.filter(c => c.address).map(c => ({
              address: c.address,
              sale_price: c.sale_price || null,
              sale_date: c.sale_date || null,
              sqft: c.sqft || null,
              bedrooms: isLargeProperty ? null : (c.bedrooms || null),
              bathrooms: isLargeProperty ? null : (c.bathrooms || null),
              price_per_sqft: c.price_per_sqft || (c.sale_price && c.sqft ? Math.round(c.sale_price / c.sqft) : null),
              source: 'perplexity_deep_search',
              search_tier: 'agent_deep_search',
              perplexity_confirmed: true,
              perplexity_variance: null,
              listing_url: c.source_url || null,
              relevance_note: c.relevance_note || null,
              agent_excluded: false,
              agent_notes: '',
            }));

            const existingAddrs = new Set(allCandidates.map(c => c.address.toLowerCase()));
            const merged = [...allCandidates, ...normalizedDeep.filter(c => !existingAddrs.has(c.address.toLowerCase()))];
            allCandidates = dedupe(merged);
          }
        } catch (deepErr) {
          console.error('[fetchCompsFromBatchData] Deep search error:', deepErr.message);
        }
      }
    }

    const finalComps = dedupe(allCandidates);

    return Response.json({
      success: true,
      comps: finalComps,
      search_tier: winningTier,
      search_radius: winningRadius,
      isDeepSearch,
      large_property_flag: isLargeProperty,
      researcher_note: researcherNote,
    });

  } catch (error) {
    console.error('[fetchCompsFromBatchData] error:', error.message);
    return Response.json({ success: false, error: error.message, message: 'Unable to search for comparable sales. You can add comps manually.' }, { status: 500 });
  }
});