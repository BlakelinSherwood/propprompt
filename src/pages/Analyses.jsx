import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Plus, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

const STATUS_STYLES = {
  draft: "bg-[#1A3226]/8 text-[#1A3226]/60",
  in_progress: "bg-amber-50 text-amber-600",
  complete: "bg-emerald-50 text-emerald-700",
  failed: "bg-red-50 text-red-600",
  archived: "bg-gray-100 text-gray-400",
};

const TYPE_LABELS = {
  listing_pricing: "Listing Pricing",
  buyer_intelligence: "Buyer Intelligence",
  investment_analysis: "Investment Analysis",
  cma: "CMA",
  rental_analysis: "Rental Analysis",
  listing_strategy: "Listing Strategy",
};

export default function Analyses() {
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.Analysis.list("-created_date", 50)
      .then(setAnalyses)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[#1A3226]/20 border-t-[#1A3226] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#1A3226]" style={{ fontFamily: "Georgia, serif" }}>
            Analyses
          </h1>
          <p className="text-sm text-[#1A3226]/50 mt-0.5">{analyses.length} total</p>
        </div>
        <Link to="/NewAnalysis">
          <Button className="bg-[#1A3226] hover:bg-[#1A3226]/90 text-white gap-2">
            <Plus className="w-4 h-4" />
            New Analysis
          </Button>
        </Link>
      </div>

      {analyses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#1A3226]/15 bg-white p-16 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#1A3226]/5 flex items-center justify-center mb-4">
            <FileText className="w-7 h-7 text-[#1A3226]/25" />
          </div>
          <p className="text-sm font-medium text-[#1A3226]/50 mb-1">No analyses yet</p>
          <p className="text-xs text-[#1A3226]/30 mb-5">Run your first PropPrompt analysis to get started.</p>
          <Link to="/NewAnalysis">
            <Button className="bg-[#1A3226] hover:bg-[#1A3226]/90 text-white gap-2 text-sm">
              <Plus className="w-4 h-4" />
              New Analysis
            </Button>
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border border-[#1A3226]/10 bg-white overflow-hidden">
          {analyses.map((a, i) => (
            <div
              key={a.id}
              className={`flex items-center gap-4 px-5 py-4 hover:bg-[#FAF8F4]/50 transition-colors ${i !== analyses.length - 1 ? "border-b border-[#1A3226]/5" : ""}`}
            >
              <div className="w-9 h-9 rounded-lg bg-[#1A3226]/5 flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-[#1A3226]/40" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#1A3226] truncate">
                  {a.intake_data?.address || "Untitled Analysis"}
                </p>
                <p className="text-xs text-[#1A3226]/40 mt-0.5">
                  {TYPE_LABELS[a.assessment_type] || a.assessment_type} · {a.ai_platform} ·{" "}
                  {new Date(a.created_date).toLocaleDateString()}
                </p>
              </div>
              <span
                className={`text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full font-semibold flex-shrink-0 ${STATUS_STYLES[a.status] || STATUS_STYLES.draft}`}
              >
                {a.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}