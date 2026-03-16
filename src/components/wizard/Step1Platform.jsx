import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import WizardNav from "./WizardNav";

const PLATFORMS = [
  {
    id: "claude",
    name: "Claude",
    maker: "Anthropic",
    badge: "Recommended",
    badgeColor: "bg-[#B8982F]/20 text-[#B8982F]",
    description: "Best narrative depth, nested logic, and PPTX generation. PropPrompt's primary platform.",
    models: ["claude-opus-4", "claude-sonnet-4", "claude-haiku-3"],
    tier: "free",
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    maker: "OpenAI",
    badge: "Agent+",
    badgeColor: "bg-emerald-50 text-emerald-700",
    description: "Strong structured output and code interpreter for financial tables.",
    models: ["gpt-4o", "gpt-4o-mini", "o3"],
    tier: "agent",
  },
  {
    id: "gemini",
    name: "Gemini",
    maker: "Google",
    badge: "Agent+",
    badgeColor: "bg-emerald-50 text-emerald-700",
    description: "Excellent with large-context documents and web-grounded research.",
    models: ["gemini-2.0-pro", "gemini-2.0-flash"],
    tier: "agent",
  },
  {
    id: "perplexity",
    name: "Perplexity",
    maker: "Perplexity AI",
    badge: "Team+",
    badgeColor: "bg-blue-50 text-blue-600",
    description: "Real-time web search. Best for live market data and MLS context. 3-message protocol.",
    models: ["sonar-pro", "sonar"],
    tier: "team",
  },
  {
    id: "grok",
    name: "Grok",
    maker: "xAI",
    badge: "Team+",
    badgeColor: "bg-blue-50 text-blue-600",
    description: "Strong financial reasoning and real-time X/social sentiment data.",
    models: ["grok-3", "grok-3-mini"],
    tier: "team",
  },
];

const TIER_ORDER = ["free", "agent", "team", "brokerage", "platform_owner"];

function tierAllows(userPlan, requiredTier) {
  return TIER_ORDER.indexOf(userPlan || "free") >= TIER_ORDER.indexOf(requiredTier);
}

export default function Step1Platform({ intake, update, user, onNext }) {
  const userPlan = user?.subscription_plan || "free";

  return (
    <div className="p-6 lg:p-8">
      <h2 className="text-lg font-semibold text-[#1A3226] mb-1" style={{ fontFamily: "Georgia, serif" }}>
        Select AI Platform
      </h2>
      <p className="text-sm text-[#1A3226]/50 mb-6">
        Choose the AI platform for this analysis. Each is calibrated with a dedicated prompt version.
      </p>

      <div className="space-y-3 mb-8">
        {PLATFORMS.map((p) => {
          const unlocked = tierAllows(userPlan, p.tier);
          const selected = intake.ai_platform === p.id;

          return (
            <button
              key={p.id}
              disabled={!unlocked}
              onClick={() => update({ ai_platform: p.id, ai_model: p.models[0] })}
              className={`w-full text-left rounded-xl border-2 p-4 transition-all
                ${selected ? "border-[#B8982F] bg-[#B8982F]/5" : "border-[#1A3226]/10 hover:border-[#1A3226]/25"}
                ${!unlocked ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-[#1A3226]">{p.name}</span>
                    <span className="text-xs text-[#1A3226]/40">{p.maker}</span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${p.badgeColor}`}>
                      {p.badge}
                    </span>
                    {!unlocked && (
                      <span className="flex items-center gap-1 text-[10px] text-[#1A3226]/40">
                        <Lock className="w-3 h-3" /> Upgrade required
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#1A3226]/60">{p.description}</p>
                </div>
                <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5
                  ${selected ? "border-[#B8982F] bg-[#B8982F]" : "border-[#1A3226]/20"}`} />
              </div>

              {selected && unlocked && (
                <div className="mt-3 pt-3 border-t border-[#B8982F]/20">
                  <p className="text-xs text-[#1A3226]/50 mb-2">Model:</p>
                  <div className="flex flex-wrap gap-2">
                    {p.models.map((m) => (
                      <button
                        key={m}
                        onClick={(e) => { e.stopPropagation(); update({ ai_model: m }); }}
                        className={`text-xs px-2.5 py-1 rounded-lg border transition-colors
                          ${intake.ai_model === m
                            ? "border-[#B8982F] bg-[#B8982F]/10 text-[#B8982F] font-medium"
                            : "border-[#1A3226]/15 text-[#1A3226]/60 hover:border-[#1A3226]/30"}`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      <WizardNav step={1} onNext={onNext} canNext={!!intake.ai_platform} />
    </div>
  );
}