import WizardShell from "./WizardShell";
import { BarChart2, TrendingUp, Users, DollarSign, Building2, Home, Pencil } from "lucide-react";

const ASSESSMENT_TYPES = [
  {
    id: "listing_pricing",
    label: "Listing Pricing Analysis",
    icon: TrendingUp,
    sublabel: "Full Appointment Package",
    description: "Full listing appointment package — CMA foundation, three pricing strategy scenarios, archetype demand profile for this property type, migration feeder markets, and a listing strategy narrative ready to present.",
    time: "~10 min",
    row: 1,
    col: 1,
    tooltip: "Use this when you're preparing for a listing appointment. Includes the CMA plus strategy, archetypes, and migration — everything in one deliverable.",
    badge: null,
  },
  {
    id: "buyer_intelligence",
    label: "Buyer Intelligence Report",
    icon: Users,
    sublabel: null,
    description: "Archetype matching, migration patterns, offer strategy, and competitive positioning for a buyer client. Helps buyers understand the market they're entering and positions the agent as a strategic advisor.",
    time: "~6 min",
    row: 1,
    col: 2,
    tooltip: null,
    badge: null,
  },
  {
    id: "cma",
    label: "Comparative Market Analysis",
    icon: BarChart2,
    sublabel: "Valuation",
    description: "Defensible valuation with three-tier comp structure, temporal adjustments, AVM gap analysis, and a price range report. The foundational valuation tool — fast, clean, shareable.",
    time: "~7 min",
    row: 2,
    col: 1,
    tooltip: "Use this for quick valuations and internal pricing work.",
    badge: null,
  },
  {
    id: "client_portfolio",
    label: "Client Portfolio Analysis",
    icon: Home,
    sublabel: "For past clients — not actively selling",
    description: "A proactive equity and options report for past clients who own a home but aren't actively looking to sell. Shows current estimated value, equity position, and five actionable paths — designed to re-engage your sphere and position you as their ongoing advisor.",
    time: "~8 min",
    row: 2,
    col: 2,
    tooltip: "Send this to homeowners in your sphere to re-engage them with their equity story and their options.",
    badge: "Retention Tool",
  },
  {
    id: "investment_analysis",
    label: "Investment Analysis",
    icon: DollarSign,
    sublabel: null,
    description: "Full income approach with cap rate, GRM, cash-on-cash return, and 5-year projection. Covers single-family and multi-family. Includes rent range overlay and value-add ROI estimate.",
    time: "~10 min",
    row: 3,
    col: 1,
    tooltip: null,
    badge: null,
  },
  {
    id: "rental_analysis",
    label: "Rental Market Analysis",
    icon: Building2,
    sublabel: null,
    description: "Rent range calibration, tenant demand profile, vacancy risk assessment, and rent control exposure check. For landlord clients, rent-vs-sell decisions, and investment underwriting.",
    time: "~5 min",
    row: 3,
    col: 2,
    tooltip: null,
    badge: null,
  },
];

const CUSTOM_ANALYSIS = {
  id: "custom",
  label: "Custom Analysis",
  icon: Pencil,
  sublabel: "Compose your own report from any combination of modules",
  description: "Build a custom report by combining any available analysis modules. For agents running hybrid scenarios — an investor who also wants rental upside, a seller considering rent-and-hold, a buyer comparing multiple markets. You control what goes in.",
  time: "Varies",
  fullWidth: true,
  tooltip: "Not a blank prompt — a structured module builder. Pick what you need, we assemble a complete report.",
  badge: "Advanced",
};

export default function StepAssessmentType({ form, update, next, back, canProceed }) {
  const selected = form.assessment_type;

  return (
    <WizardShell
      step={2}
      title="Assessment Type"
      subtitle="Select the type of analysis you need. Each type activates a different PropPrompt module set."
      onNext={next}
      onBack={back}
      canProceed={canProceed()}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {ASSESSMENT_TYPES.map((t) => {
          const isSelected = selected === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => update({ assessment_type: t.id })}
              className={`text-left p-4 rounded-xl border-2 transition-all
                ${isSelected
                  ? "border-[#1A3226] bg-[#1A3226]/[0.03] shadow-sm"
                  : "border-[#1A3226]/10 hover:border-[#1A3226]/30 hover:bg-[#FAF8F4]"
                }`}
              title={t.tooltip}
            >
              <div className="flex items-start gap-3 mb-2">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0
                  ${isSelected ? "bg-[#1A3226] text-white" : "bg-[#1A3226]/8 text-[#1A3226]/50"}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold leading-tight ${isSelected ? "text-[#1A3226]" : "text-[#1A3226]/80"}`}>
                    {t.label}
                  </p>
                  {t.sublabel && (
                    <p className="text-[10px] text-[#1A3226]/50 mt-0.5">{t.sublabel}</p>
                  )}
                  {t.badge && (
                    <span className="inline-block mt-1 px-2 py-0.5 rounded text-[9px] font-medium bg-green-100 text-green-700">
                      {t.badge}
                    </span>
                  )}
                </div>
                {isSelected && (
                  <div className="w-4 h-4 rounded-full bg-[#1A3226] flex items-center justify-center flex-shrink-0">
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>
              <p className="text-[11px] text-[#1A3226]/50 leading-relaxed">{t.description}</p>
              <p className="text-[10px] text-[#B8982F] font-medium mt-2">{t.time}</p>
            </button>
          );
        })}
      </div>

      {/* Custom Analysis - Full Width */}
      <div className="mt-4">
        <button
          onClick={() => update({ assessment_type: CUSTOM_ANALYSIS.id })}
          className={`w-full text-left p-4 rounded-xl border-2 transition-all
            ${selected === CUSTOM_ANALYSIS.id
              ? "border-[#1A3226] bg-[#1A3226]/[0.03] shadow-sm"
              : "border-[#1A3226]/10 hover:border-[#1A3226]/30 hover:bg-[#FAF8F4]"
            }`}
          title={CUSTOM_ANALYSIS.tooltip}
        >
          <div className="flex items-start gap-3 mb-2">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0
              ${selected === CUSTOM_ANALYSIS.id ? "bg-[#1A3226] text-white" : "bg-[#1A3226]/8 text-[#1A3226]/50"}`}>
              <Pencil className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className={`text-sm font-semibold leading-tight ${selected === CUSTOM_ANALYSIS.id ? "text-[#1A3226]" : "text-[#1A3226]/80"}`}>
                  {CUSTOM_ANALYSIS.label}
                </p>
                <span className="inline-block px-2 py-0.5 rounded text-[9px] font-medium bg-blue-100 text-blue-700">
                  {CUSTOM_ANALYSIS.badge}
                </span>
              </div>
              <p className="text-[10px] text-[#1A3226]/50 mt-0.5">{CUSTOM_ANALYSIS.sublabel}</p>
            </div>
            {selected === CUSTOM_ANALYSIS.id && (
              <div className="w-4 h-4 rounded-full bg-[#1A3226] flex items-center justify-center flex-shrink-0">
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </div>
          <p className="text-[11px] text-[#1A3226]/50 leading-relaxed">{CUSTOM_ANALYSIS.description}</p>
          <p className="text-[10px] text-[#B8982F] font-medium mt-2">{CUSTOM_ANALYSIS.time}</p>
        </button>
      </div>
    </WizardShell>
  );
}