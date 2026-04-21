import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Normalize address for deduplication
function normalizeAddress(address, state) {
  return address
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim() + `, ${state}`;
}

// Search strategy by state
async function searchRecordsByState(address, state, base44, forceRefresh = false) {
  const normalized = normalizeAddress(address, state);

  // Always check for existing record (needed for update vs create decision)
  const existing = await base44.entities.PropertyPublicRecord.filter({
    property_address_normalized: normalized
  });

  if (!forceRefresh && existing.length > 0) {
    const record = existing[0];
    const daysSinceSearch = (new Date() - new Date(record.searched_at)) / (1000 * 60 * 60 * 24);
    if (daysSinceSearch < 30 && (record.search_status === 'found' || record.search_status === 'partial')) {
      return { ...record, from_cache: true };
    }
  }

  // Dispatch to state-specific search
  let results = {};
  switch (state) {
    case 'MA':
      results = await searchMassachusetts(address, base44);
      break;
    case 'ME':
      results = await searchMaine(address, base44);
      break;
    case 'NH':
      results = await searchNewHampshire(address, base44);
      break;
    case 'VT':
      results = await searchVermont(address, base44);
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

  if (existing.length > 0) {
    await base44.entities.PropertyPublicRecord.update(existing[0].id, recordData);
    return await base44.entities.PropertyPublicRecord.filter({ id: existing[0].id }).then(r => r[0]);
  } else {
    return await base44.entities.PropertyPublicRecord.create(recordData);
  }
}

async function searchMassachusetts(address, base44) {
  // Use AI to search masslandrecords.com and assessor databases
  const prompt = `Search Massachusetts land records and assessor database for property: "${address}"
  1. Try https://www.masslandrecords.com - search by address
  2. Find deed history (last sale date, price, deed book/page)
  3. Find mortgage recordings (amount, date, lender)
  4. Check for mortgage discharge
  5. Search "[municipality] MA assessor property search ${address}" for assessed value, annual tax, bedrooms, bathrooms, square footage, year built, lot size, and property style (Colonial, Cape, Ranch, etc.)

  Return structured JSON with all property attributes including bedrooms, bathrooms, sqft, year_built, lot_size_sqft, property_style, last_sale_date, last_sale_price, original_mortgage_amount, original_mortgage_date,
  original_mortgage_lender, most_recent_mortgage_amount, most_recent_mortgage_date, assessed_value, annual_property_tax,
  search_status (found/partial/not_found), source_urls, search_notes`;

  return await invokeAISearch(prompt, base44);
}

async function searchMaine(address, base44) {
  // Extract county, search county registry portal
  const prompt = `Search Maine Registry of Deeds and assessor for property: "${address}"
  1. Determine county from address
  2. Search "[county]countyme.com" or Maine Registry portal
  3. Find deed/transfer records (ownership, last sale)
  4. Find mortgage recordings
  5. Check for discharges
  6. Search "[municipality] ME online assessing" for assessed value, bedrooms, bathrooms, square footage, year built, lot size, and property style

  Return structured JSON with bedrooms, bathrooms, sqft, year_built, lot_size_sqft, property_style, deed, mortgage, tax assessment data, search_status, source_urls, search_notes`;

  return await invokeAISearch(prompt, base44);
}

async function searchNewHampshire(address, base44) {
  const prompt = `Search New Hampshire property records for: "${address}"
  1. Search https://www.nhdeeds.com (centralized index)
  2. Find deed history and ownership
  3. Find mortgage recordings
  4. Check discharge status
  5. Search "[municipality] NH kiosk assessing ${address}" for value/tax, bedrooms, bathrooms, square footage, year built, lot size, and property style

  Return structured JSON with bedrooms, bathrooms, sqft, year_built, lot_size_sqft, property_style, property data, search_status, source_urls, search_notes`;

  return await invokeAISearch(prompt, base44);
}

async function searchVermont(address, base44) {
  const prompt = `Search Vermont property records for: "${address}"
  CRITICAL: Vermont uses TOWN-BASED records, not county.
  1. Search https://www.vtlandrecords.com
  2. Determine correct town/municipality
  3. Find deed/transfer records by grantor/grantee
  4. Find mortgage recordings
  5. Search "[town] VT listers property record ${address}" (note: "listers" not assessors) for assessed value, bedrooms, bathrooms, square footage, year built, lot size, and property style

  Return structured JSON with bedrooms, bathrooms, sqft, year_built, lot_size_sqft, property_style, deed, mortgage, lister assessment data, search_status, source_urls, search_notes`;

  return await invokeAISearch(prompt, base44);
}

// Sanitize AI response — convert any non-numeric strings in numeric fields to null
function sanitizeRecord(data) {
  const numericFields = [
    'last_sale_price', 'original_mortgage_amount', 'most_recent_mortgage_amount',
    'assessed_value', 'annual_property_tax', 'bathrooms', 'sqft', 'lot_size_sqft'
  ];
  const integerFields = [
    'original_mortgage_term_years', 'assessed_year', 'year_built', 'bedrooms'
  ];
  const dateFields = [
    'last_sale_date', 'original_mortgage_date', 'most_recent_mortgage_date'
  ];

  const result = { ...data };

  for (const f of numericFields) {
    const v = result[f];
    if (v !== null && v !== undefined) {
      const n = typeof v === 'string' ? parseFloat(v.replace(/[^0-9.]/g, '')) : Number(v);
      result[f] = isNaN(n) ? null : n;
    }
  }
  for (const f of integerFields) {
    const v = result[f];
    if (v !== null && v !== undefined) {
      const n = typeof v === 'string' ? parseInt(v.replace(/[^0-9]/g, ''), 10) : parseInt(v, 10);
      result[f] = isNaN(n) ? null : n;
    }
  }
  for (const f of dateFields) {
    const v = result[f];
    if (v && typeof v === 'string' && !/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      result[f] = null; // Drop malformed dates
    }
  }

  return result;
}

async function invokeAISearch(prompt, base44) {
  try {
    const response = await base44.integrations.Core.InvokeLLM({
      prompt: prompt,
      add_context_from_internet: true,
      model: 'gemini_3_1_pro',
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
          bedrooms: { type: "integer" },
          bathrooms: { type: "number" },
          sqft: { type: "number" },
          lot_size_sqft: { type: "number" },
          year_built: { type: "integer" },
          property_style: { type: "string" },
          search_status: { type: "string", enum: ["found", "partial", "not_found", "error"] },
          source_urls: { type: "array", items: { type: "string" } },
          search_notes: { type: "string" }
        }
      }
    });

    return sanitizeRecord(response);
  } catch (error) {
    console.error('[searchPublicRecords] AI search error:', error);
    return { search_status: 'error', search_notes: `Search failed: ${error.message}` };
  }
}

// ─── Mortgage Deep Search ──────────────────────────────────────────────────────
// Uses Perplexity sonar-pro to find all recorded instruments since purchase:
// original mortgage, any refinances, HELOCs, and open liens.
// Estimates current payoff balance using amortization math.

async function searchMortgageBalance(address, state, existingRecord, perpApiKey) {
  const saleDate = existingRecord?.last_sale_date || null;
  const saleDateStr = saleDate ? `, purchased ${saleDate.slice(0, 7)}` : '';
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const prompt = `You are a real estate title researcher. Search public registry of deeds records for ALL mortgages and loans recorded against this property: "${address}", ${state}${saleDateStr}.

SEARCH THESE SOURCES:
${state === 'MA' ? '- masslandrecords.com (search by address or grantor name)' : ''}
${state === 'ME' ? '- Maine Registry of Deeds portals by county' : ''}
${state === 'NH' ? '- nhdeeds.com' : ''}
${state === 'VT' ? '- vtlandrecords.com' : ''}
- County assessor / town records
- Any public mortgage database

FIND AND REPORT:
1. Every mortgage, deed of trust, or note recorded after the purchase date — including refinances and HELOCs
2. For each instrument: amount, date, lender, term (years), whether a discharge/satisfaction was later recorded
3. Any other liens: tax liens, mechanics liens, judgment liens, HOA liens
4. The MOST RECENT open (non-discharged) mortgage — this is the active loan

TODAY'S DATE: ${currentYear}-${String(currentMonth).padStart(2,'0')}-01

For the most recent open mortgage, calculate an ESTIMATED CURRENT PAYOFF BALANCE using standard amortization:
- Use the recorded loan amount as original balance
- Assume a 30-year term if not specified (or 15-year if explicitly stated)
- Use the loan date to calculate months elapsed
- Assume interest rate: use the prevailing rate at time of origination as your best estimate (e.g. 3.0% for 2020-2021 loans, 6.5-7% for 2022-2023 loans, 7-7.5% for 2023-2024)
- Show your work: months elapsed, assumed rate, calculated remaining balance

ALSO SEARCH FOR HELOCs:
- Any home equity line of credit recorded after purchase
- HELOCs are separate from the primary mortgage and represent additional debt

IMPORTANT: Only report instruments you actually find in public records. Do not fabricate. If you cannot find records, say so clearly.

Return ONLY valid JSON — no preamble, no explanation.`;

  try {
    const res = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${perpApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [{ role: 'user', content: prompt }],
        search_context_size: 'high',
        return_images: false,
        return_related_questions: false,
      }),
    });

    if (!res.ok) throw new Error(`Perplexity error ${res.status}`);
    const data = await res.json();
    const text = (data.choices?.[0]?.message?.content || '').trim();
    console.log('[searchMortgageBalance] raw response:', text.slice(0, 500));

    // Extract JSON from response
    let clean = text;
    if (clean.startsWith('```')) clean = clean.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) clean = match[0];

    try {
      return JSON.parse(clean);
    } catch (e) {
      console.warn('[searchMortgageBalance] JSON parse failed, using raw text');
      return { raw_response: text, parse_error: true };
    }
  } catch (err) {
    console.warn('[searchMortgageBalance] failed:', err.message);
    return null;
  }
}

// Amortization helper: estimate remaining balance
function estimateRemainingBalance(originalAmount, annualRate, termYears, monthsElapsed) {
  if (!originalAmount || !annualRate || !termYears) return null;
  const r = annualRate / 100 / 12;
  const n = termYears * 12;
  if (r === 0) return Math.max(0, originalAmount - (originalAmount / n) * monthsElapsed);
  const payment = originalAmount * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
  const remaining = originalAmount * Math.pow(1 + r, monthsElapsed) - payment * (Math.pow(1 + r, monthsElapsed) - 1) / r;
  return Math.max(0, Math.round(remaining));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { address, state, force_refresh, include_mortgage_search } = await req.json();
    if (!address || !state) return Response.json({ error: 'address and state required' }, { status: 400 });

    // Run base public record search
    const record = await searchRecordsByState(address, state, base44, force_refresh);

    // If client_portfolio or explicitly requested, run Perplexity mortgage deep search
    if (include_mortgage_search && record.search_status !== 'error') {
      // Check if we already have a recent mortgage search result (cached on the record)
      const hasCachedMortgage = !force_refresh && record.mortgage_search_at &&
        (new Date() - new Date(record.mortgage_search_at)) / (1000 * 60 * 60 * 24) < 30 &&
        (record.mortgage_search_result || record.mortgage_search_notes);

      if (!hasCachedMortgage) {
        // Resolve Perplexity key
        let perpKey = null;
        try {
          const configs = await base44.asServiceRole.entities.PlatformConfig.filter({});
          perpKey = configs[0]?.perplexity_api_key || null;
        } catch(e) {}
        if (!perpKey) perpKey = Deno.env.get('PERPLEXITY_API_KEY') || null;

        if (perpKey) {
          console.log('[searchPublicRecords] Running Perplexity mortgage deep search for:', address);
          const mortgageData = await searchMortgageBalance(address, state, record, perpKey);

          if (mortgageData && !mortgageData.parse_error) {
            // Merge relevant mortgage fields back into record
            const merge = {};

            // Most recent open mortgage
            if (mortgageData.most_recent_mortgage_amount && !record.most_recent_mortgage_amount) {
              merge.most_recent_mortgage_amount = mortgageData.most_recent_mortgage_amount;
            }
            if (mortgageData.most_recent_mortgage_date && !record.most_recent_mortgage_date) {
              merge.most_recent_mortgage_date = mortgageData.most_recent_mortgage_date;
            }
            if (mortgageData.most_recent_mortgage_lender && !record.most_recent_mortgage_lender) {
              merge.most_recent_mortgage_lender = mortgageData.most_recent_mortgage_lender;
            }
            // HELOCs and additional liens
            if (mortgageData.heloc_amount) merge.heloc_amount = mortgageData.heloc_amount;
            if (mortgageData.heloc_lender) merge.heloc_lender = mortgageData.heloc_lender;
            if (mortgageData.heloc_date) merge.heloc_date = mortgageData.heloc_date;
            if (mortgageData.liens_found != null && !record.liens_found) merge.liens_found = mortgageData.liens_found;
            if (mortgageData.lien_details && !record.lien_details) merge.lien_details = mortgageData.lien_details;

            // Estimated payoff balance
            if (mortgageData.estimated_remaining_balance) {
              merge.estimated_mortgage_payoff = mortgageData.estimated_remaining_balance;
            } else {
              // Calculate it ourselves if we have enough data
              const loanDate = mortgageData.most_recent_mortgage_date || record.most_recent_mortgage_date || record.original_mortgage_date;
              const loanAmount = mortgageData.most_recent_mortgage_amount || record.most_recent_mortgage_amount || record.original_mortgage_amount;
              const loanTerm = mortgageData.assumed_term_years || record.original_mortgage_term_years || 30;
              const loanRate = mortgageData.assumed_rate_pct || null;
              if (loanDate && loanAmount && loanRate) {
                const monthsElapsed = Math.floor((Date.now() - new Date(loanDate)) / (1000 * 60 * 60 * 24 * 30.44));
                const est = estimateRemainingBalance(loanAmount, loanRate, loanTerm, monthsElapsed);
                if (est != null) merge.estimated_mortgage_payoff = est;
              }
            }

            // Total estimated debt
            const primaryPayoff = merge.estimated_mortgage_payoff || mortgageData.estimated_remaining_balance || null;
            const helocBalance = mortgageData.heloc_outstanding_balance || mortgageData.heloc_amount || null;
            if (primaryPayoff && helocBalance) merge.estimated_total_debt = Math.round(primaryPayoff + helocBalance);
            else if (primaryPayoff) merge.estimated_total_debt = primaryPayoff;

            merge.mortgage_search_at = new Date().toISOString();
            merge.mortgage_search_notes = mortgageData.search_notes || mortgageData.researcher_notes || null;
            merge.mortgage_search_result = JSON.stringify(mortgageData).slice(0, 2000); // store raw (truncated)
            merge.mortgage_search_status = mortgageData.search_status || (Object.keys(merge).length > 3 ? 'found' : 'partial');

            // Persist merged data back to the cached record
            if (record.id) {
              await base44.asServiceRole.entities.PropertyPublicRecord.update(record.id, merge);
              Object.assign(record, merge);
            }
            record.mortgage_deep_search = mortgageData;
          }
        } else {
          console.warn('[searchPublicRecords] No Perplexity key — skipping mortgage deep search');
        }
      } else {
        console.log('[searchPublicRecords] Using cached mortgage search result');
      }
    }

    return Response.json({ record, from_cache: record.from_cache || false });
  } catch (error) {
    console.error('[searchPublicRecords] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});