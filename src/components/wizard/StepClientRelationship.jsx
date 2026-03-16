import WizardShell from "./WizardShell";
import { ArrowUpRight, ArrowDownLeft, TrendingUp, Briefcase } from "lucide-react";

const CLIENT_TYPES = [
  {
    id: "seller",
    label: "Seller Client",
    icon: ArrowUpRight,
    description: "You represent the seller. Analysis will focus on pricing strategy, listing position, and offer optimization.",
    tip: "Activates AVM calibration and listing strategy modules.",
  },
  {
    id: "buyer",
    label: "Buyer Client",
    icon: ArrowDownLeft,
    description: "You represent the buyer. Analysis will focus on offer intelligence, archetype comparison, and market position.",
    tip: "Activates buyer intelligence and negotiation psychology modules.",
  },
  {
    id: "investor",
    label: "Investor Client",
    icon: TrendingUp,
    description: "Investor acquisition, disposition, or portfolio analysis. Income approach and 1031 exchange modules activated.",
    tip: "Activates all five multi-family valuation methods when applicable.",
  },
  {
    id: "internal",
    label: "Internal / Team Use",
    icon: Briefcase,
    description: "Training, market study, competitive analysis, or internal team research. No specific client relationship.",
    tip: "Standard analysis with all modules available. Not tied to an active transaction.",
  },
];

export default function StepClientRelationship({ form, update, next, back, canProceed }) {
  return (
    <WizardShell
      step={3}
      title="Client Relationship"
      subtitle="Who does this analysis serve? This calibrates the AI's framing, language, and module selection."
      onNext={next}
      onBack={back}
      canProceed={canProceed()}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {CLIENT_TYPES.map((c) => {
          const selected = form.client_relationship === c.id;
          const Icon = c.icon;
          return (
            <button
              key={c.id}
              onClick={() => update({ client_relationship: c.id })}
              className={`text-left p-5 rounded-xl border-2 transition-all
                ${selected
                  ? "border-[#1A3226] bg-[#1A3226]/[0.03] shadow-sm"
                  : "border-[#1A3226]/10 hover:border-[#1A3226]/30 hover:bg-[#FAF8F4]"
                }`}
            >
              <div className="flex items-start gap-3 mb-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
                  ${selected ? "bg-[#1A3226] text-white" : "bg-[#1A3226]/8 text-[#1A3226]/40"}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-semibold ${selected ? "text-[#1A3226]" : "text-[#1A3226]/80"}`}>
                    {c.label}
                  </p>
                </div>
                {selected && (
                  <div className="w-4 h-4 rounded-full bg-[#1A3226] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>
              <p className="text-xs text-[#1A3226]/60 leading-relaxed mb-2">{c.description}</p>
              <p className={`text-[11px] italic ${selected ? "text-[#B8982F]" : "text-[#1A3226]/30"}`}>
                {c.tip}
              </p>
            </button>
          );
        })}
      </div>
    </WizardShell>
  );
}