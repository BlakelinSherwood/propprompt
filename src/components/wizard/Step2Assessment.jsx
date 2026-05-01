import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import WizardNav from "./WizardNav";
import { ANALYSIS_MODULES } from "@/lib/analysisModules";

const PLATFORM_OWNER_ONLY_IDS = ['buyer_intelligence', 'cma', 'investment_analysis', 'rental_analysis', 'custom'];

const ASSESSMENT_TYPES = [
  {
    id: "listing_pricing",
    title: "Listing Pricing Analysis",
    icon: "📋",
    sublabel: "Full Appointment Package",
    description: "Full listing appointment package — CMA foundation, three pricing strategy scenarios, archetype demand profile for this property type, migration feeder markets, and a listing strategy narrative ready to present.",
    time: "~10 min",
    tooltip: "Use this when you're preparing for a listing appointment. Includes the CMA plus strategy, archetypes, and migration — everything in one deliverable.",
  },
  {
    id: "buyer_intelligence",
    title: "Buyer Intelligence Report",
    icon: "🎯",
    description: "Archetype matching, migration patterns, offer strategy, and competitive positioning for a buyer client.",
    time: "~6 min",
    tooltip: "Helps buyers understand the market they're entering and positions you as a strategic advisor.",
  },
  {
    id: "cma",
    title: "Comparative Market Analysis",
    icon: "📊",
    sublabel: "Valuation",
    description: "Defensible valuation with three-tier comp structure, temporal adjustments, AVM gap analysis, and a price range report.",
    time: "~7 min",
    tooltip: "Use this for quick valuations and internal pricing work. Fast, clean, shareable.",
  },
  {
    id: "client_portfolio",
    title: "Client Portfolio Analysis",
    icon: "🏠",
    sublabel: "For past clients — not actively selling",
    description: "A proactive equity and options report for past clients who own a home but aren't actively looking to sell.",
    time: "~8 min",
    badge: "Retention Tool",
    badgeColor: "green",
    tooltip: "Send this to homeowners in your sphere to re-engage them with their equity story and their options.",
    proOnly: true,
  },
  {
    id: "investment_analysis",
    title: "Investment Analysis",
    icon: "📈",
    description: "Full income approach with cap rate, GRM, cash-on-cash return, and 5-year projection.",
    time: "~10 min",
    tooltip: "Covers single-family and multi-family with rent range overlay and value-add ROI.",
    proOnly: true,
  },
  {
    id: "rental_analysis",
    title: "Rental Market Analysis",
    icon: "🔑",
    description: "Rent range calibration, tenant demand profile, vacancy risk assessment, and rent control exposure check.",
    time: "~5 min",
    tooltip: "For landlord clients, rent-vs-sell decisions, and investment underwriting.",
    proOnly: true,
  },
  {
    id: "custom",
    title: "Custom Analysis",
    icon: "✏️",
    description: "Build a custom report by combining any available analysis modules. You control what goes in.",
    time: "Varies",
    badge: "Advanced",
    badgeColor: "blue",
    tooltip: "Not a blank prompt — a structured module builder. Pick what you need, we assemble a complete report.",
    proOnly: true,
    modules: [
      "comp_valuation",
      "pricing_strategy_scenarios",
      "archetype_profile",
      "investment_metrics",
      "rent_range_analysis",
    ],
  },
];

export default function Step2Assessment({ intake, update, onNext, onBack, userTier, isPlatformOwner, user }) {
  const isStarter = !userTier || userTier === 'starter';

  // team_admin and team_agent can only run client_portfolio
  const isPortfolioOnly = ['team_admin', 'team_agent'].includes(user?.role);

  // Non-platform-owners see all types but restricted ones are greyed out (coming soon)
  // portfolioOnly users always see client_portfolio even if starter tier
  const availableTypes = ASSESSMENT_TYPES.filter(a => !a.proOnly || !isStarter || (isPortfolioOnly && a.id === 'client_portfolio'));
  const lockedTypes = isStarter ? ASSESSMENT_TYPES.filter(a => a.proOnly) : [];
  const standardTypes = availableTypes.filter(a => a.id !== 'custom');
  const customType = availableTypes.find(a => a.id === 'custom');

  return (
    <TooltipProvider>
      <div className="p-6 lg:p-8">
        <h2 className="text-lg font-semibold text-[#1A3226] mb-1" style={{ fontFamily: "Georgia, serif" }}>
          Assessment Type
        </h2>
        <p className="text-sm text-[#1A3226]/50 mb-6">
          Select the type of analysis. Each activates a dedicated prompt module calibrated for that use case.
        </p>

        {/* Grid: 2 columns, 3 rows of standard types */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
          {standardTypes.map((a) => {
            const selected = intake.assessment_type === a.id;
            const comingSoon = !isPlatformOwner && PLATFORM_OWNER_ONLY_IDS.includes(a.id);
            const roleRestricted = isPortfolioOnly && a.id !== 'client_portfolio';
            const isDisabled = comingSoon || roleRestricted;
            return (
              <button
                key={a.id}
                onClick={() => !isDisabled && update({ assessment_type: a.id })}
                disabled={isDisabled}
                className={`text-left rounded-xl border-2 p-4 transition-all relative
                  ${isDisabled ? "border-[#1A3226]/8 bg-[#1A3226]/[0.02] opacity-40 cursor-not-allowed" :
                    selected ? "border-[#1A3226] bg-[#1A3226]/5" : "border-[#1A3226]/10 hover:border-[#1A3226]/20"}`}
              >
                {comingSoon && (
                  <span className="absolute top-2 right-2 text-[9px] px-2 py-0.5 rounded-full bg-[#1A3226]/10 text-[#1A3226]/50 font-medium">
                    Coming Soon
                  </span>
                )}
                <div className="flex items-start gap-3">
                  <span className={`text-2xl leading-none mt-0.5 ${comingSoon ? 'grayscale' : ''}`}>{a.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[#1A3226]">{a.title}</span>
                          {!comingSoon && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="w-3.5 h-3.5 text-[#B8982F] flex-shrink-0 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs text-xs bg-[#1A3226] text-white border-0">
                                {a.tooltip}
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        {a.sublabel && (
                          <p className="text-[10px] text-[#1A3226]/50 mt-0.5">{a.sublabel}</p>
                        )}
                      </div>
                      {a.badge && !comingSoon && (
                        <span className={`text-[9px] px-2 py-1 rounded flex-shrink-0 font-medium whitespace-nowrap
                          ${a.badgeColor === 'green' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                          {a.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#1A3226]/55 leading-relaxed mt-1">{a.description}</p>
                    <p className="text-[10px] text-[#B8982F] mt-2 font-medium">{a.time}</p>
                  </div>
                  {!comingSoon && (
                    <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-1
                      ${selected ? "border-[#1A3226] bg-[#1A3226]" : "border-[#1A3226]/20"}`} />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Custom Analysis - Full Width */}
        {customType && (
          <div className="mb-8">
            {(() => {
              const comingSoon = !isPlatformOwner && PLATFORM_OWNER_ONLY_IDS.includes('custom');
              const isDisabledCustom = comingSoon || isPortfolioOnly;
              return (
            <button
              onClick={() => !isDisabledCustom && update({ assessment_type: 'custom' })}
              disabled={isDisabledCustom}
              className={`w-full text-left rounded-xl border-2 p-4 transition-all relative
                ${isDisabledCustom ? "border-[#1A3226]/8 bg-[#1A3226]/[0.02] opacity-40 cursor-not-allowed" :
                  intake.assessment_type === 'custom' ? "border-[#1A3226] bg-[#1A3226]/5" : "border-[#1A3226]/10 hover:border-[#1A3226]/20"}`}
              >
                {comingSoon && (
                  <span className="absolute top-2 right-2 text-[9px] px-2 py-0.5 rounded-full bg-[#1A3226]/10 text-[#1A3226]/50 font-medium">
                    Coming Soon
                  </span>
                )}
                <div className="flex items-start gap-3">
                <span className={`text-2xl leading-none mt-0.5 ${comingSoon ? 'grayscale' : ''}`}>{customType.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-[#1A3226]">{customType.title}</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="w-3.5 h-3.5 text-[#B8982F] flex-shrink-0 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs text-xs bg-[#1A3226] text-white border-0">
                        {customType.tooltip}
                      </TooltipContent>
                    </Tooltip>
                    <span className="text-[9px] px-2 py-1 rounded bg-blue-100 text-blue-700 font-medium">
                      {customType.badge}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#1A3226]/50 mb-1">Compose your own report from any combination of modules</p>

                  {/* Module Preview Strip */}
                  <div className="flex items-center gap-2 mb-2">
                    {customType.modules?.slice(0, 4).map((moduleId) => {
                      const module = ANALYSIS_MODULES[moduleId];
                      return module ? (
                        <Tooltip key={moduleId}>
                          <TooltipTrigger asChild>
                            <div className="w-8 h-8 rounded-full bg-[#B8982F]/20 flex items-center justify-center text-[10px] font-semibold text-[#B8982F] cursor-help flex-shrink-0">
                              {module.name.charAt(0)}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="text-xs bg-[#1A3226] text-white border-0">
                            {module.name}
                          </TooltipContent>
                        </Tooltip>
                      ) : null;
                    })}
                    {customType.modules && customType.modules.length > 4 && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="text-[9px] text-[#1A3226]/50 font-medium">+{customType.modules.length - 4} more</div>
                        </TooltipTrigger>
                        <TooltipContent className="text-xs bg-[#1A3226] text-white border-0">
                          {customType.modules.slice(4).map(id => ANALYSIS_MODULES[id]?.name).filter(Boolean).join(", ")}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>

                  <p className="text-xs text-[#1A3226]/55 leading-relaxed">{customType.description}</p>
                  <p className="text-[10px] text-[#B8982F] mt-2 font-medium">{customType.time}</p>
                </div>
                <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-1
                  ${intake.assessment_type === 'custom' ? "border-[#1A3226] bg-[#1A3226]" : "border-[#1A3226]/20"}`} />
              </div>
            </button>
              );
            })()}
          </div>
        )}

        {/* Locked types for Starter */}
        {lockedTypes.filter(a => a.id !== 'custom').length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-[#1A3226]/30 uppercase tracking-wider mb-2">Pro & Team only</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {lockedTypes.filter(a => a.id !== 'custom').map(a => (
                <div key={a.id} className="relative opacity-40 rounded-xl border-2 border-dashed border-[#1A3226]/15 p-4 cursor-not-allowed">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl leading-none mt-0.5 grayscale">{a.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-[#1A3226]">{a.title}</p>
                      <p className="text-xs text-[#1A3226]/50 mt-0.5">Upgrade to Pro or Team</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <WizardNav step={2} onNext={onNext} onBack={onBack} canNext={!!intake.assessment_type} />
      </div>
    </TooltipProvider>
  );
}