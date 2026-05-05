import { useState, useEffect } from "react";
import { Loader2, AlertCircle, CheckCircle2, Search } from "lucide-react";
import { base44 } from "@/api/base44Client";
import WizardShell from "./WizardShell";

export default function StepMortgageResearch({ intake, update, onNext, onBack }) {
  const [researching, setResearching] = useState(false);
  const [researchError, setResearchError] = useState(null);
  const [mortgageData, setMortgageData] = useState(intake.mortgage_research_data || null);
  const [manualPayoff, setManualPayoff] = useState(
    intake.seller_mortgage_payoff ? String(intake.seller_mortgage_payoff) : ""
  );
  const [manualMode, setManualMode] = useState(!mortgageData && !!intake.seller_mortgage_payoff);
  const [freeClear, setFreeClear] = useState(intake.seller_mortgage_payoff === 0 && intake.seller_mortgage_known);

  async function handleResearchMortgage() {
    if (!intake.address) {
      setResearchError("Property address is required to research mortgage data.");
      return;
    }

    setResearching(true);
    setResearchError(null);

    try {
      const res = await base44.functions.invoke('searchPublicRecords', {
        address: intake.address,
        state_code: intake.state_code || 'MA',
        include_mortgage_search: true
      });

      if (res?.data) {
        setMortgageData(res.data);
        // Auto-populate payoff if available
        if (res.data.estimated_mortgage_payoff) {
          setManualPayoff(String(res.data.estimated_mortgage_payoff));
        }
      } else {
        setResearchError("Could not retrieve mortgage data. You can enter the payoff amount manually below.");
      }
    } catch (err) {
      setResearchError(err?.message || "Failed to research mortgage data. Please try again.");
    } finally {
      setResearching(false);
    }
  }

  function saveAndNext() {
    const payoffValue = freeClear ? 0 : (manualPayoff ? parseFloat(manualPayoff.replace(/,/g, "")) : null);
    
    update({
      seller_mortgage_payoff: payoffValue,
      seller_mortgage_known: freeClear || (manualPayoff && !manualMode),
      mortgage_research_data: mortgageData,
    });
    onNext();
  }

  return (
    <WizardShell
      title="Mortgage & Closing Costs"
      subtitle="Step 5 — Research or enter mortgage payoff to estimate seller net proceeds"
      onNext={saveAndNext}
      onBack={onBack}
      nextLabel="Continue"
      canProceed={freeClear || !!manualPayoff}
    >
      <div className="space-y-6">
        {/* Info callout */}
        <div className="bg-[#1A3226]/5 border border-[#1A3226]/15 rounded-xl p-4">
          <p className="text-sm font-semibold text-[#1A3226] mb-1">Why this matters</p>
          <p className="text-xs text-[#1A3226]/60 leading-relaxed">
            The listing presentation will include a Section 05 with estimated seller net proceeds. Accurate mortgage payoff data ensures sellers see realistic take-home figures at different price points.
          </p>
        </div>

        {/* Free & Clear Toggle */}
        <div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={freeClear}
              onChange={e => {
                setFreeClear(e.target.checked);
                if (e.target.checked) {
                  setManualPayoff("");
                  setMortgageData(null);
                  setManualMode(false);
                }
              }}
              className="w-4 h-4 rounded accent-[#1A3226]"
            />
            <span className="text-sm font-semibold text-[#1A3226]">Property is owned free and clear (no mortgage)</span>
          </label>
        </div>

        {!freeClear && (
          <>
            {/* Research Option */}
            <div>
              <p className="text-sm font-semibold text-[#1A3226] mb-3">Option 1: Research Mortgage Data</p>
              <p className="text-xs text-[#1A3226]/60 mb-4">
                PropPrompt will search public records (deed registry, tax assessor, ATTOM data) to estimate the current mortgage payoff based on recorded loan documents.
              </p>
              <button
                onClick={handleResearchMortgage}
                disabled={researching}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-[#1A3226]/20 hover:border-[#B8982F]/50 hover:bg-[#FAF8F4] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {researching ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#1A3226]/40" />
                    <span className="text-sm font-medium text-[#1A3226]/60">Searching public records...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 text-[#1A3226]/40" />
                    <span className="text-sm font-medium text-[#1A3226]/60">Search Public Records for Mortgage Data</span>
                  </>
                )}
              </button>

              {researchError && (
                <div className="mt-3 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <p>{researchError}</p>
                </div>
              )}

              {mortgageData && (
                <div className="mt-4 bg-[#FAF8F4] border border-[#1A3226]/10 rounded-lg p-4 space-y-2">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <p className="font-semibold text-[#1A3226] mb-1">Mortgage data found:</p>
                      {mortgageData.original_mortgage_lender && (
                        <p className="text-[#1A3226]/70">
                          <span className="font-medium">Original lender:</span> {mortgageData.original_mortgage_lender}
                        </p>
                      )}
                      {mortgageData.most_recent_mortgage_amount && (
                        <p className="text-[#1A3226]/70">
                          <span className="font-medium">Original loan amount:</span> ${Number(mortgageData.most_recent_mortgage_amount).toLocaleString()}
                        </p>
                      )}
                      {mortgageData.mortgage_search_status && (
                        <p className="text-[#1A3226]/70">
                          <span className="font-medium">Search status:</span> {mortgageData.mortgage_search_status}
                        </p>
                      )}
                      {mortgageData.mortgage_search_notes && (
                        <p className="text-[#1A3226]/60 italic mt-1">{mortgageData.mortgage_search_notes}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Manual Entry Option */}
            <div className="border-t border-[#1A3226]/10 pt-6">
              <p className="text-sm font-semibold text-[#1A3226] mb-3">Option 2: Enter Payoff Manually</p>
              <p className="text-xs text-[#1A3226]/60 mb-4">
                If you already know the payoff amount, enter it here. Ask your seller to check with their lender for an accurate quote.
              </p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1A3226]/50 text-sm">$</span>
                <input
                  type="text"
                  value={manualPayoff}
                  onChange={e => {
                    setManualPayoff(e.target.value);
                    setManualMode(true);
                  }}
                  placeholder="e.g. 280,000"
                  className="w-full pl-7 pr-4 py-2.5 border border-[#1A3226]/20 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#1A3226]/30"
                />
              </div>
              {manualPayoff && (
                <label className="flex items-center gap-3 mt-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!manualMode}
                    onChange={e => setManualMode(!e.target.checked)}
                    className="w-4 h-4 rounded accent-[#1A3226]"
                  />
                  <span className="text-xs text-[#1A3226]/70">This amount is verified with the seller/lender</span>
                </label>
              )}
              {manualPayoff && manualMode && (
                <p className="text-xs text-amber-600 mt-2">
                  Unverified payoffs will be marked with an asterisk (*) in the PDF to remind you to confirm before sharing.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </WizardShell>
  );
}