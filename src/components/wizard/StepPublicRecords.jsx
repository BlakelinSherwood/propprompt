import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, CheckCircle2, AlertCircle, RefreshCw, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import WizardNav from "./WizardNav";

function fmt(val) {
  if (!val) return "—";
  return "$" + Math.round(val).toLocaleString();
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

export default function StepPublicRecords({ intake, update, onNext, onBack }) {
  const [status, setStatus] = useState("idle"); // idle | loading | found | partial | not_found | error
  const [record, setRecord] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [mortgageSearching, setMortgageSearching] = useState(false);
  const isPortfolio = intake.assessment_type === "client_portfolio";

  // Editable overrides for property attributes
  const [beds, setBeds] = useState(intake.bedrooms || "");
  const [baths, setBaths] = useState(intake.bathrooms || "");
  const [sqft, setSqft] = useState(intake.sqft || "");
  const [yearBuilt, setYearBuilt] = useState(intake.year_built || "");

  const hasFetched = useRef(false);

  // Extract state from address
  function extractState(address) {
    const match = address.match(/,\s*([A-Z]{2})\s*\d{5}/);
    if (match) return match[1];
    const stateMatch = address.match(/\b(MA|ME|NH|VT)\b/i);
    if (stateMatch) return stateMatch[1].toUpperCase();
    return null;
  }

  async function fetchRecord(forceRefresh = false) {
    const state = extractState(intake.address);
    if (!state) {
      setStatus("error");
      setErrorMsg("Could not detect state from address. Please ensure address includes state (e.g. MA).");
      return;
    }

    setStatus("loading");
    setMortgageSearching(isPortfolio);
    setErrorMsg(null);

    try {
      const res = await base44.functions.invoke("searchPublicRecords", {
        address: intake.address,
        state,
        force_refresh: forceRefresh,
        include_mortgage_search: isPortfolio,
      });

      const rec = res.data?.record;
      if (!rec) throw new Error("No record returned");

      setRecord(rec);
      setMortgageSearching(false);
      setStatus(rec.search_status === "found" ? "found" : rec.search_status === "partial" ? "partial" : "not_found");

      const newBeds = rec.bedrooms ?? intake.bedrooms ?? "";
      const newBaths = rec.bathrooms ?? intake.bathrooms ?? "";
      const newSqft = rec.sqft ?? intake.sqft ?? "";
      const newYearBuilt = rec.year_built ?? intake.year_built ?? "";

      setBeds(newBeds);
      setBaths(newBaths);
      setSqft(newSqft);
      setYearBuilt(newYearBuilt);

      update({
        bedrooms: newBeds || null,
        bathrooms: newBaths || null,
        sqft: newSqft || null,
        year_built: newYearBuilt || null,
        prior_sale_price: rec.last_sale_price ?? intake.prior_sale_price ?? null,
        prior_sale_year: rec.last_sale_date ? new Date(rec.last_sale_date).getFullYear() : intake.prior_sale_year ?? null,
        public_record_id: rec.id,
        // Mortgage data for portfolio equity calc
        ...(rec.estimated_mortgage_payoff ? { seller_mortgage_payoff: rec.estimated_mortgage_payoff, seller_mortgage_known: false } : {}),
        ...(rec.estimated_total_debt ? { estimated_total_debt: rec.estimated_total_debt } : {}),
      });
    } catch (e) {
      setMortgageSearching(false);
      setStatus("error");
      setErrorMsg(e.message || "Search failed");
    }
  }

  useEffect(() => {
    if (!hasFetched.current && intake.address) {
      hasFetched.current = true;
      fetchRecord(false);
    }
  }, []);

  // Sync editable fields back to intake whenever they change
  function applyOverrides() {
    update({
      bedrooms: beds ? Number(beds) : null,
      bathrooms: baths ? Number(baths) : null,
      sqft: sqft ? Number(sqft) : null,
      year_built: yearBuilt ? Number(yearBuilt) : null,
    });
  }

  const canNext = status !== "loading";

  return (
    <div className="p-6 lg:p-8">
      <h2 className="text-lg font-semibold text-[#1A3226] mb-1" style={{ fontFamily: "Georgia, serif" }}>
        Public Records Lookup
      </h2>
      <p className="text-sm text-[#1A3226]/50 mb-6">
        We searched public records for <span className="font-medium text-[#1A3226]">{intake.address}</span>. Confirm or correct the property attributes below — they'll be used to find accurate comparable sales.
      </p>

      {/* Status Banner */}
      {status === "loading" && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-[#1A3226]/5 mb-6">
          <Loader2 className="w-5 h-5 text-[#1A3226] animate-spin flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-[#1A3226]">Searching public records…</p>
            <p className="text-xs text-[#1A3226]/50">
              {isPortfolio
                ? "Checking assessor database, deed history, mortgage recordings, refinances & liens — this takes 20–40 seconds"
                : "Checking assessor database, deed history, and mortgage records"}
            </p>
          </div>
        </div>
      )}

      {status === "found" && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200 mb-6">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-emerald-800">Public record found</p>
            {record?.owner_of_record && (
              <p className="text-xs text-emerald-700 mt-0.5">Owner of record: <span className="font-semibold">{record.owner_of_record}</span></p>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={() => fetchRecord(true)} className="text-xs gap-1 text-emerald-700">
            <RefreshCw className="w-3 h-3" /> Refresh
          </Button>
        </div>
      )}

      {status === "partial" && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 mb-6">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">Partial record found — some data may be missing</p>
            <p className="text-xs text-amber-700 mt-0.5">Please confirm the property attributes below manually.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => fetchRecord(true)} className="text-xs gap-1 text-amber-700">
            <RefreshCw className="w-3 h-3" /> Retry
          </Button>
        </div>
      )}

      {(status === "not_found" || status === "error") && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 mb-6">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">
              {status === "not_found" ? "No public record found" : "Search failed"}
            </p>
            <p className="text-xs text-red-700 mt-0.5">
              {errorMsg || "Please enter the property attributes manually below."}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => fetchRecord(true)} className="text-xs gap-1 text-red-700">
            <RefreshCw className="w-3 h-3" /> Retry
          </Button>
        </div>
      )}

      {/* Property Attribute Fields */}
      <div className="mb-6">
        <p className="text-xs font-semibold text-[#1A3226]/60 uppercase tracking-wider mb-3">
          Property Attributes <span className="normal-case font-normal text-[#1A3226]/40">(used for comp search)</span>
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-[#1A3226]/50 mb-1 block">Bedrooms</label>
            <Input
              type="number"
              placeholder="3"
              value={beds}
              onChange={e => { setBeds(e.target.value); }}
              onBlur={applyOverrides}
              className="border-[#1A3226]/15 focus-visible:ring-[#B8982F]/30 bg-white"
            />
          </div>
          <div>
            <label className="text-xs text-[#1A3226]/50 mb-1 block">Bathrooms</label>
            <Input
              type="number"
              step="0.5"
              placeholder="2"
              value={baths}
              onChange={e => { setBaths(e.target.value); }}
              onBlur={applyOverrides}
              className="border-[#1A3226]/15 focus-visible:ring-[#B8982F]/30 bg-white"
            />
          </div>
          <div>
            <label className="text-xs text-[#1A3226]/50 mb-1 block">Sq Ft</label>
            <Input
              type="number"
              placeholder="1,800"
              value={sqft}
              onChange={e => { setSqft(e.target.value); }}
              onBlur={applyOverrides}
              className="border-[#1A3226]/15 focus-visible:ring-[#B8982F]/30 bg-white"
            />
          </div>
          <div>
            <label className="text-xs text-[#1A3226]/50 mb-1 block">Year Built</label>
            <Input
              type="number"
              placeholder="1985"
              value={yearBuilt}
              onChange={e => { setYearBuilt(e.target.value); }}
              onBlur={applyOverrides}
              className="border-[#1A3226]/15 focus-visible:ring-[#B8982F]/30 bg-white"
            />
          </div>
        </div>
        {Number(sqft) >= 4000 && (
          <p className="text-xs text-[#B8982F] mt-2">★ Large property — comp search will use sqft-only matching</p>
        )}
      </div>

      {/* Financial Snapshot */}
      {record && (record.last_sale_price || record.assessed_value || record.original_mortgage_amount) && (
        <div className="border border-[#1A3226]/10 rounded-xl p-4 mb-5 space-y-2.5">
          <p className="text-xs font-semibold text-[#1A3226]/60 uppercase tracking-wider mb-1">Public Record — Financial Data</p>

          {record.last_sale_price && (
            <div className="flex justify-between text-sm">
              <span className="text-[#1A3226]/60">Last Sale</span>
              <span className="font-semibold text-[#1A3226]">
                {fmt(record.last_sale_price)}{record.last_sale_date && <span className="font-normal text-[#1A3226]/50 ml-1">({fmtDate(record.last_sale_date)})</span>}
              </span>
            </div>
          )}
          {record.assessed_value && (
            <div className="flex justify-between text-sm">
              <span className="text-[#1A3226]/60">Assessed Value</span>
              <span className="font-semibold text-[#1A3226]">{fmt(record.assessed_value)}<span className="font-normal text-[#1A3226]/50 ml-1">({record.assessed_year})</span></span>
            </div>
          )}
          {record.annual_property_tax && (
            <div className="flex justify-between text-sm">
              <span className="text-[#1A3226]/60">Annual Tax</span>
              <span className="font-semibold text-[#1A3226]">{fmt(record.annual_property_tax)}</span>
            </div>
          )}
          {record.original_mortgage_amount && (
            <div className="flex justify-between text-sm">
              <span className="text-[#1A3226]/60">Original Recorded Mortgage</span>
              <span className="font-semibold text-[#1A3226]">
                {fmt(record.original_mortgage_amount)}
                {record.original_mortgage_lender && <span className="font-normal text-[#1A3226]/50 ml-1">— {record.original_mortgage_lender}</span>}
                {record.original_mortgage_date && <span className="font-normal text-[#1A3226]/50 ml-1">({fmtDate(record.original_mortgage_date)})</span>}
              </span>
            </div>
          )}
          {record.most_recent_mortgage_amount && record.most_recent_mortgage_amount !== record.original_mortgage_amount && (
            <div className="flex justify-between text-sm">
              <span className="text-[#1A3226]/60">Most Recent Mortgage / Refi</span>
              <span className="font-semibold text-[#1A3226]">
                {fmt(record.most_recent_mortgage_amount)}
                {record.most_recent_mortgage_lender && <span className="font-normal text-[#1A3226]/50 ml-1">— {record.most_recent_mortgage_lender}</span>}
              </span>
            </div>
          )}
          {record.owner_of_record && (
            <div className="flex justify-between text-sm">
              <span className="text-[#1A3226]/60">Owner of Record</span>
              <span className="font-semibold text-[#1A3226]">{record.owner_of_record}</span>
            </div>
          )}
          {record.mortgage_discharged && (
            <div className="flex justify-between text-sm">
              <span className="text-[#1A3226]/60">Mortgage Status</span>
              <span className="text-emerald-700 font-semibold">✓ Discharged / Paid Off</span>
            </div>
          )}
          {record.liens_found && (
            <div className="flex justify-between text-sm">
              <span className="text-[#1A3226]/60">Additional Liens</span>
              <span className="text-red-700 font-semibold">⚠ {record.lien_details || "Liens found — see notes"}</span>
            </div>
          )}
        </div>
      )}

      {/* Mortgage Balance Estimate — Portfolio only */}
      {isPortfolio && (
        <div className="mb-5">
          {mortgageSearching && status === "loading" && (
            <div className="flex items-center gap-3 p-4 rounded-xl border border-[#B8982F]/30 bg-[#B8982F]/5">
              <Loader2 className="w-4 h-4 text-[#B8982F] animate-spin flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-[#1A3226]">Deep mortgage search in progress…</p>
                <p className="text-xs text-[#1A3226]/50">Searching registry of deeds for all recorded instruments, refinances & HELOCs via Perplexity AI</p>
              </div>
            </div>
          )}

          {record && (record.estimated_mortgage_payoff || record.heloc_amount) && (
            <div className="rounded-xl border border-[#1A3226]/15 bg-[#1A3226] p-4 space-y-2.5">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-4 h-4 text-[#B8982F]" />
                <p className="text-xs font-bold text-[#B8982F] uppercase tracking-wider">Estimated Mortgage Balance</p>
                <span className="ml-auto text-[10px] text-white/40 italic">AI-estimated from public records · verify with lender</span>
              </div>

              {record.estimated_mortgage_payoff && (
                <div className="flex justify-between text-sm">
                  <span className="text-white/70">Est. Primary Mortgage Payoff</span>
                  <span className="font-bold text-white text-base">{fmt(record.estimated_mortgage_payoff)}</span>
                </div>
              )}
              {record.heloc_amount && (
                <div className="flex justify-between text-sm">
                  <span className="text-white/70">HELOC / 2nd Mortgage</span>
                  <span className="font-semibold text-[#B8982F]">{fmt(record.heloc_amount)}{record.heloc_lender && <span className="font-normal text-white/50 ml-1">— {record.heloc_lender}</span>}</span>
                </div>
              )}
              {record.estimated_total_debt && (
                <div className="flex justify-between text-sm border-t border-white/10 pt-2 mt-1">
                  <span className="text-white/70 font-medium">Total Est. Debt on Property</span>
                  <span className="font-bold text-[#B8982F] text-base">{fmt(record.estimated_total_debt)}</span>
                </div>
              )}
              {record.mortgage_search_notes && (
                <p className="text-[10px] text-white/40 mt-1 italic">{record.mortgage_search_notes}</p>
              )}
            </div>
          )}

          {record && !record.estimated_mortgage_payoff && !mortgageSearching && (
            <div className="border border-[#1A3226]/10 rounded-xl p-3 text-xs text-[#1A3226]/50">
              <span className="font-medium text-[#1A3226]/70">Mortgage balance search:</span> No open mortgage instruments found in public records, or search returned insufficient data. The agent or seller can provide the current payoff amount directly.
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-[#1A3226]/40 mb-6">
        Data sourced from public assessor and registry of deeds records via AI web search. Mortgage balance estimates are calculated from recorded instruments and are approximations only — always verify with the lender before sharing with clients.
      </p>

      <WizardNav step={3.5} onNext={() => { applyOverrides(); onNext(); }} onBack={onBack} canNext={canNext} nextLabel="Confirm & Continue" />
    </div>
  );
}