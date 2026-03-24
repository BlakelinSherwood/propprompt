import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import WizardShell from "./WizardShell";

const BUYER_POOL_OPTIONS = [
  "Local move-up buyers",
  "Urban-to-suburban movers",
  "Out-of-state relocators",
  "Downsizers",
  "Investors",
  "First-time buyers",
  "Second-home buyers",
  "Not sure — let the AI determine",
];

const SELLING_ATTRIBUTES = [
  "Turnkey / Move-in Ready",
  "Water View",
  "Historic Character",
  "Large Lot",
  "Garage",
  "Walkability",
  "School District",
  "New Construction",
  "Income Potential",
  "ADU / In-Law Potential",
  "Transit Access",
  "Private / Secluded",
];

export default function StepBuyerIntelligence({ intake, update, onNext, onBack }) {
  const canNext = true; // All fields optional

  const handleBuyerPoolToggle = (option) => {
    const current = intake.buyer_pool_expectation || [];
    const updated = current.includes(option)
      ? current.filter(o => o !== option)
      : [...current, option];
    update({ buyer_pool_expectation: updated });
  };

  const handleAttributeToggle = (attr) => {
    const current = intake.key_selling_attributes || [];
    const updated = current.includes(attr)
      ? current.filter(a => a !== attr)
      : [...current, attr];
    update({ key_selling_attributes: updated });
  };

  return (
    <WizardShell
      step={5}
      title="Buyer Intelligence Context"
      subtitle="Optional context that improves migration and archetype accuracy. Skip if unknown."
      onNext={onNext}
      onBack={onBack}
      canProceed={canNext}
    >
      <div className="space-y-6">
        {/* Primary Buyer Pool Expectation */}
        <div>
          <Label className="text-xs font-medium text-[#1A3226]/60 mb-3 block">
            Primary Buyer Pool Expectation
          </Label>
          <div className="space-y-2">
            {BUYER_POOL_OPTIONS.map((option) => (
              <label key={option} className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={(intake.buyer_pool_expectation || []).includes(option)}
                  onCheckedChange={() => handleBuyerPoolToggle(option)}
                />
                <span className="text-sm text-[#1A3226]/70">{option}</span>
              </label>
            ))}
          </div>
          <p className="text-[10px] text-[#1A3226]/40 mt-3">
            Used as a weighting hint to guide archetype profiling.
          </p>
        </div>

        {/* Known Employer Draws */}
        <div>
          <Label className="text-xs font-medium text-[#1A3226]/60 mb-2 block">
            Known Employer Draws
          </Label>
          <textarea
            placeholder="e.g., Hospital 5 miles away, Tech park in next town"
            value={intake.known_employer_draws || ""}
            onChange={(e) => update({ known_employer_draws: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-[#1A3226]/15 rounded-lg focus-visible:ring-1 focus-visible:ring-[#B8982F]/30 resize-none bg-white"
            rows={3}
          />
          <p className="text-[10px] text-[#1A3226]/40 mt-1">
            Any major employers nearby that tend to drive buyer demand.
          </p>
        </div>

        {/* Key Selling Attributes */}
        <div>
          <Label className="text-xs font-medium text-[#1A3226]/60 mb-3 block">
            Key Selling Attributes
          </Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SELLING_ATTRIBUTES.map((attr) => (
              <label key={attr} className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={(intake.key_selling_attributes || []).includes(attr)}
                  onCheckedChange={() => handleAttributeToggle(attr)}
                />
                <span className="text-sm text-[#1A3226]/70">{attr}</span>
              </label>
            ))}
          </div>
          <p className="text-[10px] text-[#1A3226]/40 mt-3">
            These attributes are used to weight the archetype resonance scores in the analysis.
          </p>
        </div>
      </div>
    </WizardShell>
  );
}