import { useState, useEffect, useCallback } from "react";
import { Search, ExternalLink, Plus, X, Info, AlertTriangle, CheckCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";

// Simple string hash for cache key
function hashParams(address, bedrooms, bathrooms, sqft, propertyType) {
  const str = [address, bedrooms, bathrooms, sqft, propertyType].join('|').toLowerCase();
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return String(Math.abs(hash));
}

function VarianceBadge({ comp }) {
  const { perplexity_confirmed, perplexity_variance, perplexity_not_found, found_on } = comp;
  const sourceList = Array.isArray(found_on) && found_on.length > 0 ? found_on.join(', ') : 'public records';

  if (perplexity_not_found) {
    return (
      <span title="Not found on Compass, Zillow, Redfin, or Realtor.com. BatchData public records only."
        className="px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-500 cursor-help">
        ○ Records only
      </span>
    );
  }
  if (!perplexity_confirmed) {
    return (
      <span title="Cross-reference not available."
        className="px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-400 cursor-help">
        — Unverified
      </span>
    );
  }
  if (perplexity_variance === null) return null;
  if (perplexity_variance <= 2) {
    return (
      <span title={`Confirmed on ${sourceList}. Price matches within 2%.`}
        className="px-1.5 py-0.5 rounded text-xs bg-green-100 text-green-700 cursor-help">
        ✓ Confirmed
      </span>
    );
  }
  if (perplexity_variance <= 9) {
    return (
      <span title={`Found on ${sourceList}. ${perplexity_variance}% price difference — review.`}
        className="px-1.5 py-0.5 rounded text-xs bg-amber-100 text-amber-700 cursor-help">
        ⚠ {perplexity_variance}% variance
      </span>
    );
  }
  return (
    <span title={`Found on ${sourceList}. ${perplexity_variance}% price difference — verify before using this comp.`}
      className="px-1.5 py-0.5 rounded text-xs bg-red-100 text-red-700 cursor-help">
      ✗ {perplexity_variance}% variance
    </span>
  );
}

const EMPTY_MANUAL = { address: '', sale_price: '', sale_date: '', bedrooms: '', bathrooms: '', sqft: '', notes: '' };

export default function StepComparableSales({ intake, update, onNext, onBack }) {
  const [fetchState, setFetchState] = useState('idle'); // idle | loading | deepSearch | done | error
  const [comps, setComps] = useState([]);
  const [fromCache, setFromCache] = useState(false);
  const [cachedAt, setCachedAt] = useState(null);
  const [researcherNote, setResearcherNote] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualComp, setManualComp] = useState(EMPTY_MANUAL);
  const [conditions, setConditions] = useState({});

  const cacheKey = hashParams(intake.address, intake.bedrooms, intake.bathrooms, intake.sqft, intake.property_type);
  const CACHE_NS = `comps_cache_${cacheKey}`;
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

  // On mount: check if we already have results in intake (from a previous visit to this step)
  useEffect(() => {
    if (Array.isArray(intake.raw_batchdata_comps) && intake.raw_batchdata_comps.length > 0) {
      // Check cache validity
      const cachedHash = intake.comps_cache_key;
      const fetchedAt = intake.comps_fetched_at;
      const isStale = fetchedAt ? (Date.now() - new Date(fetchedAt).getTime() > SEVEN_DAYS) : true;
      if (cachedHash === cacheKey && !isStale) {
        setComps(intake.raw_batchdata_comps.map(c => ({ ...c, _included: !c.agent_excluded })));
        setCachedAt(fetchedAt);
        setFromCache(true);
        setFetchState('done');
        return;
      }
      // Stale or key mismatch — reset
      update({ raw_batchdata_comps: [], comps_fetch_triggered: false, comps_cache_key: null });
    }
  }, []);

  const runFetch = useCallback(async (force = false) => {
    setFetchState('loading');
    setErrorMsg(null);
    setFromCache(false);

    try {
      const fetchRes = await base44.functions.invoke('fetchCompsFromBatchData', {
        address: intake.address,
        bedrooms: intake.bedrooms,
        bathrooms: intake.bathrooms,
        sqft: intake.sqft,
        property_type: intake.property_type,
        forceRefresh: force,
      });

      const fd = fetchRes.data;
      if (!fd?.success) {
        if (fd?.error === 'batchdata_key_missing') {
          setErrorMsg('BatchData API key is not configured. Go to Admin → AI Settings to add your key.');
        } else {
          setErrorMsg(fd?.message || 'Search encountered an issue. You can add comps manually below.');
        }
        setFetchState('error');
        setShowManualAdd(true);
        return;
      }

      if (fd.search_tier === 'agent_deep_search') {
        setFetchState('deepSearch');
      }

      let enrichedComps = fd.comps || [];

      // Enrich with Perplexity (standard comps only, not deep search)
      if (enrichedComps.length > 0 && fd.search_tier !== 'agent_deep_search') {
        try {
          const enrichRes = await base44.functions.invoke('enrichCompsWithPerplexity', { comps: enrichedComps });
          if (enrichRes.data?.success && enrichRes.data.enriched_comps?.length > 0) {
            enrichedComps = enrichRes.data.enriched_comps;
            update({ raw_perplexity_enrichment: enrichRes.data.raw_enrichment || [] });
          }
        } catch (e) {
          console.warn('[StepComparableSales] Enrichment failed (non-fatal):', e.message);
        }
      }

      const withIncluded = enrichedComps.map(c => ({ ...c, _included: true }));
      setComps(withIncluded);
      setResearcherNote(fd.researcher_note || null);

      const now = new Date().toISOString();
      update({
        raw_batchdata_comps: enrichedComps,
        comps_fetch_triggered: true,
        comps_cache_key: cacheKey,
        comps_fetched_at: now,
        comps_search_tier: fd.search_tier,
        comps_search_radius: fd.search_radius,
        large_property_flag: fd.large_property_flag || false,
      });

      setCachedAt(now);
      setFetchState('done');
    } catch (e) {
      console.error('[StepComparableSales] fetch error:', e.message);
      setErrorMsg('Search encountered an issue. You can add comps manually below.');
      setFetchState('error');
      setShowManualAdd(true);
    }
  }, [intake, cacheKey, update]);

  function toggleComp(idx) {
    setComps(prev => prev.map((c, i) => i === idx ? { ...c, _included: !c._included } : c));
  }

  function updateCompNote(idx, note) {
    setComps(prev => prev.map((c, i) => i === idx ? { ...c, agent_notes: note } : c));
  }

  function handleCondition(idx, val) {
    setConditions(prev => ({ ...prev, [idx]: val }));
  }

  function addManualComp() {
    const sp = Number(String(manualComp.sale_price).replace(/[^0-9.]/g, '')) || null;
    const sqftNum = Number(manualComp.sqft) || null;
    const newComp = {
      address: manualComp.address,
      sale_price: sp,
      sale_date: manualComp.sale_date,
      sqft: sqftNum,
      bedrooms: Number(manualComp.bedrooms) || null,
      bathrooms: Number(manualComp.bathrooms) || null,
      price_per_sqft: (sp && sqftNum) ? Math.round(sp / sqftNum) : null,
      source: 'agent_manual',
      perplexity_confirmed: false,
      perplexity_variance: null,
      agent_excluded: false,
      agent_notes: manualComp.notes || '',
      condition_vs_subject: 'similar',
      _included: true,
    };
    setComps(prev => [...prev, newComp]);
    setManualComp(EMPTY_MANUAL);
    setShowManualAdd(false);
  }

  function handleConfirm() {
    const included = comps
      .filter(c => c._included)
      .map(({ _included, ...c }, i) => ({
        ...c,
        condition_vs_subject: conditions[comps.indexOf(comps.filter(x => x._included)[i])] || c.condition_vs_subject || 'similar',
        agent_excluded: false,
      }));

    const allApi = included.every(c => c.source === 'batchdata' || c.source === 'perplexity_deep_search');
    const allManual = included.every(c => c.source === 'agent_manual');
    const compsSource = allApi ? 'api_verified' : allManual ? 'agent_manual' : included.length === 0 ? 'none' : 'mixed';

    // Mark excluded comps
    const withExcluded = comps.map(({ _included, ...c }) => ({ ...c, agent_excluded: !_included }));

    update({
      agent_comps: included,
      raw_batchdata_comps: withExcluded,
      comps_source: compsSource,
    });
    onNext();
  }

  const includedCount = comps.filter(c => c._included).length;

  // ── STATE 1: Idle ──────────────────────────────────────────────────────────
  if (fetchState === 'idle') {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-[#1A3226]" style={{ fontFamily: 'Georgia, serif' }}>
            Find Comparable Sales
          </h2>
          <p className="text-sm text-[#1A3226]/60 mt-1">
            PropPrompt will search public deed records for recent sales near{' '}
            <span className="font-medium text-[#1A3226]">{intake.address}</span> and cross-reference
            them against Compass, Zillow, Redfin, and Realtor.com.
          </p>
          <p className="text-xs text-[#1A3226]/40 mt-2">
            Searching within 0.5 miles · {intake.property_type?.replace('_', ' ')} ·
            {!((intake.sqft || 0) >= 4000) && ` ±1 bed/bath ·`} ±20% sqft · Sold in last 12 months
          </p>
        </div>

        <Button
          onClick={() => runFetch(false)}
          className="w-full h-12 bg-[#1A3226] text-white hover:bg-[#1A3226]/90 text-base gap-2"
        >
          <Search className="w-5 h-5" /> Find Comparable Sales
        </Button>

        <p className="text-xs text-center text-[#1A3226]/40">
          Each search uses one API credit. Results are cached for 7 days —
          you won't be charged again if you return to this report.
        </p>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={onBack} className="border-[#1A3226]/15 text-[#1A3226]/60">← Back</Button>
        </div>
      </div>
    );
  }

  // ── STATE 2: Loading ───────────────────────────────────────────────────────
  if (fetchState === 'loading') {
    return (
      <div className="p-6 lg:p-8 flex flex-col items-center justify-center space-y-4 min-h-64">
        <div className="w-10 h-10 border-4 border-[#1A3226]/20 border-t-[#1A3226] rounded-full animate-spin" />
        <div className="text-center">
          <p className="text-sm font-medium text-[#1A3226]">Finding comparable sales near {intake.address}...</p>
          <p className="text-xs text-[#1A3226]/50 mt-1">Searching public records and cross-referencing Compass, Zillow, Redfin, and Realtor.com</p>
          <p className="text-xs text-[#1A3226]/40 mt-1">Usually takes 10–20 seconds</p>
        </div>
      </div>
    );
  }

  // ── Deep Search state ──────────────────────────────────────────────────────
  if (fetchState === 'deepSearch') {
    return (
      <div className="p-6 lg:p-8 flex flex-col items-center justify-center space-y-4 min-h-64">
        <div className="text-4xl">🔍</div>
        <div className="text-center space-y-2">
          <p className="text-base font-semibold text-[#1A3226]">This property needs a deeper search</p>
          <p className="text-sm text-[#1A3226]/60 max-w-md">
            Standard comparable sales searches came up short for this address. PropPrompt is running
            an extended research pass using AI to find the best available comparables.
          </p>
          <p className="text-xs text-[#1A3226]/40">
            This takes 30–60 seconds. Your report will be just as accurate — some properties simply require more research.
          </p>
        </div>
        <div className="w-48 h-1.5 bg-[#1A3226]/10 rounded-full overflow-hidden">
          <div className="h-full bg-[#B8982F] rounded-full animate-pulse w-full" />
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (fetchState === 'error') {
    return (
      <div className="p-6 lg:p-8 space-y-4">
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-800">{errorMsg || 'Automatic search was not available. Add comps manually below.'}</p>
        </div>
        <ManualAddForm
          manualComp={manualComp}
          setManualComp={setManualComp}
          onAdd={addManualComp}
          expanded
        />
        {comps.length > 0 && (
          <p className="text-xs text-[#1A3226]/40 text-center">{comps.length} comp(s) added manually</p>
        )}
        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={onBack} className="border-[#1A3226]/15 text-[#1A3226]/60">← Back</Button>
          <Button onClick={handleConfirm} className="ml-auto bg-[#1A3226] text-white hover:bg-[#1A3226]/90">
            Confirm Comps & Continue →
          </Button>
        </div>
      </div>
    );
  }

  // ── STATE 3: Results ───────────────────────────────────────────────────────
  return (
    <div className="p-6 lg:p-8 space-y-5">
      {/* Cache banner */}
      {fromCache && cachedAt && (
        <div className="flex items-center gap-2 text-xs text-[#1A3226]/60 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          <Info className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
          Showing saved results from {new Date(cachedAt).toLocaleDateString()}.{' '}
          <button onClick={() => runFetch(true)} className="text-blue-600 underline flex items-center gap-1 hover:text-blue-800">
            <RefreshCw className="w-3 h-3" /> Refresh →
          </button>
        </div>
      )}

      {/* Researcher note banner */}
      {researcherNote && (
        <div className="flex items-start gap-2 text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          <Info className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
          {researcherNote}
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold text-[#1A3226]" style={{ fontFamily: 'Georgia, serif' }}>
          Comparable Sales Found
        </h2>
        <p className="text-sm text-[#1A3226]/60 mt-0.5">
          PropPrompt found {comps.length} recent sale{comps.length !== 1 ? 's' : ''} near {intake.address}.
          Review and confirm the comps to use in your analysis.
        </p>
      </div>

      {/* Count banners */}
      {includedCount === 0 && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          ⚠️ No comps selected. Include at least 3 comps to generate a defensible valuation.
        </div>
      )}
      {includedCount >= 1 && includedCount <= 2 && (
        <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-800">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          ℹ️ Low comp count. 3+ comps produce a more reliable valuation range.
        </div>
      )}

      {/* Low volume from deep search */}
      {comps.length > 0 && comps.length <= 2 && intake.comps_search_tier === 'agent_deep_search' && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          ⚠️ Only {comps.length} comparable sale{comps.length !== 1 ? 's' : ''} found for this property type in this area. This is a low-volume market. Review carefully and consider adding manual comps from your MLS if available.
        </div>
      )}

      {comps.length === 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-4 text-sm text-amber-800">
          No recent comparable sales were found for this property type in this area. Add comps manually from your MLS or registry of deeds to proceed.
        </div>
      )}

      {/* Comp table */}
      {comps.length > 0 && (
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#1A3226]/10">
                <th className="px-2 py-2 text-left text-[#1A3226]/50 font-medium">Include</th>
                <th className="px-2 py-2 text-left text-[#1A3226]/50 font-medium">Address</th>
                <th className="px-2 py-2 text-right text-[#1A3226]/50 font-medium">Sale Price</th>
                <th className="px-2 py-2 text-left text-[#1A3226]/50 font-medium">Date</th>
                <th className="px-2 py-2 text-center text-[#1A3226]/50 font-medium">Bd/Ba/Sqft</th>
                <th className="px-2 py-2 text-right text-[#1A3226]/50 font-medium">$/Sqft</th>
                <th className="px-2 py-2 text-left text-[#1A3226]/50 font-medium">Verify</th>
                <th className="px-2 py-2 text-left text-[#1A3226]/50 font-medium">Condition</th>
                <th className="px-2 py-2 text-left text-[#1A3226]/50 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {comps.map((comp, idx) => (
                <tr key={idx} className={`border-b border-[#1A3226]/5 ${!comp._included ? 'opacity-40' : ''}`}>
                  <td className="px-2 py-2">
                    <input type="checkbox" checked={comp._included} onChange={() => toggleComp(idx)}
                      className="accent-[#1A3226] w-4 h-4 cursor-pointer" />
                  </td>
                  <td className="px-2 py-2 text-[#1A3226] max-w-40">
                    <div className="truncate" title={comp.address}>{comp.address}</div>
                    {comp.source === 'agent_manual' && <span className="text-[10px] text-[#1A3226]/40">manual</span>}
                  </td>
                  <td className="px-2 py-2 text-right text-[#1A3226] font-medium">
                    {comp.sale_price ? `$${comp.sale_price.toLocaleString()}` : '—'}
                  </td>
                  <td className="px-2 py-2 text-[#1A3226]/60">
                    {comp.sale_date ? new Date(comp.sale_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}
                  </td>
                  <td className="px-2 py-2 text-center text-[#1A3226]/60">
                    {[comp.bedrooms, comp.bathrooms, comp.sqft ? comp.sqft.toLocaleString() : null].filter(Boolean).join(' / ') || '—'}
                  </td>
                  <td className="px-2 py-2 text-right text-[#1A3226]/60">
                    {comp.price_per_sqft ? `$${comp.price_per_sqft}` : '—'}
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-1">
                      <VarianceBadge comp={comp} />
                      {comp.listing_url && (
                        <a href={comp.listing_url} target="_blank" rel="noopener noreferrer"
                          className="text-blue-500 hover:text-blue-700 ml-1">
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <select
                      value={conditions[idx] || comp.condition_vs_subject || 'similar'}
                      onChange={e => handleCondition(idx, e.target.value)}
                      className="text-xs border border-[#1A3226]/15 rounded px-1.5 py-1 bg-white focus:outline-none"
                    >
                      <option value="superior">Superior</option>
                      <option value="similar">Similar</option>
                      <option value="inferior">Inferior</option>
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="text"
                      value={comp.agent_notes || ''}
                      onChange={e => updateCompNote(idx, e.target.value.slice(0, 80))}
                      placeholder="notes…"
                      className="w-24 text-xs border border-[#1A3226]/15 rounded px-1.5 py-1 focus:outline-none"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Manual add */}
      <div>
        <button
          onClick={() => setShowManualAdd(v => !v)}
          className="flex items-center gap-1.5 text-xs text-[#1A3226]/60 hover:text-[#1A3226] transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add a comp manually
        </button>
        {showManualAdd && (
          <ManualAddForm
            manualComp={manualComp}
            setManualComp={setManualComp}
            onAdd={addManualComp}
            expanded
          />
        )}
      </div>

      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={onBack} className="border-[#1A3226]/15 text-[#1A3226]/60">← Back</Button>
        <Button onClick={handleConfirm} className="ml-auto bg-[#1A3226] text-white hover:bg-[#1A3226]/90">
          Confirm Comps & Continue →
        </Button>
      </div>
    </div>
  );
}

function ManualAddForm({ manualComp, setManualComp, onAdd, expanded }) {
  const canAdd = manualComp.address && manualComp.sale_price && manualComp.sale_date;
  return (
    <div className="mt-3 border border-dashed border-[#1A3226]/20 rounded-xl p-4 space-y-3 bg-[#FAF8F4]/50">
      <p className="text-xs font-medium text-[#1A3226]/60">Add Comp Manually</p>
      <div>
        <label className="text-xs text-[#1A3226]/50 mb-1 block">Address *</label>
        <input type="text" value={manualComp.address}
          onChange={e => setManualComp(p => ({ ...p, address: e.target.value }))}
          placeholder="100 Example St, Revere, MA 02151"
          className="w-full text-sm border border-[#1A3226]/15 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#1A3226]/30" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-[#1A3226]/50 mb-1 block">Sale Price *</label>
          <input type="text" value={manualComp.sale_price}
            onChange={e => setManualComp(p => ({ ...p, sale_price: e.target.value }))}
            placeholder="$000,000"
            className="w-full text-sm border border-[#1A3226]/15 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#1A3226]/30" />
        </div>
        <div>
          <label className="text-xs text-[#1A3226]/50 mb-1 block">Sale Date *</label>
          <input type="date" value={manualComp.sale_date}
            onChange={e => setManualComp(p => ({ ...p, sale_date: e.target.value }))}
            className="w-full text-sm border border-[#1A3226]/15 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#1A3226]/30" />
        </div>
        <div>
          <label className="text-xs text-[#1A3226]/50 mb-1 block">Sq Ft</label>
          <input type="number" value={manualComp.sqft}
            onChange={e => setManualComp(p => ({ ...p, sqft: e.target.value }))}
            placeholder="1,200"
            className="w-full text-sm border border-[#1A3226]/15 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#1A3226]/30" />
        </div>
        <div>
          <label className="text-xs text-[#1A3226]/50 mb-1 block">Beds</label>
          <input type="number" value={manualComp.bedrooms}
            onChange={e => setManualComp(p => ({ ...p, bedrooms: e.target.value }))}
            placeholder="3"
            className="w-full text-sm border border-[#1A3226]/15 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#1A3226]/30" />
        </div>
        <div>
          <label className="text-xs text-[#1A3226]/50 mb-1 block">Baths</label>
          <input type="number" value={manualComp.bathrooms}
            onChange={e => setManualComp(p => ({ ...p, bathrooms: e.target.value }))}
            placeholder="2"
            className="w-full text-sm border border-[#1A3226]/15 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#1A3226]/30" />
        </div>
        <div>
          <label className="text-xs text-[#1A3226]/50 mb-1 block">Notes</label>
          <input type="text" value={manualComp.notes}
            onChange={e => setManualComp(p => ({ ...p, notes: e.target.value }))}
            placeholder="optional"
            className="w-full text-sm border border-[#1A3226]/15 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#1A3226]/30" />
        </div>
      </div>
      <Button size="sm" onClick={onAdd} disabled={!canAdd}
        className="bg-[#1A3226] text-white hover:bg-[#1A3226]/90">
        Add Comp
      </Button>
    </div>
  );
}