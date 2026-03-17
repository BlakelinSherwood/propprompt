import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Normalize address for deduplication
function normalizeAddress(address, state) {
  return address
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim() + `, ${state}`;
}

// Search strategy by state
async function searchRecordsByState(address, state, base44) {
  const normalized = normalizeAddress(address, state);
  
  // Check cache first (30-day TTL)
  const cached = await base44.entities.PropertyPublicRecord.filter({
    property_address_normalized: normalized
  });
  
  if (cached.length > 0) {
    const record = cached[0];
    const daysSinceSearch = (new Date() - new Date(record.searched_at)) / (1000 * 60 * 60 * 24);
    if (daysSinceSearch < 30 && (record.search_status === 'found' || record.search_status === 'partial')) {
      return { ...record, from_cache: true };
    }
  }

  // Dispatch to state-specific search
  let results = {};
  switch (state) {
    case 'MA':
      results = await searchMassachusetts(address);
      break;
    case 'ME':
      results = await searchMaine(address);
      break;
    case 'NH':
      results = await searchNewHampshire(address);
      break;
    case 'VT':
      results = await searchVermont(address);
      break;
    default:
      return { search_status: 'error', search_notes: 'State not supported' };
  }

  // Create/update record
  const recordData = {
    property_address: address,
    property_address_normalized: normalized,
    state_code: state,
    searched_at: new Date().toISOString(),
    ...results
  };

  if (cached.length > 0) {
    await base44.entities.PropertyPublicRecord.update(cached[0].id, recordData);
    return base44.entities.PropertyPublicRecord.get(cached[0].id);
  } else {
    return await base44.entities.PropertyPublicRecord.create(recordData);
  }
}

async function searchMassachusetts(address) {
  // Use AI to search masslandrecords.com and assessor databases
  const prompt = `Search Massachusetts land records for property: "${address}"
  1. Try https://www.masslandrecords.com - search by address
  2. Find deed history (last sale date, price, deed book/page)
  3. Find mortgage recordings (amount, date, lender)
  4. Check for mortgage discharge
  5. Search "[municipality] MA assessor property search ${address}" for assessed value and annual tax
  
  Return structured JSON with: last_sale_date, last_sale_price, original_mortgage_amount, original_mortgage_date, 
  original_mortgage_lender, most_recent_mortgage_amount, most_recent_mortgage_date, assessed_value, annual_property_tax, 
  search_status (found/partial/not_found), source_urls, search_notes`;
  
  return await invokeAISearch(prompt);
}

async function searchMaine(address) {
  // Extract county, search county registry portal
  const prompt = `Search Maine Registry of Deeds for property: "${address}"
  1. Determine county from address
  2. Search "[county]countyme.com" or Maine Registry portal
  3. Find deed/transfer records (ownership, last sale)
  4. Find mortgage recordings
  5. Check for discharges
  6. Search "[municipality] ME online assessing" for assessed value
  
  Return structured JSON with deed, mortgage, tax assessment data, search_status, source_urls, search_notes`;
  
  return await invokeAISearch(prompt);
}

async function searchNewHampshire(address) {
  const prompt = `Search New Hampshire property records for: "${address}"
  1. Search https://www.nhdeeds.com (centralized index)
  2. Find deed history and ownership
  3. Find mortgage recordings
  4. Check discharge status
  5. Search "[municipality] NH kiosk assessing ${address}" for value/tax
  
  Return structured JSON with property data, search_status, source_urls, search_notes`;
  
  return await invokeAISearch(prompt);
}

async function searchVermont(address) {
  const prompt = `Search Vermont property records for: "${address}"
  CRITICAL: Vermont uses TOWN-BASED records, not county.
  1. Search https://www.vtlandrecords.com
  2. Determine correct town/municipality
  3. Find deed/transfer records by grantor/grantee
  4. Find mortgage recordings
  5. Search "[town] VT listers property record ${address}" (note: "listers" not assessors)
  
  Return structured JSON with deed, mortgage, lister assessment data, search_status, source_urls, search_notes`;
  
  return await invokeAISearch(prompt);
}

async function invokeAISearch(prompt) {
  // Use InvokeLLM integration for web search
  const base44 = createClientFromRequest({});
  
  try {
    const response = await base44.integrations.Core.InvokeLLM({
      prompt: prompt,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          owner_of_record: { type: "string" },
          last_sale_date: { type: "string", format: "date" },
          last_sale_price: { type: "number" },
          deed_book_page: { type: "string" },
          original_mortgage_amount: { type: "number" },
          original_mortgage_date: { type: "string", format: "date" },
          original_mortgage_lender: { type: "string" },
          original_mortgage_term_years: { type: "integer" },
          most_recent_mortgage_amount: { type: "number" },
          most_recent_mortgage_date: { type: "string", format: "date" },
          most_recent_mortgage_lender: { type: "string" },
          mortgage_discharged: { type: "boolean" },
          assessed_value: { type: "number" },
          assessed_year: { type: "integer" },
          annual_property_tax: { type: "number" },
          liens_found: { type: "boolean" },
          lien_details: { type: "string" },
          search_status: { type: "string", enum: ["found", "partial", "not_found", "error"] },
          source_urls: { type: "array", items: { type: "string" } },
          search_notes: { type: "string" }
        }
      }
    });
    
    return response;
  } catch (error) {
    console.error('[searchPublicRecords] AI search error:', error);
    return {
      search_status: 'error',
      search_notes: `Search failed: ${error.message}`
    };
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { address, state, force_refresh } = await req.json();
    
    if (!address || !state) {
      return Response.json({ error: 'address and state required' }, { status: 400 });
    }

    // If force_refresh, skip cache
    if (force_refresh) {
      const results = await searchRecordsByState(address, state, base44);
      return Response.json({ record: results, from_cache: false });
    }

    const record = await searchRecordsByState(address, state, base44);
    return Response.json({ record, from_cache: record.from_cache || false });
  } catch (error) {
    console.error('[searchPublicRecords] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});