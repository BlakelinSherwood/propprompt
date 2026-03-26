import { useState, useEffect } from "react";
import WizardShell from "./WizardShell";

export default function StepSellerFinancial({ intake, update, onNext, onBack }) {
  const [freeClear, setFreeClear] = useState(intake.seller_mortgage_payoff === 0 && intake.seller_mortgage_known === true && intake.seller_mortgage_payoff !== null);
  const [payoff, setPayoff] = useState(intake.seller_mortgage_payoff != null && intake.seller_mortgage_payoff !== 0 ? String(intake.seller_mortgage_payoff) : "");
  const [known, setKnown] = useState(intake.seller_mortgage_known || false);
  const [commission, setCommission] = useState(intake.seller_commission_rate != null ? String(intake.seller_commission_rate) : "5.0");
  const [closingRate, setClosingRate] = useState(intake.seller_closing_cost_rate != null ? String(intake.seller_closing_cost_rate) : "1.5");
  const [otherCosts, setOtherCosts] = useState(intake.seller_other_costs != null ? String(intake.seller_other_costs) : "0");

  function saveAndNext() {
    update({
      seller_mortgage_payoff: freeClear ? 0 : (payoff ? parseFloat(payoff.replace(/,/g, "")) : null),
      seller_mortgage_known: freeClear ? true : known,
      seller_commission_rate: commission ? parseFloat(commission) : 5.0,
      seller_closing_cost_rate: closingRate ? parseFloat(closingRate) : 1.5,
      seller_other_costs: otherCosts ? parseFloat(otherCosts.replace(/,/g, "")) : 0,
    });
    onNext();
  }

  function skip() {
    update({
      seller_mortgage_payoff: null,
      seller_mortgage_known: false,
      seller_commission_rate: null,
      seller_closing_cost_rate: null,
      seller_other_costs: null,
    });
    onNext();
  }

  return (
    <WizardShell
      title="Seller Financial Information"
      subtitle="Step 6 — Optional but highly recommended"
      onNext={saveAndNext}
      onBack={onBack}
      nextLabel="Continue"
      canProceed={true}
    >
      <div className="space-y-6">
        {/* Info callout */}
        <div className="bg-[#1A3226]/5 border border-[#1A3226]/15 rounded-xl p-4">
          <p className="text-sm font-semibold text-[#1A3226] mb-1">Estimated Seller Net Proceeds</p>
          <p className="text-xs text-[#1A3226]/60 leading-relaxed">
            These figures are calculated by PropPrompt using deterministic math — not the AI. The net proceeds table will appear in Section 05 of the PDF.
          </p>
        </div>

        {/* Mortgage Payoff */}
        <div>
          <label className="block text-sm font-semibold text-[#1A3226] mb-1">
            Estimated mortgage payoff balance
          </label>
          <p className="text-xs text-[#1A3226]/50 mb-3">
            Ask your seller to check with their lender for an accurate payoff quote. An estimate is fine for now.
          </p>

          {/* Free and clear toggle */}
          <label className="flex items-center gap-3 mb-3 cursor-pointer">
            <input
              type="checkbox"
              checked={freeClear}
              onChange={e => {
                setFreeClear(e.target.checked);
                if (e.target.checked) { setPayoff(""); setKnown(true); }
              }}
              className="w-4 h-4 rounded accent-[#1A3226]"
            />
            <span className="text-sm text-[#1A3226]">Property is owned free and clear (no mortgage)</span>
          </label>

          {!freeClear && (
            <>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1A3226]/50 text-sm">$</span>
                <input
                  type="text"
                  value={payoff}
                  onChange={e => setPayoff(e.target.value)}
                  placeholder="e.g. 280,000"
                  className="w-full pl-7 pr-4 py-2.5 border border-[#1A3226]/20 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#1A3226]/30"
                />
              </div>
              <label className="flex items-center gap-3 mt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={known}
                  onChange={e => setKnown(e.target.checked)}
                  className="w-4 h-4 rounded accent-[#1A3226]"
                />
                <span className="text-xs text-[#1A3226]/70">Verified directly with seller or lender</span>
              </label>
              {!known && payoff && (
                <p className="text-xs text-amber-600 mt-1">
                  Unverified payoffs will be marked with an asterisk (*) in the PDF to remind you to confirm before sharing.
                </p>
              )}
            </>
          )}
        </div>

        {/* Commission Rate */}
        <div>
          <label className="block text-sm font-semibold text-[#1A3226] mb-1">
            Total commission rate (%)
          </label>
          <p className="text-xs text-[#1A3226]/50 mb-2">This is the total co-broke commission.</p>
          <div className="relative w-48">
            <input
              type="number"
              step="0.1"
              min="0"
              max="10"
              value={commission}
              onChange={e => setCommission(e.target.value)}
              className="w-full pr-7 pl-4 py-2.5 border border-[#1A3226]/20 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#1A3226]/30"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1A3226]/50 text-sm">%</span>
          </div>
        </div>

        {/* Closing Costs */}
        <div>
          <label className="block text-sm font-semibold text-[#1A3226] mb-1">
            Estimated closing costs (%)
          </label>
          <p className="text-xs text-[#1A3226]/50 mb-2">
            Standard MA closing costs run approximately 1.5% of sale price. Adjust if you know of specific additional costs.
          </p>
          <div className="relative w-48">
            <input
              type="number"
              step="0.1"
              min="0"
              max="10"
              value={closingRate}
              onChange={e => setClosingRate(e.target.value)}
              className="w-full pr-7 pl-4 py-2.5 border border-[#1A3226]/20 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#1A3226]/30"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1A3226]/50 text-sm">%</span>
          </div>
        </div>

        {/* Other Deductions */}
        <div>
          <label className="block text-sm font-semibold text-[#1A3226] mb-1">
            Other deductions <span className="font-normal text-[#1A3226]/50">(optional)</span>
          </label>
          <p className="text-xs text-[#1A3226]/50 mb-2">
            HOA transfer fee, outstanding liens, or any other known deductions.
          </p>
          <div className="relative w-48">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1A3226]/50 text-sm">$</span>
            <input
              type="text"
              value={otherCosts}
              onChange={e => setOtherCosts(e.target.value)}
              placeholder="0"
              className="w-full pl-7 pr-4 py-2.5 border border-[#1A3226]/20 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#1A3226]/30"
            />
          </div>
        </div>

        {/* Skip option */}
        <div className="border-t border-[#1A3226]/10 pt-4">
          <button
            onClick={skip}
            className="text-sm text-[#1A3226]/50 hover:text-[#1A3226] underline underline-offset-2 transition-colors"
          >
            Skip — I'll calculate net proceeds separately
          </button>
          <p className="text-xs text-[#1A3226]/40 mt-1">
            The net proceeds section will show an explanatory note instead of a blank table.
          </p>
        </div>
      </div>
    </WizardShell>
  );
}