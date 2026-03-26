/**
 * enrichCompsWithPerplexity
 * Cross-references BatchData comps against Compass, Zillow, Redfin, Realtor.com
 * via Perplexity sonar. All calls run in parallel.
 * Accepts { comps: array } — does NOT save to DB.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { comps } = await req.json();
    if (!Array.isArray(comps) || comps.length === 0) {
      return Response.json({ success: true, comps: [], rawEnrichment: [] });
    }

    const configs = await base44.asServiceRole.entities.PlatformConfig.list();
    const config = configs[0] || {};
    const apiKey = config.perplexity_api_key;
    if (!apiKey) {
      console.warn('[enrichCompsWithPerplexity] No Perplexity key — returning unenriched comps');
      return Response.json({ success: true, comps, rawEnrichment: [] });
    }

    // Run all Perplexity calls in parallel
    const perpResults = await Promise.all(comps.slice(0, 10).map(async (comp) => {
      const prompt = `Find the most recent sale information for this property:
${comp.address}

Search Compass, Zillow, Redfin, and Realtor.com for this specific address. Return ONLY this JSON object:
{"address":"${comp.address}","sources_checked":["compass","zillow","redfin","realtor_com"],"found_on":[],"sale_price":null,"sale_date":null,"sqft":null,"bedrooms":null,"bathrooms":null,"listing_url":null,"confidence":"high"}

Rules:
- Only return data you found by searching. Do not guess or recall.
- If not found on any site, set confidence: "not_found" and all data fields to null.
- If found on multiple sites with conflicting prices, use the most recently updated source and set confidence: "medium".`;

      try {
        const res = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'sonar',
            messages: [
              { role: 'system', content: 'You are a real estate data researcher. Return only structured JSON. No explanation, no preamble, no markdown.' },
              { role: 'user', content: prompt },
            ],
          }),
        });
        if (!res.ok) throw new Error(`Perplexity ${res.status}`);
        const data = await res.json();
        let text = (data.choices?.[0]?.message?.content || '').trim();
        if (text.startsWith('```')) text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
        return JSON.parse(text);
      } catch (e) {
        console.warn(`[enrichCompsWithPerplexity] Failed for "${comp.address}":`, e.message);
        return { address: comp.address, confidence: 'not_found' };
      }
    }));

    // Build address → result map
    const perpMap = {};
    const rawEnrichment = [];
    for (const r of perpResults) {
      if (r?.address) {
        perpMap[r.address.toLowerCase()] = r;
        rawEnrichment.push(r);
      }
    }

    // Enrich each comp
    const enriched = comps.map(comp => {
      const pResult = perpMap[comp.address.toLowerCase()];
      if (!pResult) return comp;

      const confidence = pResult.confidence;

      if (confidence === 'high' || confidence === 'medium') {
        const batchPrice = comp.sale_price;
        const perpPrice = pResult.sale_price;
        const variance = (batchPrice && perpPrice) ? Math.round(Math.abs(batchPrice - perpPrice) / batchPrice * 100) : null;

        // Override sqft if differs > 5%
        let sqft = comp.sqft;
        let sqft_source = 'batchdata';
        if (pResult.sqft && sqft && Math.abs(pResult.sqft - sqft) / sqft > 0.05) {
          sqft = pResult.sqft;
          sqft_source = 'perplexity_override';
        }

        const finalSqft = sqft;
        const finalPrice = comp.sale_price;

        // Override bedrooms/bathrooms if differs > 5%
        let bedrooms = comp.bedrooms;
        if (pResult.bedrooms && bedrooms && Math.abs(pResult.bedrooms - bedrooms) / bedrooms > 0.05) {
          bedrooms = pResult.bedrooms;
        }
        let bathrooms = comp.bathrooms;
        if (pResult.bathrooms && bathrooms && Math.abs(pResult.bathrooms - bathrooms) / bathrooms > 0.05) {
          bathrooms = pResult.bathrooms;
        }

        return {
          ...comp,
          perplexity_confirmed: true,
          perplexity_variance: variance,
          listing_url: pResult.listing_url || comp.listing_url || null,
          sqft: finalSqft,
          sqft_source,
          bedrooms,
          bathrooms,
          price_per_sqft: (finalPrice && finalSqft) ? Math.round(finalPrice / finalSqft) : comp.price_per_sqft,
          found_on: pResult.found_on || [],
        };
      }

      if (confidence === 'low') {
        return { ...comp, perplexity_confirmed: false, perplexity_variance: null, perplexity_low_confidence: true };
      }

      // not_found
      return { ...comp, perplexity_confirmed: false, perplexity_variance: null, perplexity_not_found: true };
    });

    return Response.json({ success: true, comps: enriched, rawEnrichment });

  } catch (error) {
    console.error('[enrichCompsWithPerplexity] error:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});