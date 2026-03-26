/**
 * fetchCompsFromBatchData
 * Looks up recent comparable sales for a given address using the BatchData API.
 * The API key is read at runtime from PlatformConfig — never hardcoded.
 * Supports checkOnly=true to confirm key presence without making an external call.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { address, checkOnly = false, radius_miles = 0.5, months_back = 12, max_results = 15 } = body;

    // Read API key from PlatformConfig (service role — key never sent to browser)
    const configs = await base44.asServiceRole.entities.PlatformConfig.list();
    const config = configs[0];
    const apiKey = config?.batchdata_api_key;

    // Missing key — return actionable error
    if (!apiKey || apiKey.trim() === '') {
      return Response.json({
        success: false,
        error: 'batchdata_key_missing',
        message: 'BatchData API key is not configured. Go to Admin → AI Models & Settings → API Keys to add your key.',
      });
    }

    // checkOnly=true — just confirm the key is present, no external call
    if (checkOnly) {
      return Response.json({ success: true, configured: true });
    }

    if (!address) {
      return Response.json({ success: false, error: 'address_required', message: 'address is required' }, { status: 400 });
    }

    console.log(`[fetchCompsFromBatchData] Fetching comps for: ${address}`);

    // Call BatchData API — comparable sales endpoint
    const params = new URLSearchParams({
      address,
      radius: String(radius_miles),
      months: String(months_back),
      limit: String(max_results),
    });

    const res = await fetch(`https://api.batchdata.com/api/v1/property/comps?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error(`[fetchCompsFromBatchData] BatchData API error ${res.status}:`, errText.slice(0, 500));
      return Response.json({
        success: false,
        error: 'batchdata_api_error',
        message: `BatchData API returned ${res.status}. Check your API key and account status.`,
      });
    }

    const data = await res.json();

    // Normalize response into the comp shape the wizard expects
    const rawComps = data?.results || data?.comps || data?.data || [];
    const comps = rawComps.map(c => ({
      address: c.address?.full || c.full_address || c.address || '',
      sale_price: c.last_sale_price || c.sale_price || null,
      sale_date: c.last_sale_date || c.sale_date || '',
      sqft: c.building_sqft || c.sqft || c.square_feet || null,
      bedrooms: c.bedrooms || c.beds || null,
      bathrooms: c.bathrooms || c.baths || null,
      condition: 'Similar',
      agent_notes: '',
    })).filter(c => c.address);

    console.log(`[fetchCompsFromBatchData] Returned ${comps.length} comps for ${address}`);

    return Response.json({ success: true, comps, total: comps.length });

  } catch (error) {
    console.error('[fetchCompsFromBatchData] error:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});