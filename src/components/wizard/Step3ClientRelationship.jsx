import WizardNav from "./WizardNav";

const CLIENT_RELATIONSHIPS = [
  {
    id: "listing_agent",
    title: "Listing Agent",
    icon: "🏠",
    description: "You represent the seller. Analysis optimizes for defensible list price, seller psychology, and listing strategy.",
  },
  {
    id: "buyer_agent",
    title: "Buyer's Agent",
    icon: "🤝",
    description: "You represent the buyer. Analysis focuses on offer calibration, competitive intelligence, and negotiation positioning.",
  },
  {
    id: "dual_agent",
    title: "Dual Agent / Facilitator",
    icon: "⚖️",
    description: "You represent both parties or are a transaction facilitator. Analysis presents balanced market data without advocacy.",
  },
  {
    id: "investor_advisor",
    title: "Investor Advisor",
    icon: "📈",
    description: "Client is an investor. Analysis emphasizes income approach, yield metrics, and risk-adjusted return analysis.",
  },
];

export default function Step3ClientRelationship({ intake, update, onNext, onBack }) {
  return (
    <div className="p-6 lg:p-8">
      <h2 className="text-lg font-semibold text-[#1A3226] mb-1" style={{ fontFamily: "Georgia, serif" }}>
        Client Relationship
      </h2>
      <p className="text-sm text-[#1A3226]/50 mb-6">
        Your role in this transaction determines how the AI frames its analysis and recommendations.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
        {CLIENT_RELATIONSHIPS.map((r) => {
          const selected = intake.client_relationship === r.id;
          return (
            <button
              key={r.id}
              onClick={() => update({ client_relationship: r.id })}
              className={`text-left rounded-xl border-2 p-5 transition-all
                ${selected ? "border-[#B8982F] bg-[#B8982F]/5" : "border-[#1A3226]/10 hover:border-[#1A3226]/20"}`}
            >
              <div className="mb-3 text-2xl">{r.icon}</div>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-[#1A3226] mb-1">{r.title}</p>
                  <p className="text-xs text-[#1A3226]/55 leading-relaxed">{r.description}</p>
                </div>
                <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5
                  ${selected ? "border-[#B8982F] bg-[#B8982F]" : "border-[#1A3226]/20"}`} />
              </div>
            </button>
          );
        })}
      </div>

      <WizardNav step={3} onNext={onNext} onBack={onBack} canNext={!!intake.client_relationship} />
    </div>
  );
}