import WizardNav from "./WizardNav";

const ASSESSMENT_TYPES = [
  {
    id: "listing_pricing",
    title: "Listing Pricing Analysis",
    icon: "📋",
    sublabel: "Full Appointment Package",
    description: "Full listing appointment package — CMA foundation, three pricing strategy scenarios, archetype demand profile for this property type, migration feeder markets, and a listing strategy narrative ready to present.",
    time: "~10 min",
  },
  {
    id: "buyer_intelligence",
    title: "Buyer Intelligence Report",
    icon: "🎯",
    description: "Archetype matching, migration patterns, offer strategy, and competitive positioning for a buyer client.",
    time: "~6 min",
  },
  {
    id: "cma",
    title: "Comparative Market Analysis",
    icon: "📊",
    sublabel: "Valuation",
    description: "Defensible valuation with three-tier comp structure, temporal adjustments, AVM gap analysis, and a price range report.",
    time: "~7 min",
  },
  {
    id: "client_portfolio",
    title: "Client Portfolio Analysis",
    icon: "🏠",
    sublabel: "For past clients — not actively selling",
    description: "A proactive equity and options report for past clients who own a home but aren't actively looking to sell.",
    time: "~8 min",
    badge: "Retention Tool",
  },
  {
    id: "investment_analysis",
    title: "Investment Analysis",
    icon: "📈",
    description: "Full income approach with cap rate, GRM, cash-on-cash return, and 5-year projection.",
    time: "~10 min",
  },
  {
    id: "rental_analysis",
    title: "Rental Market Analysis",
    icon: "🔑",
    description: "Rent range calibration, tenant demand profile, vacancy risk assessment, and rent control exposure check.",
    time: "~5 min",
  },
  {
    id: "custom",
    title: "Custom Analysis",
    icon: "✏️",
    description: "Build a custom report by combining any available analysis modules. You control what goes in.",
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
        {ASSESSMENT_TYPES.filter(a => a.id !== 'custom').map((a) => {
          const selected = intake.assessment_type === a.id;
          return (
            <button
              key={a.id}
              onClick={() => update({ assessment_type: a.id })}
              className={`text-left rounded-xl border-2 p-4 transition-all
                ${selected ? "border-[#1A3226] bg-[#1A3226]/5" : "border-[#1A3226]/10 hover:border-[#1A3226]/20"}`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl leading-none mt-0.5">{a.icon}</span>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-sm font-semibold text-[#1A3226]">{a.title}</span>
                      {a.sublabel && (
                        <p className="text-[10px] text-[#1A3226]/50 mt-0.5">{a.sublabel}</p>
                      )}
                    </div>
                    {a.badge && (
                      <span className={`text-[9px] px-2 py-1 rounded flex-shrink-0 font-medium
                        ${a.id === 'client_portfolio' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                        {a.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#1A3226]/55 leading-relaxed mt-1">{a.description}</p>
                  <p className="text-[10px] text-[#B8982F] mt-2 font-medium">{a.time}</p>
                </div>
                <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-1
                  ${selected ? "border-[#1A3226] bg-[#1A3226]" : "border-[#1A3226]/20"}`} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Custom Analysis - Full Width */}
      <div className="mb-8">
        <button
          onClick={() => update({ assessment_type: 'custom' })}
          className={`w-full text-left rounded-xl border-2 p-4 transition-all
            ${intake.assessment_type === 'custom' ? "border-[#1A3226] bg-[#1A3226]/5" : "border-[#1A3226]/10 hover:border-[#1A3226]/20"}`}
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl leading-none mt-0.5">✏️</span>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-[#1A3226]">Custom Analysis</span>
                <span className="text-[9px] px-2 py-1 rounded bg-blue-100 text-blue-700 font-medium">Advanced</span>
              </div>
              <p className="text-[10px] text-[#1A3226]/50 mt-0.5 mb-1">Compose your own report from any combination of modules</p>
              <p className="text-xs text-[#1A3226]/55 leading-relaxed">Build a custom report by combining any available analysis modules. For agents running hybrid scenarios — an investor who also wants rental upside, a seller considering rent-and-hold, a buyer comparing multiple markets.</p>
              <p className="text-[10px] text-[#B8982F] mt-2 font-medium">Varies</p>
            </div>
            <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-1
              ${intake.assessment_type === 'custom' ? "border-[#1A3226] bg-[#1A3226]" : "border-[#1A3226]/20"}`} />
          </div>
        </button>
      </div>

      <WizardNav step={2} onNext={onNext} onBack={onBack} canNext={!!intake.assessment_type} />
    </div>
  );
}