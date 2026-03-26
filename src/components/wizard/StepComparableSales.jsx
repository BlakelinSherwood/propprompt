import { useState, useEffect, useRef } from "react";
import { Search, RefreshCw, ExternalLink, Plus, X, Loader2, Info, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";

const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
const CONDITIONS = ["Superior", "Similar", "Inferior"];
const EMPTY_MANUAL = { address: "", sale_price: "", sale_date: "", bedrooms: "", bathrooms: "", sqft: "", notes: "" };

async function computeCacheKey(params) {
  const str = [params.address, params.bedrooms, params.bathrooms, params.sqft, params.propertyType]
    .map(v => String(v || "")).join("|").toLowerCase();
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

function getCached(key) {
  try {
    const raw = localStorage.getItem(`pp_comps_${key}`);
    if (!raw) return null;
    const item = JSON.parse(raw);
    if (Date.now() - item.timestamp > CACHE_TTL) return null;
    return item;
  } catch { return null; }
}

function setCache(key, data) {
  try { localStorage.setItem(`pp_comps_${key}`, JSON.stringify({ ...data, timestamp: Date.now() })); } catch {}
}

function fmt(n) {
  if (!n) return "—";
  return "$" + Number(n).toLocaleString();
}

function VarianceBadge({ comp }) {
  const { perplexity_confirmed, perplexity_variance, perplexity_not_found, found_on } = comp;
  const sources = (found_on || []).join(", ") || "sources";

  if (perplexity_not_found) {
    return <span title="Not found on Compass, Zillow, Redfin, or Realtor.com. BatchData public records only." className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">Records only</span>;
  }
  if (comp.source === "perplexity_deep_search") {
    return <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">AI Research</span>;
  }
  if (comp.source === "agent_manual") {
    return <span className="px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700">Manual</span>;
  }
  if (!perplexity_confirmed || perplexity_variance === null) {
    return <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-400">Checking…</span>;
  }
  if (perplexity_variance <= 2) {
    return <span title={`Confirmed on ${sources}. Price matches within 2%.`} className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">✓ Confirmed</span>;
  }
  if (perplexity_variance <= 9) {
    return <span title={`Found on ${sources}. ${perplexity_variance}% price difference — review.`} className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700">⚠ {perplexity_variance}% variance</span>;
  }
  return <span title={`Found on ${sources}. ${perplexity_variance}% price difference — verify before using.`} className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700">⚠ {perplexity_variance}% — verify</span>;
}

export default function StepComparableSales({ intake, update, onNext, onBack }) {
  const [fetchState, setFetchState] = useState("idle"); // idle | loading | done | error
  const [comps, setComps] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [conditionMap, setConditionMap] = useState({});
  const [notesMap, setNotesMap] = useState({});
  const [manualComps, setManualComps] = useState([]);
  const [showManual, setShowManual] = useState(false);
  const [manual, setManual] = useState(EMPTY_MANUAL);
  const [fromCache, setFromCache] = useState(false);
  const [cacheDate, setCacheDate] = useState(null);
  const [searchMeta, setSearchMeta] = useState({});
  const [researcherNote, setResearcherNote] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [cacheKey, setCacheKey] = useState(null);
  const deepTimerRef = useRef(null);

  const city = (intake.address || "").split(",")[1]?.trim() || "this area";
  const hasDetails = intake.address && intake.property_type;

  // Compute cache key + check cache on property detail changes
  useEffect(() => {
    if (!hasDetails) return;
    computeCacheKey({
      address: intake.address, bedrooms: intake.bedrooms,
      bathrooms: intake.bathrooms, sqft: intake.sqft, propertyType: intake.property_type,
    }).then(key => {
      // If key changed from what's stored in intake, invalidate
      if (intake.comps_cache_key && key !== intake.comps_cache_key) {
        setFetchState("idle");
        setComps([]);
        setSelected(new Set());
        update({ comps_fetch_triggered: false, comps_cache_key: null, raw_batchdata_comps: [], agent_comps: [] });
      }
      setCacheKey(key);
      // Restore from localStorage cache if already fetched
      const cached = getCached(key);
      if (cached && intake.comps_fetch_triggered) {
        setComps(cached.comps || []);
        setSelected(new Set((cached.comps || []).map(c => c.address)));
        setSearchMeta({ tier: cached.search_tier, radius: cached.search_radius });
        setResearcherNote(cached.researcher_note || null);
        setFromCache(true);
        setCacheDate(new Date(cached.timestamp));
        setFetchState("done");
      }
    });
  }, [intake.address, intake.bedrooms, intake.bathrooms, intake.sqft, intake.property_type]);

  // Deep search UI: switch to extended copy after 15s of loading
  useEffect(() => {
    if (fetchState === "loading") {
      deepTimerRef.current = setTimeout(() => setFetchState("deep_search_ui"), 15000);
    } else {
      clearTimeout(deepTimerRef.current);
    }
    return () => clearTimeout(deepTimerRef.current);
  }, [fetchState]);

  async function handleFetch(forceRefresh = false) {
    if (!hasDetails) return;
    setErrorMsg(null);
    setFromCache(false);
    setFetchState("loading");

    // Check localStorage cache unless force refresh
    if (!forceRefresh && cacheKey) {
      const cached = getCached(cacheKey);
      if (cached) {
        setComps(cached.comps || []);
        setSelected(new Set((cached.comps || []).map(c => c.address)));
        setSearchMeta({ tier: cached.search_tier, radius: cached.search_radius });
        setResearcherNote(cached.researcher_note || null);
        setFromCache(true);
        setCacheDate(new Date(cached.timestamp));
        setFetchState("done");
        update({ comps_fetch_triggered: true, comps_cache_key: cacheKey });
        return;
      }
    }

    try {
      const res = await base44.functions.invoke("fetchCompsFromBatchData", {
        address: intake.address,
        bedrooms: intake.bedrooms ? Number(intake.bedrooms) : null,
        bathrooms: intake.bathrooms ? Number(intake.bathrooms) : null,
        sqft: intake.sqft ? Number(intake.sqft) : null,
        propertyType: intake.property_type,
        forceRefresh,
      });

      const data = res.data;

      if (!data?.success) {
        setErrorMsg(data?.message || "Unable to find comparable sales automatically. Add comps manually below.");
        setFetchState("done");
        setShowManual(true);
        update({ comps_fetch_triggered: true, comps_cache_key: cacheKey });
        return;
      }

      const fetchedComps = data.comps || [];
      const note = data.researcher_note || null;
      setResearcherNote(note);
      setSearchMeta({ tier: data.search_tier, radius: data.search_radius });

      // Enrich non-deep-search comps with Perplexity
      let finalComps = fetchedComps;
      if (fetchedComps.length > 0 && data.search_tier !== "agent_deep_search") {
        try {
          const enrichRes = await base44.functions.invoke("enrichCompsWithPerplexity", { comps: fetchedComps });
          if (enrichRes.data?.success) finalComps = enrichRes.data.comps || fetchedComps;
          update({ raw_perplexity_enrichment: enrichRes.data?.rawEnrichment || [] });
        } catch (e) {
          console.warn("[StepComparableSales] Enrichment failed:", e.message);
        }
      }

      setComps(finalComps);
      setSelected(new Set(finalComps.map(c => c.address)));
      setCacheDate(new Date());
      if (cacheKey) setCache(cacheKey, { comps: finalComps, search_tier: data.search_tier, search_radius: data.search_radius, researcher_note: note });

      update({
        raw_batchdata_comps: finalComps,
        comps_fetched_at: new Date().toISOString(),
        comps_search_tier: data.search_tier,
        comps_search_radius: data.search_radius,
        large_property_flag: data.large_property_flag || false,
        comps_researcher_note: note,
        comps_fetch_triggered: true,
        comps_cache_key: cacheKey,
      });

      setFetchState("done");
    } catch (err) {
      console.error("[StepComparableSales] Fetch error:", err);
      setErrorMsg("Unable to search for comparable sales. Add comps manually.");
      setFetchState("done");
      setShowManual(true);
      update({ comps_fetch_triggered: true });
    }
  }

  function toggleComp(address) {
    setSelected(prev => { const n = new Set(prev); n.has(address) ? n.delete(address) : n.add(address); return n; });
  }

  function addManualComp() {
    if (!manual.address || !manual.sale_price || !manual.sale_date) return;
    const price = Number(String(manual.sale_price).replace(/[^0-9.]/g, ""));
    const sqft = manual.sqft ? Number(manual.sqft) : null;
    const comp = {
      address: manual.address, sale_price: price || null, sale_date: manual.sale_date,
      sqft, bedrooms: manual.bedrooms ? Number(manual.bedrooms) : null,
      bathrooms: manual.bathrooms ? Number(manual.bathrooms) : null,
      price_per_sqft: (price && sqft) ? Math.round(price / sqft) : null,
      source: "agent_manual", search_tier: "manual",
      perplexity_confirmed: false, perplexity_variance: null,
      agent_excluded: false, agent_notes: manual.notes || "",
    };
    setManualComps(prev => [...prev, comp]);
    setSelected(prev => new Set([...prev, comp.address]));
    setManual(EMPTY_MANUAL);
  }

  function handleConfirm() {
    const allComps = [...comps, ...manualComps];
    const raw = allComps.map(c => ({
      ...c,
      agent_excluded: !selected.has(c.address),
      condition_vs_subject: conditionMap[c.address] || "Similar",
      agent_notes: notesMap[c.address] !== undefined ? notesMap[c.address] : (c.agent_notes || ""),
    }));
    const confirmed = raw.filter(c => !c.agent_excluded);
    const hasApi = confirmed.some(c => c.source === "batchdata" || c.source === "perplexity_deep_search");
    const hasManual = confirmed.some(c => c.source === "agent_manual");
    const compsSource = hasApi && hasManual ? "mixed" : hasManual ? "agent_manual" : hasApi ? "api_verified" : "none";
    update({ agent_comps: confirmed, raw_batchdata_comps: raw, comps_source: compsSource });
    onNext();
  }

  const allComps = [...comps, ...manualComps];
  const selectedCount = allComps.filter(c => selected.has(c.address)).length;

  // ── STATE 1: IDLE ───────────────────────────────────────────────────────────
  if (!intake.comps_fetch_triggered || fetchState === "idle") {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-[#B8982F] mb-1">Step 4</p>
          <h2 className="text-xl font-semibold text-[#1A3226]" style={{ fontFamily: "Georgia, serif" }}>Find Comparable Sales</h2>
          <p className="text-sm text-[#1A3226]/60 mt-1">
            PropPrompt will search public deed records for recent sales near {intake.address || "the subject property"} and cross-reference them against Compass, Zillow, Redfin, and Realtor.com.
          </p>
        </div>
        <div className="bg-[#FAF8F4] rounded-xl border border-[#1A3226]/10 p-5 space-y-3">
          <p className="text-xs text-[#1A3226]/50">
            Searching within 0.5 miles · {(intake.property_type || "property").replace("_", "-")} · ±1 bed/bath · ±20% sqft · Sold in last 12 months
          </p>
          <Button onClick={() => handleFetch(false)} className="w-full bg-[#1A3226] text-white hover:bg-[#1A3226]/90 gap-2 py-6 text-base">
            <Search className="w-5 h-5" /> Find Comparable Sales
          </Button>
          <p className="text-xs text-[#1A3226]/40 text-center">
            Each search uses one API credit. Results are cached for 7 days —<br />you won't be charged again if you return to this report.
          </p>
        </div>
        <div className="flex items-center justify-between border-t border-[#1A3226]/8 pt-5">
          <button onClick={onBack} className="px-5 py-2.5 rounded-xl border border-[#1A3226]/15 text-sm font-medium text-[#1A3226]/60 hover:text-[#1A3226] hover:border-[#1A3226]/30 transition-all">← Back</button>
          <button onClick={() => { update({ agent_comps: [], comps_source: "none", comps_fetch_triggered: true }); onNext(); }} className="px-5 py-2.5 rounded-xl border border-[#1A3226]/15 text-sm font-medium text-[#1A3226]/50 hover:text-[#1A3226] transition-all">Skip →</button>
        </div>
      </div>
    );
  }

  // ── STATE 2: LOADING ────────────────────────────────────────────────────────
  if (fetchState === "loading") {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-[#B8982F] mb-1">Step 4</p>
          <h2 className="text-xl font-semibold text-[#1A3226]" style={{ fontFamily: "Georgia, serif" }}>Finding Comparable Sales</h2>
        </div>
        <div className="flex flex-col items-center justify-center py-14 space-y-4 text-center">
          <Loader2 className="w-10 h-10 text-[#1A3226] animate-spin" />
          <p className="text-sm font-medium text-[#1A3226]">Finding comparable sales near {city}…</p>
          <p className="text-xs text-[#1A3226]/50 max-w-sm">Searching public records and cross-referencing Compass, Zillow, Redfin, and Realtor.com</p>
          <p className="text-xs text-[#1A3226]/35">Usually takes 10–20 seconds</p>
        </div>
      </div>
    );
  }

  // ── STATE 2b: DEEP SEARCH UI (shown after 15s) ─────────────────────────────
  if (fetchState === "deep_search_ui") {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-[#B8982F] mb-1">Step 4</p>
          <h2 className="text-xl font-semibold text-[#1A3226]" style={{ fontFamily: "Georgia, serif" }}>This property needs a deeper search</h2>
        </div>
        <div className="flex flex-col items-center justify-center py-12 space-y-4 text-center">
          <div className="text-4xl">🔍</div>
          <p className="text-sm text-[#1A3226]/70 max-w-md">
            Standard comparable sales searches came up short for this address. PropPrompt is running an extended research pass using AI to find the best available comparables.
          </p>
          <p className="text-xs text-[#1A3226]/40">This takes 30–60 seconds. Your report will be just as accurate — some properties simply require more research.</p>
          <div className="flex gap-2 mt-2">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-2.5 h-2.5 rounded-full bg-[#1A3226]/40 animate-pulse" style={{ animationDelay: `${i * 0.25}s` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── STATE 3: RESULTS ────────────────────────────────────────────────────────
  return (
    <div className="p-6 lg:p-8 space-y-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-[#B8982F] mb-1">Step 4</p>
        <h2 className="text-xl font-semibold text-[#1A3226]" style={{ fontFamily: "Georgia, serif" }}>Review Comparable Sales</h2>
      </div>

      {/* Cache banner */}
      {fromCache && cacheDate && (
        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 text-xs text-blue-800">
          <span className="flex items-center gap-1.5"><Info className="w-3.5 h-3.5" /> Showing saved results from {cacheDate.toLocaleDateString()}.</span>
          <button onClick={() => handleFetch(true)} className="flex items-center gap-1 text-blue-600 underline hover:text-blue-800">
            <RefreshCw className="w-3 h-3" /> Refresh →
          </button>
        </div>
      )}

      {/* Researcher note */}
      {researcherNote && (
        <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-800">ℹ️ {researcherNote}</p>
        </div>
      )}

      {/* Error / no results */}
      {errorMsg && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-300 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">{errorMsg}</p>
        </div>
      )}

      {/* Count heading */}
      {allComps.length > 0 && (
        <p className="text-sm text-[#1A3226]/60">
          PropPrompt found <strong>{comps.length}</strong> recent sale{comps.length !== 1 ? "s" : ""} near {intake.address}.
          Review and confirm the comps to use in your analysis.
          {searchMeta.tier && <span className="text-xs text-[#1A3226]/35 ml-1">(Tier {searchMeta.tier}{searchMeta.radius ? `, ${searchMeta.radius}mi` : ""})</span>}
        </p>
      )}

      {/* Comp table */}
      {allComps.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-[#1A3226]/10">
          <table className="w-full text-xs">
            <thead className="bg-[#FAF8F4] border-b border-[#1A3226]/10">
              <tr>
                <th className="px-3 py-2.5 text-left font-medium text-[#1A3226]/50 w-8"></th>
                <th className="px-3 py-2.5 text-left font-medium text-[#1A3226]/50">Address</th>
                <th className="px-3 py-2.5 text-right font-medium text-[#1A3226]/50">Price</th>
                <th className="px-3 py-2.5 text-center font-medium text-[#1A3226]/50">Date</th>
                <th className="px-3 py-2.5 text-center font-medium text-[#1A3226]/50">Bed/Bath/SF</th>
                <th className="px-3 py-2.5 text-right font-medium text-[#1A3226]/50">$/SF</th>
                <th className="px-3 py-2.5 text-center font-medium text-[#1A3226]/50">Verify</th>
                <th className="px-3 py-2.5 text-center font-medium text-[#1A3226]/50">Condition</th>
                <th className="px-3 py-2.5 text-left font-medium text-[#1A3226]/50">Notes</th>
                <th className="px-3 py-2.5 w-6"></th>
              </tr>
            </thead>
            <tbody>
              {allComps.map((comp, idx) => (
                <tr key={comp.address + idx} className={`border-b border-[#1A3226]/5 ${!selected.has(comp.address) ? "opacity-40" : ""}`}>
                  <td className="px-3 py-2.5">
                    <input type="checkbox" checked={selected.has(comp.address)} onChange={() => toggleComp(comp.address)} className="w-4 h-4 accent-[#1A3226] cursor-pointer" />
                  </td>
                  <td className="px-3 py-2.5 font-medium text-[#1A3226] max-w-[160px] truncate" title={comp.address}>{comp.address}</td>
                  <td className="px-3 py-2.5 text-right text-[#1A3226]">{fmt(comp.sale_price)}</td>
                  <td className="px-3 py-2.5 text-center text-[#1A3226]/60">{comp.sale_date ? comp.sale_date.slice(0, 7) : "—"}</td>
                  <td className="px-3 py-2.5 text-center text-[#1A3226]/60">{comp.bedrooms || "—"}/{comp.bathrooms || "—"}/{comp.sqft?.toLocaleString() || "—"}</td>
                  <td className="px-3 py-2.5 text-right text-[#1A3226]/60">{comp.price_per_sqft ? `$${comp.price_per_sqft}` : "—"}</td>
                  <td className="px-3 py-2.5 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <VarianceBadge comp={comp} />
                      {comp.listing_url && (
                        <a href={comp.listing_url} target="_blank" rel="noopener noreferrer" className="text-[#1A3226]/40 hover:text-[#1A3226]">
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <select
                      value={conditionMap[comp.address] || "Similar"}
                      onChange={e => setConditionMap(prev => ({ ...prev, [comp.address]: e.target.value }))}
                      className="text-xs border border-[#1A3226]/15 rounded px-1.5 py-1 bg-white"
                    >
                      {CONDITIONS.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2.5">
                    <input
                      type="text"
                      value={notesMap[comp.address] !== undefined ? notesMap[comp.address] : (comp.agent_notes || "")}
                      onChange={e => setNotesMap(prev => ({ ...prev, [comp.address]: e.target.value.slice(0, 80) }))}
                      placeholder="Optional note…"
                      className="text-xs border border-[#1A3226]/15 rounded px-2 py-1 w-28 focus:outline-none focus:ring-1 focus:ring-[#1A3226]/20"
                    />
                  </td>
                  <td className="px-2">
                    {comp.source === "agent_manual" && (
                      <button onClick={() => { setManualComps(prev => prev.filter(c => c.address !== comp.address)); setSelected(prev => { const n = new Set(prev); n.delete(comp.address); return n; }); }} className="text-red-400 hover:text-red-600">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Count banners */}
      {selectedCount === 0 && allComps.length > 0 && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">⚠️ No comps selected. Include at least 3 comps to generate a defensible valuation.</p>
        </div>
      )}
      {selectedCount > 0 && selectedCount <= 2 && (
        <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5">
          <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-800">ℹ️ Low comp count. 3+ comps produce a more reliable valuation range.</p>
        </div>
      )}
      {allComps.length === 0 && !errorMsg && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-4">
          <p className="text-xs text-amber-800 font-medium mb-1">No comparable sales were found automatically for this address.</p>
          <p className="text-xs text-amber-700">This can happen for new construction, rural properties, or unusual property types. Add comps manually from your MLS or registry of deeds.</p>
        </div>
      )}

      {/* Manual add */}
      <div className="border border-[#1A3226]/10 rounded-xl overflow-hidden">
        <button onClick={() => setShowManual(v => !v)} className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-[#1A3226]/70 hover:bg-[#FAF8F4] transition-colors">
          <span className="flex items-center gap-2"><Plus className="w-4 h-4" /> Add a comp manually</span>
          <span className="text-xs text-[#1A3226]/30">{showManual ? "▲" : "▼"}</span>
        </button>
        {showManual && (
          <div className="border-t border-[#1A3226]/10 p-4 space-y-3 bg-[#FAF8F4]/50">
            <div>
              <label className="text-xs text-[#1A3226]/50 mb-1 block">Address <span className="text-red-400">*</span></label>
              <input type="text" value={manual.address} onChange={e => setManual(p => ({ ...p, address: e.target.value }))} placeholder="123 Main St, Revere, MA 02151" className="w-full text-sm border border-[#1A3226]/15 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#1A3226]/30" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { key: "sale_price", label: "Sale Price *", placeholder: "$950,000" },
                { key: "sale_date", label: "Sale Date *", placeholder: "2026-01-15", type: "date" },
                { key: "sqft", label: "Sq Ft", placeholder: "1200", type: "number" },
                { key: "bedrooms", label: "Beds", placeholder: "3", type: "number" },
                { key: "bathrooms", label: "Baths", placeholder: "2", type: "number" },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs text-[#1A3226]/50 mb-1 block">{f.label}</label>
                  <input type={f.type || "text"} value={manual[f.key]} onChange={e => setManual(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} className="w-full text-sm border border-[#1A3226]/15 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#1A3226]/30" />
                </div>
              ))}
            </div>
            <div>
              <label className="text-xs text-[#1A3226]/50 mb-1 block">Notes (optional)</label>
              <input type="text" value={manual.notes} onChange={e => setManual(p => ({ ...p, notes: e.target.value }))} placeholder="e.g. same street, slightly smaller" className="w-full text-sm border border-[#1A3226]/15 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#1A3226]/30" />
            </div>
            <Button onClick={addManualComp} disabled={!manual.address || !manual.sale_price || !manual.sale_date} size="sm" className="bg-[#1A3226] text-white hover:bg-[#1A3226]/90">
              Add Comp
            </Button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-[#1A3226]/8 pt-5">
        <button onClick={onBack} className="px-5 py-2.5 rounded-xl border border-[#1A3226]/15 text-sm font-medium text-[#1A3226]/60 hover:text-[#1A3226] hover:border-[#1A3226]/30 transition-all">← Back</button>
        <button onClick={handleConfirm} className="px-6 py-2.5 rounded-xl bg-[#1A3226] text-white text-sm font-semibold hover:bg-[#1A3226]/90 transition-all shadow-sm">
          Confirm Comps & Continue →
        </button>
      </div>
    </div>
  );
}