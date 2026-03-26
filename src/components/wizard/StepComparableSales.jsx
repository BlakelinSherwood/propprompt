import { useState } from "react";
import { Plus, X, AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import WizardShell from "./WizardShell";

const CONDITIONS = ["Superior", "Similar", "Inferior"];

const EMPTY_COMP = {
  address: "",
  sale_price: "",
  sale_date: "",
  sqft: "",
  bedrooms: "",
  bathrooms: "",
  condition: "Similar",
  agent_notes: "",
};

export default function StepComparableSales({ intake, update, onNext, onBack }) {
  const [comps, setComps] = useState(
    intake.agent_comps?.length > 0
      ? intake.agent_comps.map(c => ({ ...c, sale_price: c.sale_price || "", sqft: c.sqft || "", bedrooms: c.bedrooms || "", bathrooms: c.bathrooms || "" }))
      : []
  );
  const [showWarningConfirm, setShowWarningConfirm] = useState(false);

  function addComp() {
    if (comps.length >= 10) return;
    setComps(prev => [...prev, { ...EMPTY_COMP }]);
  }

  function removeComp(idx) {
    setComps(prev => prev.filter((_, i) => i !== idx));
  }

  function updateComp(idx, field, value) {
    setComps(prev => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  }

  function saveAndContinue(forceEmpty = false) {
    if (forceEmpty || comps.length === 0) {
      update({ agent_comps: [], comps_source: "none" });
    } else {
      const cleaned = comps.map(c => ({
        address: c.address,
        sale_price: c.sale_price ? Number(String(c.sale_price).replace(/[^0-9.]/g, "")) : null,
        sale_date: c.sale_date,
        sqft: c.sqft ? Number(c.sqft) : null,
        bedrooms: c.bedrooms ? Number(c.bedrooms) : null,
        bathrooms: c.bathrooms ? Number(c.bathrooms) : null,
        condition: c.condition,
        agent_notes: c.agent_notes || "",
      }));
      update({ agent_comps: cleaned, comps_source: "agent_provided" });
    }
    onNext();
  }

  function handleNext() {
    if (comps.length === 0 && !showWarningConfirm) {
      setShowWarningConfirm(true);
      return;
    }
    saveAndContinue();
  }

  const validComps = comps.filter(c => c.address && c.sale_price && c.sale_date);

  return (
    <WizardShell
      step={4}
      canProceed={true}
      onNext={handleNext}
      onBack={onBack}
      nextLabel={comps.length === 0 ? "Continue" : "Next →"}
    >
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-[#1A3226]" style={{ fontFamily: "Georgia, serif" }}>
            Add Your Comparable Sales
          </h2>
          <p className="text-sm text-[#1A3226]/60 mt-1">
            PropPrompt uses only verified comps you provide. We never generate or assume comparable sales.
          </p>
        </div>

        {/* Comp rows */}
        <div className="space-y-4">
          {comps.map((comp, idx) => (
            <div key={idx} className="relative rounded-xl border border-[#1A3226]/10 bg-[#FAF8F4]/50 p-4 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-[#1A3226]/50 uppercase tracking-wider">Comp {idx + 1}</span>
                <button onClick={() => removeComp(idx)} className="text-[#1A3226]/30 hover:text-red-500 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Address */}
              <div>
                <label className="text-xs text-[#1A3226]/50 mb-1 block">Address <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={comp.address}
                  onChange={e => updateComp(idx, "address", e.target.value)}
                  placeholder="78 Breeden Ln, Revere, MA 02151"
                  className="w-full text-sm border border-[#1A3226]/15 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#1A3226]/30"
                />
              </div>

              {/* Price / Date / SQFT */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-[#1A3226]/50 mb-1 block">Sale Price <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    value={comp.sale_price}
                    onChange={e => updateComp(idx, "sale_price", e.target.value)}
                    placeholder="$468,000"
                    className="w-full text-sm border border-[#1A3226]/15 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#1A3226]/30"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#1A3226]/50 mb-1 block">Sale Date <span className="text-red-400">*</span></label>
                  <input
                    type="date"
                    value={comp.sale_date}
                    onChange={e => updateComp(idx, "sale_date", e.target.value)}
                    className="w-full text-sm border border-[#1A3226]/15 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#1A3226]/30"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#1A3226]/50 mb-1 block">Sq Ft</label>
                  <input
                    type="number"
                    value={comp.sqft}
                    onChange={e => updateComp(idx, "sqft", e.target.value)}
                    placeholder="1,180"
                    className="w-full text-sm border border-[#1A3226]/15 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#1A3226]/30"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#1A3226]/50 mb-1 block">Beds</label>
                  <input
                    type="number"
                    value={comp.bedrooms}
                    onChange={e => updateComp(idx, "bedrooms", e.target.value)}
                    placeholder="3"
                    className="w-full text-sm border border-[#1A3226]/15 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#1A3226]/30"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#1A3226]/50 mb-1 block">Baths</label>
                  <input
                    type="number"
                    value={comp.bathrooms}
                    onChange={e => updateComp(idx, "bathrooms", e.target.value)}
                    placeholder="2"
                    className="w-full text-sm border border-[#1A3226]/15 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#1A3226]/30"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#1A3226]/50 mb-1 block">Condition vs. Subject</label>
                  <select
                    value={comp.condition}
                    onChange={e => updateComp(idx, "condition", e.target.value)}
                    className="w-full text-sm border border-[#1A3226]/15 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-[#1A3226]/30"
                  >
                    {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs text-[#1A3226]/50 mb-1 block">Agent Notes (optional, 100 chars)</label>
                <input
                  type="text"
                  value={comp.agent_notes}
                  onChange={e => updateComp(idx, "agent_notes", e.target.value.slice(0, 100))}
                  placeholder="same street, smaller lot"
                  className="w-full text-sm border border-[#1A3226]/15 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#1A3226]/30"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Add button */}
        {comps.length < 10 && (
          <Button
            variant="outline"
            onClick={addComp}
            className="w-full border-dashed border-[#1A3226]/20 text-[#1A3226]/60 hover:text-[#1A3226] hover:border-[#1A3226]/40 gap-2"
          >
            <Plus className="w-4 h-4" /> Add Another Comp
          </Button>
        )}

        {/* Info callout */}
        <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-800">
            Need help finding comps? Check your MLS, Redfin, or the county registry of deeds for recent sales within 0.5 miles and the past 12 months.
          </p>
        </div>

        {/* Low count info */}
        {comps.length >= 1 && comps.length <= 2 && (
          <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800">
              <strong>ℹ️ Low comp count.</strong> 3+ comps produce a more defensible valuation range. Consider adding more before generating.
            </p>
          </div>
        )}

        {/* Zero comp warning */}
        {comps.length === 0 && showWarningConfirm && (
          <div className="rounded-xl bg-amber-50 border border-amber-300 px-4 py-4 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-900">
                <strong>⚠️ No comps added.</strong> PropPrompt cannot generate a valuation without verified comparable sales. You can still continue, but the report will be flagged as insufficient data and PDF export will be blocked until comps are added.
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setShowWarningConfirm(false); addComp(); }}
                className="text-xs border-amber-400 text-amber-800 hover:bg-amber-100 gap-1"
              >
                <Plus className="w-3 h-3" /> Add Comps
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => saveAndContinue(true)}
                className="text-xs text-amber-700 hover:bg-amber-100"
              >
                Continue without comps — I understand
              </Button>
            </div>
          </div>
        )}
      </div>
    </WizardShell>
  );
}