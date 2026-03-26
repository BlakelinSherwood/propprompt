/**
 * enrichCompsWithPerplexity
 * Cross-references BatchData comps against Compass, Zillow, Redfin, Realtor.com
 * via Perplexity sonar (not sonar-pro — this is a lookup task).
 * All calls run in parallel via Promise.all.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

async function lookupAddress(perplexityKey, address) {
  const systemPrompt = 'You are a real estate data researcher. Return only structured JSON. No explanation, no preamble, no markdown.';
  const userPrompt = `Find the most recent sale information for this property:\n${address}\n\nSearch Compass, Zillow, Redfin, and Realtor.com for this specific address. Return ONLY this JSON:\n{\n  "address": "${address}",\n  "sources_checked": ["compass", "zillow", "redfin", "realtor_com"],\n  "found_on": [],\n  "sale_price": null,\n  "sale_date": null,\n  "sqft": null,\n  "bedrooms": null,\n  "bathrooms": null,\n  "listing_url": null,\n  "confidence": "high"\n}\n\nRules:\n- Only return data you found by searching. Do not guess or recall.\n- If the property is not found on any site, set confidence: "not_found" and all data fields to null.\n- If found on multiple sites with conflicting prices, use the most recently updated source and set confidence: "medium".\n- confidence must be: "high" | "medium" | "low" | "not_found"`;

  const res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${perplexityKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'sonar',
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
    }),
  });
  if (!res.ok) throw new Error(`Perplexity error ${res.status}`);
  const data = await res.json();
  const text = (data.choices?.[0]?.message?.content || '').trim();
  let clean = text;
  if (clean.startsWith('```')) clean = clean.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  return JSON.parse(clean);
}

function enrichComp(comp, perpResult) {
  if (!perpResult) return comp;

  const confidence = perpResult.confidence;

  if (confidence === 'high' || confidence === 'medium') {
    const bdPrice = comp.sale_price;
    const pxPrice = perpResult.sale_price;
    const variance = (bdPrice && pxPrice && bdPrice > 0)
      ? Math.round(Math.abs(bdPrice - pxPrice) / bdPrice * 100)
      : null;

    const enriched = {
      ...comp,
      perplexity_confirmed: true,
      perplexity_variance: variance,
      listing_url: perpResult.listing_url || comp.listing_url || null,
      found_on: perpResult.found_on || [],
    };

    // Override sqft/beds/baths if Perplexity differs by > 5%
    if (perpResult.sqft && comp.sqft && Math.abs(perpResult.sqft - comp.sqft) / comp.sqft > 0.05) {
      enriched.sqft = perpResult.sqft;
      enriched.sqft_source = 'perplexity_override';
      if (enriched.sale_price && perpResult.sqft > 0) {
        enriched.price_per_sqft = Math.round(enriched.sale_price / perpResult.sqft);
      }
    } else {
      enriched.sqft_source = 'batchdata';
    }
    if (perpResult.bedrooms && comp.bedrooms && Math.abs(perpResult.bedrooms - comp.bedrooms) > 0) {
      enriched.bedrooms = perpResult.bedrooms;
    }
    if (perpResult.bathrooms && comp.bathrooms && Math.abs(perpResult.bathrooms - comp.bathrooms) > 0.5) {
      enriched.bathrooms = perpResult.bathrooms;
    }
    return enriched;
  }

  if (confidence === 'low') {
    return { ...comp, perplexity_confirmed: false, perplexity_variance: null, perplexity_low_confidence: true };
  }

  // not_found
  return { ...comp, perplexity_confirmed: false, perplexity_variance: null, perplexity_not_found: true };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { comps } = await req.json();
    if (!Array.isArray(comps) || comps.length === 0) {
      return Response.json({ success: true, enriched_comps: [], raw_enrichment: [] });
    }

    // Read Perplexity key from PlatformConfig
    const configs = await base44.asServiceRole.entities.PlatformConfig.list();
    const config = configs[0] || {};
    const perplexityKey = config.perplexity_api_key;

    if (!perplexityKey) {
      console.warn('[enrichComps] No Perplexity key — skipping enrichment');
      return Response.json({ success: true, enriched_comps: comps, raw_enrichment: [] });
    }

    // Run all lookups in parallel
    const lookupResults = await Promise.all(
      comps.slice(0, 10).map(async (comp) => {
        try {
          const result = await lookupAddress(perplexityKey, comp.address);
          console.log(`[enrichComps] ${comp.address} → confidence=${result.confidence} found_on=${JSON.stringify(result.found_on)}`);
          return result;
        } catch (e) {
          console.warn(`[enrichComps] lookup failed for ${comp.address}:`, e.message);
          return { address: comp.address, confidence: 'low', sale_price: null };
        }
      })
    );

    const enrichedComps = comps.map((comp, i) => enrichComp(comp, lookupResults[i] || null));

    return Response.json({
      success: true,
      enriched_comps: enrichedComps,
      raw_enrichment: lookupResults,
    });

  } catch (error) {
    console.error('[enrichCompsWithPerplexity] error:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});