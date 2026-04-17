/**
 * fetchCompsFromBatchData — Now Perplexity-primary.
 * BatchData search is 403 / no sold data on current plan.
 * This function uses Perplexity sonar-pro to research comparable sales directly.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { address, bedrooms, bathrooms, sqft, propertyType } = await req.json();
    if (!address) return Response.json({ error: 'address required' }, { status: 400 });

    // Get Perplexity API key from PlatformConfig
    const configs = await base44.asServiceRole.entities.PlatformConfig.filter({});
    const config = configs[0];
    const perpKey = config?.perplexity_api_key || Deno.env.get('PERPLEXITY_API_KEY');
    if (!perpKey) {
      return Response.json({ success: false, message: 'Perplexity API key not configured' }, { status: 402 });
    }

    const isLargeProperty = sqft && sqft >= 4000;
    const propertyDesc = (propertyType || 'single_family').replace(/_/g, ' ');
    const bedroomRange = bedrooms ? `${Math.max(1, bedrooms - 1)}-${bedrooms + 1} bedrooms` : 'any bedrooms';
    const sqftRange = sqft ? `${Math.round(sqft * 0.70).toLocaleString()}-${Math.round(sqft * 1.30).toLocaleString()} sq ft` : 'any size';

    const systemPrompt = `You are a licensed real estate researcher specializing in New England comparable sales analysis. 
Search the web for recent sold properties near the given address. 
Return ONLY valid JSON — no preamble, no markdown, no explanation.`;

    const userPrompt = `Search for recently SOLD homes near ${address} to use as comparable sales.

Subject property: ${propertyDesc}, ${bedrooms || '?'} bed, ${bathrooms || '?'} bath, ${sqft ? sqft.toLocaleString() + ' sqft' : 'unknown sqft'}

Please search these sources for recently sold listings:
1. Search Zillow for "sold homes near ${address}" — look at their sold listings tab
2. Search Redfin for sold homes in the same neighborhood/zip
3. Search Realtor.com sold listings
4. Search "site:zillow.com sold ${(address.split(',')[1] || '').trim()} ${sqft ? Math.round(sqft * 0.8) + '-' + Math.round(sqft * 1.2) : ''}"

Criteria:
- Sold within last 24 months (2024–2025)
- ${bedroomRange}
- Approximately ${sqftRange}
- Same town preferred; adjacent towns OK for context

Return ONLY valid JSON (no markdown fences, no explanation):
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

Critical rules:
- ONLY include properties with confirmed SOLD prices found in your search — never invent or estimate data
- sale_price = final SOLD price (not list price)
- sale_date in YYYY-MM-DD format
- price_per_sqft = Math.round(sale_price / sqft)
- If you find fewer than 4 comps, explain briefly in researcher_note
- It is better to return 3-4 real comps than 10 invented ones`;

    console.log('[fetchCompsFromBatchData] Using Perplexity for:', address);

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

    if (!res.ok) {
      const errText = await res.text();
      console.error('[fetchCompsFromBatchData] Perplexity error:', res.status, errText.slice(0, 200));
      return Response.json({ success: false, message: `Perplexity API error ${res.status}` }, { status: 500 });
    }

    const data = await res.json();
    let rawText = (data.choices?.[0]?.message?.content || '').trim();
    console.log('[fetchCompsFromBatchData] raw response (first 500):', rawText.slice(0, 500));

    // Strip markdown fences
    if (rawText.startsWith('```')) {
      rawText = rawText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    }
    // Extract first JSON object
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[fetchCompsFromBatchData] No JSON found in response');
      return Response.json({ success: true, comps: [], researcher_note: 'AI search did not return structured data. Add comps manually.', search_tier: 'perplexity', search_radius: null, large_property_flag: isLargeProperty });
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error('[fetchCompsFromBatchData] JSON parse error:', e.message);
      return Response.json({ success: true, comps: [], researcher_note: 'Could not parse AI search results. Add comps manually.', search_tier: 'perplexity', search_radius: null, large_property_flag: isLargeProperty });
    }

    const rawComps = parsed.comps || [];
    console.log('[fetchCompsFromBatchData] Parsed', rawComps.length, 'comps from Perplexity');

    // Normalize and validate comps — require real street address
    const comps = rawComps
      .filter(c => c.address && c.sale_price && c.sale_date &&
        !c.address.toLowerCase().includes('unknown') &&
        /\d/.test(c.address) // must have a street number
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
        days_on_market: c.days_on_market ? Number(c.days_on_market) : null,
        source: 'perplexity_deep_search',
        search_tier: 'perplexity',
        search_radius: null,
        perplexity_confirmed: true,
        perplexity_variance: null,
        agent_excluded: false,
        agent_notes: '',
      }));

    return Response.json({
      success: true,
      comps,
      search_tier: 'perplexity',
      search_radius: null,
      large_property_flag: isLargeProperty,
      researcher_note: parsed.researcher_note || null,
    });

  } catch (error) {
    console.error('[fetchCompsFromBatchData] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});