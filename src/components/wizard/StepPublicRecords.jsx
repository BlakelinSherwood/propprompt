import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, CheckCircle2, AlertCircle, RefreshCw, ChevronRight } from "lucide-react";
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
    setErrorMsg(null);

    try {
      const res = await base44.functions.invoke("searchPublicRecords", {
        address: intake.address,
        state,
        force_refresh: forceRefresh,
      });

      const rec = res.data?.record;
      if (!rec) throw new Error("No record returned");

      setRecord(rec);
      setStatus(rec.search_status === "found" ? "found" : rec.search_status === "partial" ? "partial" : "not_found");

      // Pre-fill attribute fields from public record (only if not already set by user)
      const newBeds = rec.bedrooms ?? intake.bedrooms ?? "";
      const newBaths = rec.bathrooms ?? intake.bathrooms ?? "";
      const newSqft = rec.sqft ?? intake.sqft ?? "";
      const newYearBuilt = rec.year_built ?? intake.year_built ?? "";

      setBeds(newBeds);
      setBaths(newBaths);
      setSqft(newSqft);
      setYearBuilt(newYearBuilt);

      // Push financial data into intake for use in other steps
      update({
        bedrooms: newBeds || null,
        bathrooms: newBaths || null,
        sqft: newSqft || null,
        year_built: newYearBuilt || null,
        prior_sale_price: rec.last_sale_price ?? intake.prior_sale_price ?? null,
        prior_sale_year: rec.last_sale_date ? new Date(rec.last_sale_date).getFullYear() : intake.prior_sale_year ?? null,
        public_record_id: rec.id,
      });
    } catch (e) {
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
            <p className="text-xs text-[#1A3226]/50">Checking assessor database, deed history, and mortgage records</p>
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

      {/* Financial Snapshot (if record found) */}
      {record && (record.last_sale_price || record.assessed_value || record.original_mortgage_amount) && (
        <div className="border border-[#1A3226]/10 rounded-xl p-4 mb-6 space-y-2.5">
          <p className="text-xs font-semibold text-[#1A3226]/60 uppercase tracking-wider mb-1">Financial Data Found</p>

          {record.last_sale_price && (
            <div className="flex justify-between text-sm">
              <span className="text-[#1A3226]/60">Last Sale</span>
              <span className="font-semibold text-[#1A3226]">
                {fmt(record.last_sale_price)} {record.last_sale_date && <span className="font-normal text-[#1A3226]/50">({fmtDate(record.last_sale_date)})</span>}
              </span>
            </div>
          )}

          {record.assessed_value && (
            <div className="flex justify-between text-sm">
              <span className="text-[#1A3226]/60">Assessed Value</span>
              <span className="font-semibold text-[#1A3226]">
                {fmt(record.assessed_value)} <span className="font-normal text-[#1A3226]/50">({record.assessed_year})</span>
              </span>
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
              <span className="text-[#1A3226]/60">Recorded Mortgage</span>
              <span className="font-semibold text-[#1A3226]">
                {fmt(record.original_mortgage_amount)}
                {record.original_mortgage_lender && <span className="font-normal text-[#1A3226]/50 ml-1">— {record.original_mortgage_lender}</span>}
              </span>
            </div>
          )}

          {record.owner_of_record && (
            <div className="flex justify-between text-sm">
              <span className="text-[#1A3226]/60">Owner of Record</span>
              <span className="font-semibold text-[#1A3226]">{record.owner_of_record}</span>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-[#1A3226]/40 mb-6">
        Data sourced from public assessor and registry of deeds records. Confirm or correct any values before proceeding.
      </p>

      <WizardNav step={3.5} onNext={() => { applyOverrides(); onNext(); }} onBack={onBack} canNext={canNext} nextLabel="Confirm & Continue" />
    </div>
  );
}