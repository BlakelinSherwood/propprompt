import { useState } from "react";
import WizardShell from "./WizardShell";

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1989 }, (_, i) => CURRENT_YEAR - i);

export default function StepPriorSaleHistory({ intake, update, onNext, onBack }) {
  const [skip, setSkip] = useState(false);
  const [priceRaw, setPriceRaw] = useState(
    intake.prior_sale_price != null ? String(intake.prior_sale_price) : ""
  );
  const [year, setYear] = useState(
    intake.prior_sale_year != null ? String(intake.prior_sale_year) : ""
  );

  function handleNext() {
    if (skip) {
      update({ prior_sale_price: null, prior_sale_year: null });
    } else {
      const price = priceRaw ? Number(String(priceRaw).replace(/[^0-9.]/g, "")) || null : null;
      const yr = year ? Number(year) : null;
      update({ prior_sale_price: price, prior_sale_year: yr });
    }
    onNext();
  }

  return (
    <WizardShell step={5} canProceed={true} onNext={handleNext} onBack={onBack} nextLabel="Next →">
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-[#1A3226]" style={{ fontFamily: "Georgia, serif" }}>
            Prior Sale History <span className="text-sm font-normal text-[#1A3226]/40">(Optional but Recommended)</span>
          </h2>
          <p className="text-sm text-[#1A3226]/60 mt-1">
            This helps PropPrompt catch valuation anomalies before the report reaches your client.
          </p>
        </div>

        {!skip && (
          <div className="space-y-5">
            {/* Last Known Sale Price */}
            <div>
              <label className="block text-sm font-medium text-[#1A3226] mb-1">
                Last Known Sale Price
              </label>
              <input
                type="text"
                value={priceRaw}
                onChange={e => setPriceRaw(e.target.value)}
                placeholder="$000,000"
                className="w-full text-sm border border-[#1A3226]/15 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-[#1A3226]/30"
              />
              <p className="text-xs text-[#1A3226]/45 mt-1">
                What did this property last sell for? Check the registry of deeds if unsure.
              </p>
            </div>

            {/* Year of Last Sale */}
            <div>
              <label className="block text-sm font-medium text-[#1A3226] mb-1">
                Year of Last Sale
              </label>
              <select
                value={year}
                onChange={e => setYear(e.target.value)}
                className="w-full text-sm border border-[#1A3226]/15 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-1 focus:ring-[#1A3226]/30"
              >
                <option value="">Select year…</option>
                {YEARS.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <p className="text-xs text-[#1A3226]/45 mt-1">
                Approximate year is fine if exact date is unknown.
              </p>
            </div>
          </div>
        )}

        {/* Skip checkbox */}
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={skip}
            onChange={e => setSkip(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-[#1A3226] cursor-pointer"
          />
          <span className="text-sm text-[#1A3226]/70 group-hover:text-[#1A3226] transition-colors">
            I don't know the prior sale history — skip this step
          </span>
        </label>
      </div>
    </WizardShell>
  );
}