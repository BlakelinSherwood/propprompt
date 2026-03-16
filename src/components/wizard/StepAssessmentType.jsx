import WizardShell from "./WizardShell";
import { TrendingUp, Users, Building2, BarChart2, Home, DollarSign } from "lucide-react";

const ASSESSMENT_TYPES = [
  {
    id: "listing_pricing",
    label: "Listing Pricing",
    icon: TrendingUp,
    description: "Defensible price range for a seller listing. Comps, AVM calibration, valuation convergence.",
  },
  {
    id: "buyer_intelligence",
    label: "Buyer Intelligence",
    icon: Users,
    description: "Archetype analysis, migration matrix, offer strategy, and negotiation psychology report.",
  },
  {
    id: "investment_analysis",
    label: "Investment Analysis",
    icon: DollarSign,
    description: "Cap rate, GRM, cash-on-cash return, 1031 exchange intel, and pro forma projection.",
  },
  {
    id: "cma",
    label: "Comparative Market Analysis",
    icon: BarChart2,
    description: "Full three-tier comp analysis with temporal adjustments and convergence range.",
  },
  {
    id: "rental_analysis",
    label: "Rental Analysis",
    icon: Building2,
    description: "Market rent estimation, rent control disclosure, vacancy rate, and income potential.",
  },
  {
    id: "listing_strategy",
    label: "Listing Strategy",
    icon: Home,
    description: "Attribute alignment grid, archetype targeting, channel allocation, and timing recommendation.",
  },
];

export default function StepAssessmentType({ form, update, next, back, canProceed }) {
  return (
    <WizardShell
      step={2}
      title="Assessment Type"
      subtitle="Select the type of analysis you need. Each type activates a different PropPrompt module set."
      onNext={next}
      onBack={back}
      canProceed={canProceed()}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ASSESSMENT_TYPES.map((t) => {
          const selected = form.assessment_type === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => update({ assessment_type: t.id })}
              className={`text-left p-4 rounded-xl border-2 transition-all
                ${selected
                  ? "border-[#1A3226] bg-[#1A3226]/[0.03] shadow-sm"
                  : "border-[#1A3226]/10 hover:border-[#1A3226]/30 hover:bg-[#FAF8F4]"
                }`}
            >
              <div className="flex items-start gap-3 mb-2">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0
                  ${selected ? "bg-[#1A3226] text-white" : "bg-[#1A3226]/8 text-[#1A3226]/50"}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold leading-tight ${selected ? "text-[#1A3226]" : "text-[#1A3226]/80"}`}>
                    {t.label}
                  </p>
                </div>
                {selected && (
                  <div className="w-4 h-4 rounded-full bg-[#1A3226] flex items-center justify-center flex-shrink-0">
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>
              <p className="text-[11px] text-[#1A3226]/50 leading-relaxed">{t.description}</p>
            </button>
          );
        })}
      </div>
    </WizardShell>
  );
}