import { useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronRight } from "lucide-react";

// Pricing as of early 2025 — update when providers change rates
const PROVIDERS = [
  {
    id: "anthropic",
    name: "Anthropic",
    subtitle: "Claude",
    color: "#CC785C",
    models: [
      {
        name: "claude-opus-4-5",
        tier: "flagship",
        inputPer1M: 15.00,
        outputPer1M: 75.00,
        contextK: 200,
        speed: "Slow",
        quality: "Highest",
        sweet_spot: "Full listing pricing reports, investment analysis, complex multi-property CMAs",
        avoid: "Simple summaries, short outputs, high-volume batch tasks",
        propPromptUse: "Use only for Broker-tier flagship reports where output quality justifies cost.",
        costAlert: "high",
      },
      {
        name: "claude-sonnet-4-20250514",
        tier: "balanced",
        inputPer1M: 3.00,
        outputPer1M: 15.00,
        contextK: 200,
        speed: "Fast",
        quality: "Excellent",
        sweet_spot: "Most PropPrompt analysis types — listing pricing, buyer intelligence, narrative layers",
        avoid: "Ultra-high volume tasks where cost is the primary constraint",
        propPromptUse: "Default choice for Pro/Team tier. Best balance of quality and cost.",
        costAlert: "good",
      },
      {
        name: "claude-haiku-4-5-20251001",
        tier: "fast",
        inputPer1M: 0.80,
        outputPer1M: 4.00,
        contextK: 200,
        speed: "Very Fast",
        quality: "Good",
        sweet_spot: "Follow-up questions, short structured outputs, classification tasks",
        avoid: "Full report assembly, narrative writing, complex reasoning chains",
        propPromptUse: "Good for Starter-tier short outputs or rapid intake parsing — not full reports.",
        costAlert: "best",
      },
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    subtitle: "ChatGPT",
    color: "#10A37F",
    models: [
      {
        name: "gpt-4o",
        tier: "flagship",
        inputPer1M: 2.50,
        outputPer1M: 10.00,
        contextK: 128,
        speed: "Fast",
        quality: "Excellent",
        sweet_spot: "Seller presentations, persuasive copy, listing descriptions, structured JSON output",
        avoid: "Very long context documents (>100K tokens)",
        propPromptUse: "Default OpenAI choice. Strong for narrative and structured output tasks.",
        costAlert: "good",
      },
      {
        name: "gpt-4o-mini",
        tier: "fast",
        inputPer1M: 0.15,
        outputPer1M: 0.60,
        contextK: 128,
        speed: "Very Fast",
        quality: "Good",
        sweet_spot: "High-volume classification, short outputs, routing decisions",
        avoid: "Complex analytical reasoning, nuanced narrative writing",
        propPromptUse: "Excellent for Starter-tier tasks or ensemble routing logic. Very cost-effective.",
        costAlert: "best",
      },
      {
        name: "o3-mini",
        tier: "reasoning",
        inputPer1M: 1.10,
        outputPer1M: 4.40,
        contextK: 200,
        speed: "Moderate",
        quality: "High (Reasoning)",
        sweet_spot: "Investment ROI calculations, net sheet math, multi-step logical chains",
        avoid: "Creative writing, narrative output, fast-turnaround requests",
        propPromptUse: "Specialised use: net sheet and financial analysis sections only.",
        costAlert: "good",
      },
    ],
  },
  {
    id: "google",
    name: "Google",
    subtitle: "Gemini",
    color: "#4285F4",
    models: [
      {
        name: "gemini-2.5-pro",
        tier: "flagship",
        inputPer1M: 1.25,
        outputPer1M: 10.00,
        contextK: 1000,
        speed: "Moderate",
        quality: "Excellent",
        sweet_spot: "Real-time market data synthesis, very long documents, neighbourhood research",
        avoid: "Cost-sensitive batch processing",
        propPromptUse: "Best for deep market context tasks. 1M token window is a unique advantage.",
        costAlert: "good",
      },
      {
        name: "gemini-2.5-flash",
        tier: "balanced",
        inputPer1M: 0.15,
        outputPer1M: 0.60,
        contextK: 1000,
        speed: "Very Fast",
        quality: "Very Good",
        sweet_spot: "Neighbourhood snapshots, live market conditions, high-volume structured output",
        avoid: "Tasks requiring deepest possible reasoning",
        propPromptUse: "Recommended default. Excellent value — fast, large context, low cost.",
        costAlert: "best",
      },
      {
        name: "gemini-2.0-flash-lite",
        tier: "fast",
        inputPer1M: 0.075,
        outputPer1M: 0.30,
        contextK: 1000,
        speed: "Fastest",
        quality: "Good",
        sweet_spot: "Rapid classification, simple data extraction, high-volume cheap tasks",
        avoid: "Nuanced analysis or multi-step reasoning",
        propPromptUse: "Ultra-budget option for Starter tier simple tasks only.",
        costAlert: "best",
      },
    ],
  },
  {
    id: "perplexity",
    name: "Perplexity",
    subtitle: "Perplexity AI",
    color: "#20808D",
    models: [
      {
        name: "sonar-pro",
        tier: "flagship",
        inputPer1M: 3.00,
        outputPer1M: 15.00,
        contextK: 200,
        speed: "Moderate",
        quality: "Excellent (Web-grounded)",
        sweet_spot: "Live market data, migration trends, current interest rates, recent sold comps context",
        avoid: "Tasks where web search isn't needed — you're paying for grounding",
        propPromptUse: "Best-in-class for live market signals. Use for market research section of ensemble.",
        costAlert: "good",
      },
      {
        name: "sonar",
        tier: "fast",
        inputPer1M: 1.00,
        outputPer1M: 1.00,
        contextK: 128,
        speed: "Fast",
        quality: "Good (Web-grounded)",
        sweet_spot: "Quick market lookups, neighbourhood stats, recent news context",
        avoid: "Deep analysis or very long output",
        propPromptUse: "Budget web-grounded option for lighter research tasks.",
        costAlert: "good",
      },
    ],
  },
  {
    id: "xai",
    name: "xAI",
    subtitle: "Grok",
    color: "#1DA1F2",
    models: [
      {
        name: "grok-3",
        tier: "flagship",
        inputPer1M: 3.00,
        outputPer1M: 15.00,
        contextK: 131,
        speed: "Fast",
        quality: "Excellent",
        sweet_spot: "Agent talking points, buyer archetypes, conversational persuasive content",
        avoid: "Deep quantitative analysis, financial calculations",
        propPromptUse: "Strong for buyer archetype and narrative tone sections. Best xAI model.",
        costAlert: "good",
      },
      {
        name: "grok-3-mini",
        tier: "fast",
        inputPer1M: 0.30,
        outputPer1M: 0.50,
        contextK: 131,
        speed: "Very Fast",
        quality: "Good",
        sweet_spot: "Short conversational outputs, quick archetype summaries",
        avoid: "Full report assembly, complex reasoning",
        propPromptUse: "Budget option for xAI tasks where grok-3 quality isn't required.",
        costAlert: "best",
      },
    ],
  },
];

const COST_CONFIG = {
  best: { label: "Low Cost", color: "text-green-700", bg: "bg-green-50", border: "border-green-200", icon: CheckCircle2 },
  good: { label: "Moderate", color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", icon: AlertTriangle },
  high: { label: "High Cost", color: "text-red-700", bg: "bg-red-50", border: "border-red-200", icon: XCircle },
};

const TIER_BADGE = {
  flagship: { label: "Flagship", bg: "bg-[#1A3226]/10", color: "text-[#1A3226]" },
  balanced: { label: "Balanced", bg: "bg-[#B8982F]/15", color: "text-[#B8982F]" },
  fast: { label: "Fast / Budget", bg: "bg-blue-50", color: "text-blue-700" },
  reasoning: { label: "Reasoning", bg: "bg-purple-50", color: "text-purple-700" },
};

function CostEstimator({ model }) {
  const [tokens, setTokens] = useState(4000);
  const inputCost = (tokens / 1_000_000) * model.inputPer1M;
  const outputTokens = Math.round(tokens * 0.4);
  const outputCost = (outputTokens / 1_000_000) * model.outputPer1M;
  const total = inputCost + outputCost;

  return (
    <div className="mt-3 bg-[#1A3226]/[0.03] rounded-lg p-3 border border-[#1A3226]/8">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-[#1A3226]/60">Cost Estimator</span>
        <span className="text-xs text-[#1A3226]/40">~40% output ratio</span>
      </div>
      <div className="flex items-center gap-3 mb-2">
        <input
          type="range"
          min={500}
          max={50000}
          step={500}
          value={tokens}
          onChange={e => setTokens(Number(e.target.value))}
          className="flex-1 h-1.5 accent-[#1A3226]"
        />
        <span className="text-xs font-mono text-[#1A3226] w-20 text-right">{tokens.toLocaleString()} tok</span>
      </div>
      <div className="flex gap-4 text-xs">
        <span className="text-[#1A3226]/50">Input: <span className="font-medium text-[#1A3226]">${inputCost.toFixed(4)}</span></span>
        <span className="text-[#1A3226]/50">Output: <span className="font-medium text-[#1A3226]">${outputCost.toFixed(4)}</span></span>
        <span className="text-[#1A3226]/50">Total: <span className="font-semibold text-[#1A3226]">${total.toFixed(4)}</span></span>
      </div>
    </div>
  );
}

function ModelCard({ model, providerColor }) {
  const [expanded, setExpanded] = useState(false);
  const cost = COST_CONFIG[model.costAlert];
  const tier = TIER_BADGE[model.tier];
  const CostIcon = cost.icon;

  return (
    <div className="border border-[#1A3226]/10 rounded-xl bg-white overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full text-left px-5 py-4 hover:bg-[#1A3226]/[0.02] transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <span style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: providerColor, flexShrink: 0, marginTop: 4 }} />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-[#1A3226] font-mono">{model.name}</span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${tier.bg} ${tier.color}`}>{tier.label}</span>
              </div>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${cost.bg} ${cost.color} ${cost.border}`}>
                  <CostIcon className="w-3 h-3" /> {cost.label}
                </span>
                <span className="text-xs text-[#1A3226]/45">Input ${model.inputPer1M.toFixed(2)}/M · Output ${model.outputPer1M.toFixed(2)}/M</span>
                <span className="text-xs text-[#1A3226]/45">Context {model.contextK}K</span>
                <span className="text-xs text-[#1A3226]/45">Speed: {model.speed}</span>
              </div>
            </div>
          </div>
          {expanded ? <ChevronDown className="w-4 h-4 text-[#1A3226]/30 mt-1 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-[#1A3226]/30 mt-1 flex-shrink-0" />}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-[#1A3226]/8 pt-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-green-50 rounded-lg p-3 border border-green-100">
              <p className="text-[10px] uppercase tracking-wide font-semibold text-green-700 mb-1">✓ Use for</p>
              <p className="text-xs text-green-900 leading-relaxed">{model.sweet_spot}</p>
            </div>
            <div className="bg-red-50 rounded-lg p-3 border border-red-100">
              <p className="text-[10px] uppercase tracking-wide font-semibold text-red-600 mb-1">✗ Avoid for</p>
              <p className="text-xs text-red-900 leading-relaxed">{model.avoid}</p>
            </div>
          </div>
          <div className="bg-[#B8982F]/8 rounded-lg p-3 border border-[#B8982F]/20">
            <p className="text-[10px] uppercase tracking-wide font-semibold text-[#B8982F] mb-1">PropPrompt Recommendation</p>
            <p className="text-xs text-[#1A3226]/80 leading-relaxed">{model.propPromptUse}</p>
          </div>
          <CostEstimator model={model} />
        </div>
      )}
    </div>
  );
}

export default function ModelReferenceTab() {
  const [openProvider, setOpenProvider] = useState("anthropic");

  return (
    <div className="space-y-5">
      {/* Header note */}
      <div className="bg-[#1A3226]/[0.04] border border-[#1A3226]/10 rounded-xl p-4">
        <p className="text-sm text-[#1A3226]/70 leading-relaxed">
          Pricing is per <strong>1 million tokens</strong> (input + output billed separately). A typical PropPrompt analysis uses <strong>2,000–8,000 input tokens</strong> and <strong>800–3,000 output tokens</strong>. Use the slider in each model card to estimate cost for your average report size. Prices reflect published rates as of early 2025.
        </p>
      </div>

      {/* Quick comparison legend */}
      <div className="flex gap-3 flex-wrap">
        {Object.entries(COST_CONFIG).map(([key, val]) => {
          const Icon = val.icon;
          return (
            <span key={key} className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border ${val.bg} ${val.color} ${val.border}`}>
              <Icon className="w-3.5 h-3.5" /> {val.label}
            </span>
          );
        })}
        <span className="text-xs text-[#1A3226]/40 self-center ml-2">← click any model card to expand details & cost estimator</span>
      </div>

      {/* Provider sections */}
      {PROVIDERS.map(provider => (
        <div key={provider.id} className="border border-[#1A3226]/10 rounded-xl overflow-hidden">
          <button
            onClick={() => setOpenProvider(v => v === provider.id ? null : provider.id)}
            className="w-full flex items-center justify-between px-5 py-4 bg-white hover:bg-[#1A3226]/[0.02] transition-colors"
          >
            <div className="flex items-center gap-3">
              <span style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: provider.color }} />
              <span className="font-semibold text-[#1A3226]">{provider.name}</span>
              <span className="text-sm text-[#1A3226]/45">· {provider.subtitle}</span>
              <span className="text-xs text-[#1A3226]/35 ml-1">{provider.models.length} models</span>
            </div>
            {openProvider === provider.id
              ? <ChevronDown className="w-4 h-4 text-[#1A3226]/30" />
              : <ChevronRight className="w-4 h-4 text-[#1A3226]/30" />
            }
          </button>

          {openProvider === provider.id && (
            <div className="border-t border-[#1A3226]/8 p-4 space-y-3 bg-[#1A3226]/[0.01]">
              {provider.models.map(model => (
                <ModelCard key={model.name} model={model} providerColor={provider.color} />
              ))}
            </div>
          )}
        </div>
      ))}

      <p className="text-xs text-[#1A3226]/30 text-center pb-2">
        Prices sourced from official provider documentation. Always verify current rates at each provider's pricing page before making routing decisions.
      </p>
    </div>
  );
}