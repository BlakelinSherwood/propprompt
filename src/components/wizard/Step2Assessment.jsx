import WizardNav from "./WizardNav";

const ASSESSMENT_TYPES = [
  {
    id: "listing_pricing",
    title: "Listing Pricing Analysis",
    icon: "🏷️",
    description: "Defensible CMA with three valuation methods, AVM bridging, and listing strategy narrative.",
    time: "~8 min",
  },
  {
    id: "buyer_intelligence",
    title: "Buyer Intelligence Report",
    icon: "🎯",
    description: "Archetype matching, migration data, offer strategy, and competitive positioning for a buyer client.",
    time: "~6 min",
  },
  {
    id: "investment_analysis",
    title: "Investment Analysis",
    icon: "📊",
    description: "Full income approach with cap rate, GRM, cash-on-cash, and 5-year projection. Multi-family & SFH.",
    time: "~10 min",
  },
  {
    id: "cma",
    title: "Comparative Market Analysis",
    icon: "📋",
    description: "Three-tier comp structure with temporal adjustments, AVM gap analysis, and price range report.",
    time: "~7 min",
  },
  {
    id: "rental_analysis",
    title: "Rental Market Analysis",
    icon: "🔑",
    description: "Rent range calibration, tenant demand profile, vacancy risk, and rent control exposure.",
    time: "~5 min",
  },
  {
    id: "custom",
    title: "Custom Analysis",
    icon: "✏️",
    description: "Build a custom prompt from available modules. For advanced users with specific research needs.",
    time: "Varies",
    badge: "Advanced",
  },
];

export default function Step2Assessment({ intake, update, onNext, onBack }) {
  return (
    <div className="p-6 lg:p-8">
      <h2 className="text-lg font-semibold text-[#1A3226] mb-1" style={{ fontFamily: "Georgia, serif" }}>
        Assessment Type
      </h2>
      <p className="text-sm text-[#1A3226]/50 mb-6">
        Select the type of analysis. Each activates a dedicated prompt module calibrated for that use case.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
        {ASSESSMENT_TYPES.map((a) => {
          const selected = intake.assessment_type === a.id;
          return (
            <button
              key={a.id}
              onClick={() => update({ assessment_type: a.id })}
              className={`text-left rounded-xl border-2 p-4 transition-all
                ${selected ? "border-[#B8982F] bg-[#B8982F]/5" : "border-[#1A3226]/10 hover:border-[#1A3226]/20"}`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl leading-none mt-0.5">{a.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-[#1A3226]">{a.title}</span>
                    {a.badge && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#1A3226]/5 text-[#1A3226]/50">
                        {a.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#1A3226]/55 leading-relaxed">{a.description}</p>
                  <p className="text-[10px] text-[#B8982F] mt-2 font-medium">{a.time}</p>
                </div>
                <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5
                  ${selected ? "border-[#B8982F] bg-[#B8982F]" : "border-[#1A3226]/20"}`} />
              </div>
            </button>
          );
        })}
      </div>

      <WizardNav step={2} onNext={onNext} onBack={onBack} canNext={!!intake.assessment_type} />
    </div>
  );
}