import WizardShell from "./WizardShell";

const PLATFORMS = [
  {
    id: "claude",
    name: "Claude",
    by: "Anthropic",
    badge: "Recommended",
    badgeColor: "bg-[#B8982F]/15 text-[#B8982F]",
    description: "Best narrative output, complex nested logic, PPTX generation. Recommended for all PropPrompt analyses.",
    free: true,
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    by: "OpenAI",
    badge: null,
    description: "Strong structured output and code interpreter for financial tables. Excellent for spreadsheet-style analyses.",
    free: true,
  },
  {
    id: "gemini",
    name: "Gemini",
    by: "Google",
    badge: null,
    description: "Best real-time web grounding. Ideal when current MLS data context matters.",
    free: true,
  },
  {
    id: "perplexity",
    name: "Perplexity",
    by: "Perplexity AI",
    badge: "3-Message Flow",
    badgeColor: "bg-blue-50 text-blue-600",
    description: "Uses a 3-sequential-message protocol. Best for real-time market data retrieval.",
    free: true,
  },
  {
    id: "grok",
    name: "Grok",
    by: "xAI",
    badge: null,
    description: "Strong real-time data access via X. Good for sentiment and demand signal analysis.",
    free: true,
  },
];

export default function StepAIPlatform({ form, update, next, canProceed }) {
  return (
    <WizardShell
      step={1}
      title="Select AI Platform"
      subtitle="Choose the AI platform you'll use to run this analysis. Claude is pre-selected and recommended."
      onNext={next}
      canProceed={canProceed()}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PLATFORMS.map((p) => {
          const selected = form.ai_platform === p.id;
          return (
            <button
              key={p.id}
              onClick={() => update({ ai_platform: p.id })}
              className={`text-left p-4 rounded-xl border-2 transition-all group
                ${selected
                  ? "border-[#1A3226] bg-[#1A3226]/[0.03] shadow-sm"
                  : "border-[#1A3226]/10 hover:border-[#1A3226]/30 hover:bg-[#FAF8F4]"
                }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className={`text-sm font-semibold ${selected ? "text-[#1A3226]" : "text-[#1A3226]/80"}`}>
                    {p.name}
                  </p>
                  <p className="text-[11px] text-[#1A3226]/40">{p.by}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {p.badge && (
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${p.badgeColor}`}>
                      {p.badge}
                    </span>
                  )}
                  {selected && (
                    <div className="w-4 h-4 rounded-full bg-[#1A3226] flex items-center justify-center">
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-[#1A3226]/50 leading-relaxed">{p.description}</p>
            </button>
          );
        })}
      </div>
    </WizardShell>
  );
}