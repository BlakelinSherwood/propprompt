import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

async function searchPerplexityForPhotos(address, perpKey) {
  const prompt = `Search online for listing photos of this property: "${address}"

Focus on Zillow, Redfin, Realtor.com, Compass, MLS sites, and any other publicly available real estate listings.

TASK:
1. Search for the most recent listing (current or recently sold)
2. Find up to 6 publicly accessible IMAGE URLs from the listing (interior and exterior photos)
3. Return ONLY the direct image URLs that work (no redirects, no download pages)

Return ONLY valid JSON with no preamble:
{"photo_urls": ["url1", "url2", ...], "source": "Zillow" or "Redfin" or "Realtor.com", "listing_date": "2024-xx-xx"}

If no photos found, return:
{"photo_urls": [], "source": "none", "notes": "no listing found"}`;

  try {
    const res = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perpKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [{ role: 'user', content: prompt }],
        search_context_size: 'high',
        return_images: false,
        return_related_questions: false
      })
    });

    if (!res.ok) {
      console.warn('[fetchListingPhotos] Perplexity error:', res.status);
      return null;
    }

    const data = await res.json();
    let text = (data.choices?.[0]?.message?.content || '').trim();
    console.log('[fetchListingPhotos] Perplexity response:', text.slice(0, 300));

    // Extract JSON from response
    let clean = text;
    if (clean.startsWith('```')) {
      clean = clean.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    }
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) clean = match[0];

    try {
      const result = JSON.parse(clean);
      return result;
    } catch (e) {
      console.warn('[fetchListingPhotos] JSON parse failed:', e.message);
      return null;
    }
  } catch (err) {
    console.warn('[fetchListingPhotos] Perplexity request failed:', err.message);
    return null;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { address } = await req.json();
    if (!address) return Response.json({ error: 'address required' }, { status: 400 });

    // Get Perplexity key
    let perpKey = Deno.env.get('PERPLEXITY_API_KEY') || null;
    if (!perpKey) {
      try {
        const configs = await base44.asServiceRole.entities.PlatformConfig.filter({});
        perpKey = configs[0]?.perplexity_api_key || null;
      } catch (e) {}
    }

    if (!perpKey) {
      return Response.json({ photo_urls: [], error: 'Perplexity API key not configured' }, { status: 402 });
    }

    const result = await searchPerplexityForPhotos(address, perpKey);
    
    if (!result || !result.photo_urls) {
      return Response.json({ photo_urls: [], source: 'none' });
    }

    // Validate URLs (basic check)
    const validUrls = (result.photo_urls || [])
      .filter(url => typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://')))
      .slice(0, 6);

    return Response.json({
      photo_urls: validUrls,
      source: result.source || 'unknown',
      listing_date: result.listing_date || null
    });

  } catch (error) {
    console.error('[fetchListingPhotos] error:', error.message);
    return Response.json({ error: error.message, photo_urls: [] }, { status: 500 });
  }
});