import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import ExportPanel from "../components/ExportPanel";

const LABELS = {
  ai_platform: { claude: "Claude", chatgpt: "ChatGPT", gemini: "Gemini", perplexity: "Perplexity", grok: "Grok" },
  assessment_type: {
    listing_pricing: "Listing Pricing Analysis",
    buyer_intelligence: "Buyer Intelligence Report",
    investment_analysis: "Investment Analysis",
    cma: "CMA",
    rental_analysis: "Rental Market Analysis",
    custom: "Custom",
  },
  output_format: { narrative: "Narrative", structured: "Structured", bullets: "Bullets" },
};

const STATUS_CONFIG = {
  draft:       { label: "Draft",       icon: Clock,         className: "bg-amber-50 text-amber-700" },
  in_progress: { label: "In Progress", icon: Clock,         className: "bg-blue-50 text-blue-700" },
  complete:    { label: "Complete",    icon: CheckCircle,   className: "bg-emerald-50 text-emerald-700" },
  failed:      { label: "Failed",      icon: AlertCircle,   className: "bg-red-50 text-red-700" },
  archived:    { label: "Archived",    icon: Clock,         className: "bg-gray-50 text-gray-500" },
};

export default function AnalysisDetail() {
  const { id } = useParams();
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadAnalysis = useCallback(() => {
    base44.entities.Analysis.filter({ id }).then((r) => {
      setAnalysis(r[0] || null);
      setLoading(false);
    });
  }, [id]);

  useEffect(() => { loadAnalysis(); }, [loadAnalysis]);

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

  const statusCfg = STATUS_CONFIG[analysis.status] || STATUS_CONFIG.draft;
  const StatusIcon = statusCfg.icon;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link to="/Analyses">
          <Button variant="ghost" size="sm" className="text-[#1A3226]/50 hover:text-[#1A3226] gap-1">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
        </Link>
      </div>

      {/* Main info card */}
      <div className="rounded-2xl border border-[#1A3226]/10 bg-white p-6 lg:p-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-[#B8982F] text-xs font-medium uppercase tracking-widest mb-1">Analysis</p>
            <h1 className="text-xl font-semibold text-[#1A3226]" style={{ fontFamily: "Georgia, serif" }}>
              {LABELS.assessment_type[analysis.assessment_type] || analysis.assessment_type}
            </h1>
            <p className="text-sm text-[#1A3226]/50 mt-1">{analysis.intake_data?.address}</p>
          </div>
          <span className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${statusCfg.className}`}>
            <StatusIcon className="w-3 h-3" />
            {statusCfg.label}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
          {[
            { label: "Platform",      value: LABELS.ai_platform[analysis.ai_platform] },
            { label: "Model",         value: analysis.ai_model || "—" },
            { label: "Format",        value: LABELS.output_format[analysis.output_format] },
            { label: "Property Type", value: analysis.property_type?.replace(/_/g, " ") },
            { label: "Location Class",value: analysis.location_class?.replace(/_/g, " ") },
            { label: "Client Role",   value: analysis.intake_data?.client_relationship?.replace(/_/g, " ") || "—" },
          ].map((item) => (
            <div key={item.label} className="rounded-xl bg-[#FAF8F4] p-3">
              <p className="text-[10px] text-[#1A3226]/40 uppercase tracking-wider mb-1">{item.label}</p>
              <p className="text-sm font-medium text-[#1A3226] capitalize">{item.value}</p>
            </div>
          ))}
        </div>

        {analysis.status !== "complete" && (
          <div className="rounded-xl border border-[#B8982F]/30 bg-[#B8982F]/5 p-5">
            <p className="text-sm font-medium text-[#1A3226] mb-2">Next Step: Run Your Analysis</p>
            <p className="text-xs text-[#1A3226]/60 leading-relaxed">
              Your intake has been saved. Use the{" "}
              <Link to={`/AnalysisRun?id=${analysis.id}`} className="text-[#B8982F] font-medium underline">
                Analysis Run
              </Link>{" "}
              page to generate your AI-powered report.
            </p>
          </div>
        )}
      </div>

      {/* Export panel — shown once analysis exists */}
      <ExportPanel analysis={analysis} onExported={loadAnalysis} />
    </div>
  );
}