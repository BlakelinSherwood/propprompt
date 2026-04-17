/**
 * fetchCompsFromBatchData — RentCast primary, Perplexity fallback.
 * 
 * Pipeline:
 * 1. RentCast /avm/value — returns real sold comps with full detail (primary)
 * 2. If RentCast returns < 3 comps OR fails → Perplexity sonar-pro deep search (fallback)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const RENTCAST_BASE = 'https://api.rentcast.io/v1';

// Map our property_type values to RentCast propertyType values
function mapPropertyType(type) {
  const map = {
    single_family: 'Single Family',
    condo: 'Condo',
    multi_family: 'Multi-Family',
    land: 'Land',
  };
  return map[type] || 'Single Family';
}

async function fetchRentCastComps(apiKey, { address, bedrooms, bathrooms, sqft, propertyType }) {
  const params = new URLSearchParams({
    address,
    propertyType: mapPropertyType(propertyType),
    compCount: '10',
    daysOld: '730', // 2 years of sold data
  });
  if (bedrooms)  params.set('bedrooms',      String(bedrooms));
  if (bathrooms) params.set('bathrooms',     String(bathrooms));
  if (sqft)      params.set('squareFootage', String(sqft));

  const url = `${RENTCAST_BASE}/avm/value?${params.toString()}`;
  console.log('[RentCast] GET', url.replace(apiKey, '***'));

  const res = await fetch(url, {
    headers: {
      'X-Api-Key': apiKey,
      'Accept': 'application/json',
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('[RentCast] Error', res.status, errText.slice(0, 300));
    throw new Error(`RentCast API error ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  console.log('[RentCast] Response keys:', Object.keys(data).join(', '));
  const rawComps = data.comparables || [];
  console.log('[RentCast] comparables count:', rawComps.length);
  if (rawComps.length > 0) console.log('[RentCast] sample comp keys:', Object.keys(rawComps[0]).join(', '));

  // RentCast comparable fields: price, listedDate, squareFootage, bedrooms, bathrooms, formattedAddress, distance, correlation
  const comps = rawComps
    .filter(c => c.price && c.formattedAddress)
    .map(c => {
      const price = Number(c.price);
      const sqftVal = Number(c.squareFootage) || null;
      // RentCast comparables use listedDate — these are sold comps based on sale data
      const saleDate = c.lastSaleDate || c.listedDate || null;
      return {
        address: c.formattedAddress,
        sale_price: price || null,
        sale_date: saleDate ? saleDate.slice(0, 10) : null,
        sqft: sqftVal,
        bedrooms: c.bedrooms ? Number(c.bedrooms) : null,
        bathrooms: c.bathrooms ? Number(c.bathrooms) : null,
        price_per_sqft: (price && sqftVal) ? Math.round(price / sqftVal) : null,
        listing_url: null,
        days_on_market: null,
        distance: c.distance ? Number(c.distance).toFixed(2) : null,
        source: 'rentcast',
        search_tier: 'rentcast',
        search_radius: null,
        perplexity_confirmed: false,
        perplexity_variance: null,
        agent_excluded: false,
        agent_notes: '',
      };
    });

  return { comps, priceEstimate: data.price || null, priceRangeLow: data.priceRangeLow || null, priceRangeHigh: data.priceRangeHigh || null };
}

async function fetchPerplexityComps(perpKey, { address, bedrooms, bathrooms, sqft, propertyType }) {
  const isLargeProperty = sqft && sqft >= 4000;
  const propertyDesc = (propertyType || 'single_family').replace(/_/g, ' ');
  const bedroomRange = bedrooms ? `${Math.max(1, bedrooms - 1)}-${bedrooms + 1} bedrooms` : 'any bedrooms';
  const sqftRange = sqft ? `${Math.round(sqft * 0.70).toLocaleString()}-${Math.round(sqft * 1.30).toLocaleString()} sq ft` : 'any size';

  const systemPrompt = `You are a licensed real estate researcher specializing in New England comparable sales analysis. Search the web for recent sold properties near the given address. Return ONLY valid JSON — no preamble, no markdown, no explanation.`;

  const userPrompt = `Search for recently SOLD homes near ${address} to use as comparable sales.

Subject property: ${propertyDesc}, ${bedrooms || '?'} bed, ${bathrooms || '?'} bath, ${sqft ? sqft.toLocaleString() + ' sqft' : 'unknown sqft'}

Search Zillow, Redfin, Realtor.com, and Compass for sold listings.

Criteria:
- Sold within last 24 months (2024–2026)
- ${bedroomRange}
- Approximately ${sqftRange}
- Same town preferred; adjacent towns OK for context

Return ONLY valid JSON (no markdown fences):
{
  "comps": [
    {
      "address": "123 Example St, Beverly, MA 01915",
      "sale_price": 485000,
      "sale_date": "2025-03-12",
      "sqft": 1650,
      "bedrooms": 3,
      "bathrooms": 2,
      "price_per_sqft": 294,
      "listing_url": "https://www.zillow.com/... or null",
      "source_site": "zillow"
    }
  ],
  "researcher_note": null
}

Critical: ONLY include properties with confirmed SOLD prices. Never invent data. Return fewer real comps rather than invented ones.`;

  const res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${perpKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'sonar-pro',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      search_context_size: 'high',
      return_images: false,
      return_related_questions: false,
    }),
  });

  if (!res.ok) throw new Error(`Perplexity error ${res.status}`);

  const data = await res.json();
  let rawText = (data.choices?.[0]?.message?.content || '').trim();
  if (rawText.startsWith('```')) rawText = rawText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { comps: [], researcher_note: 'Perplexity did not return structured data.' };

  let parsed;
  try { parsed = JSON.parse(jsonMatch[0]); } catch (e) { return { comps: [], researcher_note: 'Could not parse Perplexity results.' }; }

  const rawComps = parsed.comps || [];
  const comps = rawComps
    .filter(c => c.address && c.sale_price && c.sale_date &&
      !c.address.toLowerCase().includes('unknown') &&
      /\d/.test(c.address)
    )
    .map(c => ({
      address: String(c.address),
      sale_price: Number(c.sale_price) || null,
      sale_date: String(c.sale_date),
      sqft: c.sqft ? Number(c.sqft) : null,
      bedrooms: c.bedrooms ? Number(c.bedrooms) : null,
      bathrooms: c.bathrooms ? Number(c.bathrooms) : null,
      price_per_sqft: c.price_per_sqft
        ? Number(c.price_per_sqft)
        : (c.sale_price && c.sqft ? Math.round(Number(c.sale_price) / Number(c.sqft)) : null),
      listing_url: c.listing_url || null,
      days_on_market: null,
      source: 'perplexity_deep_search',
      search_tier: 'perplexity',
      search_radius: null,
      perplexity_confirmed: true,
      perplexity_variance: null,
      agent_excluded: false,
      agent_notes: '',
    }));

  return { comps, researcher_note: parsed.researcher_note || null };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { address, bedrooms, bathrooms, sqft, propertyType } = await req.json();
    if (!address) return Response.json({ error: 'address required' }, { status: 400 });

    const isLargeProperty = sqft && sqft >= 4000;
    const params = { address, bedrooms, bathrooms, sqft, propertyType };

    // ── Step 1: Try RentCast ─────────────────────────────────────────────────
    const rentcastKey = Deno.env.get('RENTCAST_API_KEY');
    let rentcastComps = [];
    let rentcastNote = null;

    if (rentcastKey) {
      try {
        const result = await fetchRentCastComps(rentcastKey, params);
        rentcastComps = result.comps;
        console.log(`[fetchComps] RentCast returned ${rentcastComps.length} comps`);
      } catch (err) {
        console.error('[fetchComps] RentCast failed:', err.message);
        rentcastNote = `RentCast error: ${err.message}`;
      }
    } else {
      console.warn('[fetchComps] No RENTCAST_API_KEY set');
    }

    // If RentCast gave us 3+ comps, return them directly
    if (rentcastComps.length >= 3) {
      return Response.json({
        success: true,
        comps: rentcastComps,
        search_tier: 'rentcast',
        search_radius: null,
        large_property_flag: isLargeProperty,
        researcher_note: null,
        source_used: 'rentcast',
      });
    }

    // ── Step 2: Perplexity fallback if RentCast returned < 3 comps ──────────
    console.log(`[fetchComps] RentCast only found ${rentcastComps.length} comps — trying Perplexity fallback`);

    let perpKey = null;
    try {
      const configs = await base44.asServiceRole.entities.PlatformConfig.filter({});
      perpKey = configs[0]?.perplexity_api_key || null;
    } catch (e) {}
    if (!perpKey) perpKey = Deno.env.get('PERPLEXITY_API_KEY');

    let perpComps = [];
    let perpNote = null;

    if (perpKey) {
      try {
        const result = await fetchPerplexityComps(perpKey, params);
        perpComps = result.comps;
        perpNote = result.researcher_note;
        console.log(`[fetchComps] Perplexity fallback returned ${perpComps.length} comps`);
      } catch (err) {
        console.error('[fetchComps] Perplexity fallback failed:', err.message);
        perpNote = 'Automated search could not find comparable sales for this address. Add comps manually below.';
      }
    }

    // Merge: RentCast comps first, then unique Perplexity comps (avoid duplicates by address)
    const rentcastAddresses = new Set(rentcastComps.map(c => c.address.toLowerCase()));
    const uniquePerpComps = perpComps.filter(c => !rentcastAddresses.has(c.address.toLowerCase()));
    const mergedComps = [...rentcastComps, ...uniquePerpComps];

    const finalNote = mergedComps.length === 0
      ? 'No comparable sales found automatically. Add comps manually using your MLS or public records.'
      : (perpNote || (rentcastComps.length > 0 ? `RentCast found ${rentcastComps.length} comp(s); Perplexity supplemented with ${uniquePerpComps.length} additional.` : null));

    return Response.json({
      success: true,
      comps: mergedComps,
      search_tier: mergedComps.length > 0 ? 'rentcast+perplexity' : 'none',
      search_radius: null,
      large_property_flag: isLargeProperty,
      researcher_note: finalNote,
      source_used: rentcastComps.length > 0 ? 'rentcast+perplexity' : 'perplexity',
    });

  } catch (error) {
    console.error('[fetchCompsFromBatchData] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});