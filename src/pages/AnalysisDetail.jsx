import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, Clock, Copy, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

const LABELS = {
  ai_platform: { claude: "Claude", chatgpt: "ChatGPT", gemini: "Gemini", perplexity: "Perplexity", grok: "Grok" },
  assessment_type: { listing_pricing: "Listing Pricing Analysis", buyer_intelligence: "Buyer Intelligence Report", investment_analysis: "Investment Analysis", cma: "CMA", rental_analysis: "Rental Market Analysis", custom: "Custom" },
  output_format: { narrative: "Narrative", structured: "Structured", bullets: "Bullets" },
};

export default function AnalysisDetail() {
  const { id } = useParams();
  const [analysis, setAnalysis] = useState(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.Analysis.filter({ id }).then((r) => {
      setAnalysis(r[0] || null);
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[#1A3226]/20 border-t-[#1A3226] rounded-full animate-spin" />
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="text-center py-20 text-[#1A3226]/40">
        Analysis not found.{" "}
        <Link to="/Dashboard" className="text-[#B8982F] underline">Go home</Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/Dashboard">
          <Button variant="ghost" size="sm" className="text-[#1A3226]/50 hover:text-[#1A3226] gap-1">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
        </Link>
      </div>

      <div className="rounded-2xl border border-[#1A3226]/10 bg-white p-6 lg:p-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-[#B8982F] text-xs font-medium uppercase tracking-widest mb-1">Analysis</p>
            <h1 className="text-xl font-semibold text-[#1A3226]" style={{ fontFamily: "Georgia, serif" }}>
              {LABELS.assessment_type[analysis.assessment_type] || analysis.assessment_type}
            </h1>
            <p className="text-sm text-[#1A3226]/50 mt-1">{analysis.intake_data?.address}</p>
          </div>
          <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-medium">
            <Clock className="w-3 h-3" /> Draft
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
          {[
            { label: "Platform", value: LABELS.ai_platform[analysis.ai_platform] },
            { label: "Model", value: analysis.ai_model || "—" },
            { label: "Format", value: LABELS.output_format[analysis.output_format] },
            { label: "Property Type", value: analysis.property_type?.replace("_", " ") },
            { label: "Location Class", value: analysis.location_class?.replace("_", " ") },
            { label: "Client Role", value: analysis.intake_data?.client_relationship?.replace("_", " ") || "—" },
          ].map((item) => (
            <div key={item.label} className="rounded-xl bg-[#FAF8F4] p-3">
              <p className="text-[10px] text-[#1A3226]/40 uppercase tracking-wider mb-1">{item.label}</p>
              <p className="text-sm font-medium text-[#1A3226] capitalize">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-[#B8982F]/30 bg-[#B8982F]/5 p-5">
          <p className="text-sm font-medium text-[#1A3226] mb-2">Next Step: Run Your Analysis</p>
          <p className="text-xs text-[#1A3226]/60 leading-relaxed">
            Your intake has been saved. The PropPrompt prompt assembly engine will generate your calibrated prompt in the next release.
            In the current version, use the PropPrompt™ Master Prompt Library v3.0 to manually assemble your prompt for{" "}
            <span className="font-medium capitalize">{LABELS.ai_platform[analysis.ai_platform]}</span>.
          </p>
        </div>
      </div>
    </div>
  );
}