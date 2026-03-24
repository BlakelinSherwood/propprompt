import { useState } from "react";
import { DollarSign, Home } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import WizardShell from "./WizardShell";

const CLIENT_INTERESTS = [
  "Considering a HELOC",
  "Thinking about improvements",
  "May sell in 2-3 years",
  "Interested in rental property",
  "Considering an ADU",
  "Thinking about downsizing",
  "Exploring refinance options",
  "No specific plans",
];

export default function StepClientFinancial({ intake, update, onNext, onBack }) {
  const [mortgageSource, setMortgageSource] = useState(intake.mortgage_source || "approximate");

  const canNext = true; // All fields optional for portfolio analysis

  const handleInterestToggle = (interest) => {
    const current = intake.client_interests || [];
    const updated = current.includes(interest)
      ? current.filter(i => i !== interest)
      : [...current, interest];
    update({ client_interests: updated });
  };

  return (
    <WizardShell
      step={5}
      title="Client Financial Context"
      subtitle="This information improves the accuracy of the equity analysis. Estimates from public records are used for any fields left blank."
      onNext={onNext}
      onBack={onBack}
      canProceed={canNext}
    >
      <div className="space-y-6">
        {/* Mortgage Balance */}
        <div>
          <Label className="text-xs font-medium text-[#1A3226]/60 mb-2 block">
            Mortgage Balance
          </Label>
          <div className="relative mb-2">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1A3226]/30" />
            <Input
              type="number"
              placeholder="250000"
              value={intake.mortgage_balance || ""}
              onChange={(e) => update({ mortgage_balance: e.target.value ? parseFloat(e.target.value) : null })}
              className="pl-10 border-[#1A3226]/15 focus-visible:ring-[#B8982F]/30"
            />
          </div>
          <p className="text-[10px] text-[#1A3226]/40 mb-2">If known. Otherwise we estimate from public records.</p>
          <div className="flex gap-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={mortgageSource === "exact"}
                onCheckedChange={() => {
                  setMortgageSource("exact");
                  update({ mortgage_source: "exact" });
                }}
              />
              <span className="text-[#1A3226]/70">Exact (client provided)</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={mortgageSource === "approximate"}
                onCheckedChange={() => {
                  setMortgageSource("approximate");
                  update({ mortgage_source: "approximate" });
                }}
              />
              <span className="text-[#1A3226]/70">Approximate</span>
            </label>
          </div>
        </div>

        {/* Mortgage Rate */}
        <div>
          <Label className="text-xs font-medium text-[#1A3226]/60 mb-2 block">
            Mortgage Rate
          </Label>
          <div className="relative">
            <Input
              type="number"
              step="0.01"
              placeholder="3.25"
              value={intake.mortgage_rate || ""}
              onChange={(e) => update({ mortgage_rate: e.target.value ? parseFloat(e.target.value) : null })}
              className="pl-3 border-[#1A3226]/15 focus-visible:ring-[#B8982F]/30"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#1A3226]/40">%</span>
          </div>
          <p className="text-[10px] text-[#1A3226]/40 mt-1">The client's current mortgage interest rate.</p>
        </div>

        {/* Known Improvements */}
        <div>
          <Label className="text-xs font-medium text-[#1A3226]/60 mb-2 block">
            Known Improvements
          </Label>
          <textarea
            placeholder="e.g., Kitchen renovation ~$45K (2022), New roof ~$18K (2023)"
            value={intake.known_improvements || ""}
            onChange={(e) => update({ known_improvements: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-[#1A3226]/15 rounded-lg focus-visible:ring-1 focus-visible:ring-[#B8982F]/30 resize-none bg-white"
            rows={3}
          />
          <p className="text-[10px] text-[#1A3226]/40 mt-1">
            List renovations, additions, or major systems replacements with approximate cost and year. Write 'None' if unknown.
          </p>
        </div>

        {/* HELOC or Other Liens */}
        <div>
          <Label className="text-xs font-medium text-[#1A3226]/60 mb-2 block">
            HELOC or Other Liens
          </Label>
          <textarea
            placeholder="e.g., HELOC $50K at 7.5%, or write 'None'"
            value={intake.heloc_info || ""}
            onChange={(e) => update({ heloc_info: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-[#1A3226]/15 rounded-lg focus-visible:ring-1 focus-visible:ring-[#B8982F]/30 resize-none bg-white"
            rows={2}
          />
          <p className="text-[10px] text-[#1A3226]/40 mt-1">
            Any active HELOC, second mortgage, or other liens. Write 'None' if unknown — we check public records.
          </p>
        </div>

        {/* Client Interests */}
        <div>
          <Label className="text-xs font-medium text-[#1A3226]/60 mb-3 block">
            Client Interests
          </Label>
          <div className="space-y-2">
            {CLIENT_INTERESTS.map((interest) => (
              <label key={interest} className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={(intake.client_interests || []).includes(interest)}
                  onCheckedChange={() => handleInterestToggle(interest)}
                />
                <span className="text-sm text-[#1A3226]/70">{interest}</span>
              </label>
            ))}
          </div>
          <p className="text-[10px] text-[#1A3226]/40 mt-3">
            Select any that apply. This tailors which options are emphasized in the report.
          </p>
        </div>
      </div>
    </WizardShell>
  );
}