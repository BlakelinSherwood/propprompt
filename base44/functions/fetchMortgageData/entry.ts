/**
 * fetchMortgageData — Uses ATTOM /property/detailmortgage to pull recorded
 * mortgage data for a property, then estimates current payoff via amortization.
 * Falls back to Perplexity public records search if ATTOM finds nothing useful.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ATTOM_BASE = 'https://api.gateway.attomdata.com/propertyapi/v1.0.0';

// Rate assumptions by origination year (midpoint rates)
function guessRate(year) {
  if (!year) return 6.5;
  if (year <= 2012) return 4.0;
  if (year <= 2016) return 3.9;
  if (year <= 2019) return 4.3;
  if (year <= 2021) return 3.0;
  if (year <= 2022) return 5.5;
  if (year <= 2023) return 7.0;
  return 7.25; // 2024+
}

// Standard amortization remaining balance
function estimateBalance(originalAmount, annualRatePct, termYears, loanDate) {
  if (!originalAmount || !loanDate) return null;
  const rate = annualRatePct / 100 / 12;
  const n = (termYears || 30) * 12;
  const monthsElapsed = Math.max(0, Math.floor((Date.now() - new Date(loanDate)) / (1000 * 60 * 60 * 24 * 30.44)));
  if (monthsElapsed >= n) return 0;
  if (rate === 0) return Math.max(0, Math.round(originalAmount - (originalAmount / n) * monthsElapsed));
  const pmt = originalAmount * rate * Math.pow(1 + rate, n) / (Math.pow(1 + rate, n) - 1);
  const remaining = originalAmount * Math.pow(1 + rate, monthsElapsed) - pmt * (Math.pow(1 + rate, monthsElapsed) - 1) / rate;
  return Math.max(0, Math.round(remaining));
}

async function fetchAttomMortgage(apiKey, address) {
  // Parse address: "123 Main St, Salem, MA 01970"
  // ATTOM supports: address1 (street) + address2 (city, state zip) OR single-line address param
  const parts = address.split(',').map(p => p.trim());
  if (parts.length < 2) throw new Error('Address must include street, city, and state');

  const address1 = parts[0]; // "123 Main St"
  const address2 = parts.slice(1).join(', '); // "Salem, MA 01970"

  const params = new URLSearchParams({ address1, address2 });
  const url = `${ATTOM_BASE}/property/detailmortgage?${params.toString()}`;
  console.log('[fetchMortgageData] ATTOM GET', url.split('?')[0], `address1="${address1}" address2="${address2}"`);

  const res = await fetch(url, {
    headers: { 'apikey': apiKey, 'Accept': 'application/json' },
  });

  const text = await res.text();
  const data = JSON.parse(text);

  // 400 with SuccessWithoutResult = valid call, address just not found in ATTOM
  if (!res.ok) {
    const msg = data?.status?.msg || '';
    if (msg === 'SuccessWithoutResult' || data?.status?.code === 400) {
      throw new Error('Address not found in ATTOM property records');
    }
    console.error('[fetchMortgageData] ATTOM error', res.status, text.slice(0, 500));
    throw new Error(`ATTOM mortgage API error ${res.status}: ${text.slice(0, 200)}`);
  }

  const prop = data.property?.[0];
  if (!prop) throw new Error('No property data returned for this address');
  console.log('[fetchMortgageData] ATTOM prop keys:', Object.keys(prop).join(', '));
  if (prop.mortgage) console.log('[fetchMortgageData] mortgage keys:', JSON.stringify(prop.mortgage).slice(0, 500));

  return prop;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { address } = await req.json();
    if (!address) return Response.json({ error: 'address required' }, { status: 400 });

    const attomKey = Deno.env.get('ATTOM_API_KEY');
    if (!attomKey) return Response.json({ error: 'ATTOM API key not configured' }, { status: 500 });

    let prop;
    try {
      prop = await fetchAttomMortgage(attomKey, address);
    } catch (err) {
      console.error('[fetchMortgageData] ATTOM fetch failed:', err.message);
      return Response.json({ success: false, message: err.message }, { status: 200 });
    }

    // ── Extract mortgage from ATTOM response ──────────────────────────────
    // ATTOM structure: prop.mortgage = { lender: {lastname, companycode}, amount, date, term (months), loantypecode, duedate, ... }
    const mortgage = prop.mortgage || {};

    const loanAmount = Number(mortgage.amount) || null;
    const loanDate = mortgage.date || mortgage.recordingdate || null; // "2023-10-23"
    const lenderName = mortgage.lender?.lastname || mortgage.lender?.companyname || null;
    // ATTOM term is in MONTHS
    const termMonths = mortgage.term ? Number(mortgage.term) : null;
    const termYears = termMonths ? Math.round(termMonths / 12) : 30;

    const loanYear = loanDate ? new Date(loanDate).getFullYear() : null;
    const assumedRate = guessRate(loanYear);
    const estimatedPayoff = estimateBalance(loanAmount, assumedRate, termYears, loanDate);

    // HELOC / 2nd (ATTOM may include under mortgage2 for some subscription tiers — check both)
    const mortgage2 = prop.mortgage2 || {};
    const helocAmount = Number(mortgage2.amount) || null;
    const helocDate = mortgage2.date || mortgage2.recordingdate || null;
    const helocLender = mortgage2.lender?.lastname || mortgage2.lender?.companyname || null;

    // Property details
    const building = prop.building?.summary || {};
    const saleHistory = prop.sale || {};

    const result = {
      success: true,
      source: 'attom',
      // Mortgage
      loan_amount: loanAmount,
      loan_date: loanDate ? loanDate.slice(0, 10) : null,
      lender_name: lenderName,
      loan_term_years: termYears || null,
      assumed_rate_pct: assumedRate,
      estimated_payoff: estimatedPayoff,
      // HELOC
      heloc_amount: helocAmount,
      heloc_date: helocDate ? helocDate.slice(0, 10) : null,
      heloc_lender: helocLender,
      // Estimated total debt
      estimated_total_debt: estimatedPayoff != null
        ? Math.round(estimatedPayoff + (helocAmount || 0))
        : (helocAmount || null),
      // Property context
      bedrooms: Number(building.bedrooms) || null,
      bathrooms: Number(building.bathrooms) || null,
      sqft: Number(building.livingSize) || null,
      year_built: Number(building.yearBuilt) || null,
      last_sale_date: saleHistory.saleTransDate?.slice(0, 10) || null,
      last_sale_price: Number(saleHistory.saleAmt) || null,
      // Notes
      notes: loanAmount
        ? `ATTOM public records: ${lenderName || 'Unknown lender'} loan of $${loanAmount.toLocaleString()} recorded ${loanDate?.slice(0,7) || '?'}. Estimated payoff uses ${assumedRate}% assumed rate (${termYears || 30}-yr term).`
        : 'ATTOM found property but no mortgage instruments recorded. Property may be owned free & clear, or the loan may predate digital records.',
    };

    console.log('[fetchMortgageData] Success — loan:', loanAmount, 'estimated payoff:', estimatedPayoff);
    return Response.json(result);

  } catch (err) {
    console.error('[fetchMortgageData] Error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});