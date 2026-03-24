import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Key, Layers, BarChart2, BookOpen } from "lucide-react";

export default function PlatformAIConfig() {
  const navigate = useNavigate();

  const sections = [
    {
      icon: Key,
      title: "API Keys & Providers",
      description: "Add or update API keys for Claude, ChatGPT, Gemini, Perplexity, and Grok. Test connections and select models.",
      tab: "keys",
    },
    {
      icon: Layers,
      title: "Ensemble AI Pipeline",
      description: "Configure multi-step AI ensemble mode, section assignments, and fallback providers.",
      tab: "ensemble",
    },
    {
      icon: BarChart2,
      title: "Usage Stats",
      description: "View token usage and analysis counts per provider.",
      tab: "usage",
    },
    {
      icon: BookOpen,
      title: "Model Reference",
      description: "Token pricing, cost estimator, use-case guidance, and right-model-for-the-job recommendations.",
      tab: "reference",
    },
  ];

  return (
    <div className="space-y-4 max-w-2xl">
      <p className="text-sm text-[#1A3226]/60">
        All AI configuration has moved to the dedicated AI Settings page.
      </p>
      <div className="grid gap-3">
        {sections.map(({ icon: Icon, title, description, tab }) => (
          <button
            key={tab}
            onClick={() => navigate(`/admin/ai-settings`)}
            className="flex items-start gap-4 rounded-xl border border-[#1A3226]/10 bg-white p-5 text-left hover:border-[#1A3226]/30 hover:shadow-sm transition-all group"
          >
            <div className="mt-0.5 w-9 h-9 rounded-lg bg-[#1A3226]/5 flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4 text-[#1A3226]/60" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-[#1A3226] text-sm">{title}</div>
              <div className="text-xs text-[#1A3226]/50 mt-0.5">{description}</div>
            </div>
            <ArrowRight className="w-4 h-4 text-[#1A3226]/30 group-hover:text-[#1A3226]/60 mt-1 transition-colors" />
          </button>
        ))}
      </div>
      <Button
        className="bg-[#1A3226] text-white hover:bg-[#1A3226]/90 gap-2"
        onClick={() => navigate("/admin/ai-settings")}
      >
        Open AI Settings <ArrowRight className="w-4 h-4" />
      </Button>
    </div>
  );
}