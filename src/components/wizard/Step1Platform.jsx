import { Zap } from "lucide-react";
import WizardNav from "./WizardNav";

const PLATFORMS = [
  {
    id: "claude",
    name: "Claude (Anthropic)",
    description: "Advanced reasoning, great for complex analysis",
    icon: "🧠",
    recommended: true,
  },
  {
    id: "chatgpt",
    name: "ChatGPT (OpenAI)",
    description: "Fast, reliable, excellent all-purpose model",
    icon: "✨",
  },
  {
    id: "gemini",
    name: "Gemini (Google)",
    description: "Multimodal understanding, strong math & logic",
    icon: "🌟",
  },
  {
    id: "perplexity",
    name: "Perplexity AI",
    description: "Research-focused with internet access",
    icon: "🔍",
  },
  {
    id: "grok",
    name: "Grok (xAI)",
    description: "Real-time information, edgy analysis",
    icon: "⚡",
  },
];

export default function Step1Platform({ intake, update, onNext, onBack }) {
  const canProceed = !!intake.ai_platform;

  return (
    <div className="p-8 space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-[#1A3226] mb-2">
          Select AI Platform
        </h2>
        <p className="text-sm text-[#1A3226]/60">
          Choose which AI model will power your analysis.
        </p>
      </div>

      <div className="space-y-3">
        {PLATFORMS.map((platform) => (
          <button
            key={platform.id}
            onClick={() => update({ ai_platform: platform.id })}
            className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
              intake.ai_platform === platform.id
                ? "border-[#1A3226] bg-[#1A3226]/5"
                : "border-[#1A3226]/10 hover:border-[#1A3226]/20 bg-white"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                <span className="text-2xl mt-0.5">{platform.icon}</span>
                <div>
                  <div className="font-semibold text-[#1A3226] flex items-center gap-2">
                    {platform.name}
                    {platform.recommended && (
                      <span className="text-xs bg-[#B8982F] text-white px-2 py-0.5 rounded-full">
                        Recommended
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#1A3226]/60 mt-0.5">
                    {platform.description}
                  </p>
                </div>
              </div>
              <div
                className={`w-5 h-5 rounded-full border-2 mt-1 flex-shrink-0 transition-all ${
                  intake.ai_platform === platform.id
                    ? "border-[#1A3226] bg-[#1A3226]"
                    : "border-[#1A3226]/30"
                }`}
              />
            </div>
          </button>
        ))}
      </div>

      <WizardNav onNext={onNext} onBack={onBack} nextDisabled={!canProceed} />
    </div>
  );
}