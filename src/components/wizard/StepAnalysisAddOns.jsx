import { useState } from "react";
import WizardShell from "./WizardShell";
import { HelpCircle } from "lucide-react";

const ADDON_CONFIG = {
  listing_pricing: [
    {
      id: "archetype_listing_remarks",
      label: "Archetype Listing Remarks",
      description: "3 MLS remark variations (short, medium, long) written to appeal to the dominant archetype for this property and territory.",
      creditCost: 1,
    },
    {
      id: "value_add_recommendations",
      label: "Value-Add Recommendations",
      description: "Top improvements for this property type and territory with cost/ROI estimates.",
      creditCost: 1,
    },
  ],
  cma: [
    {
      id: "archetype_demand_layer",
      label: "Archetype Demand Layer",
      description: "Market demand profile for the dominant archetype in this territory.",
      creditCost: 1,
    },
    {
      id: "migration_pattern_layer",
      label: "Migration Pattern Layer",
      description: "Top 5 feeder metros sending buyers to this territory with trends and motivations.",
      creditCost: 1,
    },
  ],
  buyer_intelligence: [
    {
      id: "top_alternative_markets",
      label: "Top Alternative Markets",
      description: "3 comparable markets the buyer could consider at their price point.",
      creditCost: 1,
    },
  ],
  investment_analysis: [
    {
      id: "value_add_recommendations",
      label: "Value-Add Recommendations",
      description: "Top improvements for this property type and territory with cost/ROI estimates.",
      creditCost: 1,
    },
    {
      id: "rental_market_deep_dive",
      label: "Rental Market Deep Dive",
      description: "Detailed rental market analysis for investment yield comparison.",
      creditCost: 1,
    },
  ],
  rental_analysis: [],
  client_portfolio: [],
  custom: [],
};

export default function StepAnalysisAddOns({ form, update, next, back, canProceed }) {
  const assessmentType = form.assessment_type;
  const addOnsForType = ADDON_CONFIG[assessmentType] || [];
  const selectedAddOns = form.selected_addons || [];

  const toggleAddon = (addonId) => {
    const updated = selectedAddOns.includes(addonId)
      ? selectedAddOns.filter(id => id !== addonId)
      : [...selectedAddOns, addonId];
    update({ selected_addons: updated });
  };

  // Calculate total credits for display
  const totalAddonCredits = selectedAddOns.reduce((sum, id) => {
    const addon = addOnsForType.find(a => a.id === id);
    return sum + (addon?.creditCost || 0);
  }, 0);

  // Only show this step if there are add-ons available
  if (addOnsForType.length === 0) {
    // Skip directly to next step
    return null;
  }

  return (
    <WizardShell
      step={2.5}
      title="Optional Add-ons"
      subtitle={`Enhance your ${form.assessment_type.replace(/_/g, " ")} with additional analysis modules.`}
      onNext={next}
      onBack={back}
      canProceed={canProceed()}
    >
      <div className="space-y-3">
        {addOnsForType.map((addon) => {
          const isSelected = selectedAddOns.includes(addon.id);
          return (
            <button
              key={addon.id}
              onClick={() => toggleAddon(addon.id)}
              className={`w-full text-left p-4 rounded-xl border-2 transition-all
                ${isSelected
                  ? "border-[#1A3226] bg-[#1A3226]/[0.03]"
                  : "border-[#1A3226]/10 hover:border-[#1A3226]/30 hover:bg-[#FAF8F4]"
                }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5
                  ${isSelected
                    ? "border-[#1A3226] bg-[#1A3226]"
                    : "border-[#1A3226]/30"
                  }`}>
                  {isSelected && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-semibold ${isSelected ? "text-[#1A3226]" : "text-[#1A3226]/80"}`}>
                      {addon.label}
                    </p>
                    <span className="text-[10px] font-medium text-[#B8982F] bg-[#B8982F]/10 px-2 py-0.5 rounded">
                      +{addon.creditCost} credit
                    </span>
                  </div>
                  <p className="text-[11px] text-[#1A3226]/50 mt-1 leading-relaxed">
                    {addon.description}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {totalAddonCredits > 0 && (
        <div className="mt-6 p-3 rounded-lg bg-[#B8982F]/5 border border-[#B8982F]/20">
          <p className="text-xs text-[#1A3226] font-medium">
            Selected add-ons: <span className="font-bold text-[#B8982F]">+{totalAddonCredits} analysis credit{totalAddonCredits !== 1 ? 's' : ''}</span>
          </p>
        </div>
      )}

      <div className="mt-6 p-3 rounded-lg bg-blue-50 border border-blue-200 flex gap-2">
        <HelpCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-blue-900 leading-relaxed">
          Add-ons are optional. Each costs additional analysis credits. You can always add them later or proceed without them.
        </p>
      </div>
    </WizardShell>
  );
}