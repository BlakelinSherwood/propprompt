import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink, Clock } from "lucide-react";
import ExportPanel from "../components/ExportPanel";

const PLATFORM_LABELS = { claude: "Claude", chatgpt: "ChatGPT", gemini: "Gemini", perplexity: "Perplexity", grok: "Grok" };
const ASSESSMENT_LABELS = {
  listing_pricing: "Listing Pricing Analysis",
  buyer_intelligence: "Buyer Intelligence Report",
  investment_analysis: "Investment Analysis",
  cma: "Comparative Market Analysis",
  rental_analysis: "Rental Analysis",
};
const FORMAT_LABELS = { narrative: "Narrative", structured: "Structured", bullets: "Bullet Points" };
const STATUS_STYLES = {
  draft: "bg-gray-100 text-gray-600",
  in_progress: "bg-yellow-50 text-yellow-700",
  complete: "bg-emerald-50 text-emerald-700",
  failed: "bg-red-50 text-red-600",
  archived: "bg-gray-50 text-gray-400",
};

export default function AnalysisDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState(null);
  const [orgPlan, setOrgPlan] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const records = await base44.entities.Analysis.filter({ id });
      const rec = records[0];
      setAnalysis(rec || null);

      // Determine org plan for tier gating
      const me = await base44.auth.me().catch(() => null);
      if (me) {
        const memberships = await base44.entities.OrgMembership.filter({ user_email: me.email, status: "active" });
        if (memberships.length > 0) {
          const orgs = await base44.entities.Organization.filter({ id: memberships[0].org_id });
          setOrgPlan(orgs[0]?.subscription_plan || null);
        }
      }
      setLoading(false);
    }
    if (id) load();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="w-7 h-7 border-4 border-[#1A3226]/20 border-t-[#1A3226] rounded-full animate-spin" />
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="text-center py-16">
        <p className="text-[#1A3226]/50 mb-4">Analysis not found.</p>
        <Link to="/Analyses" className="text-[#1A3226] underline text-sm">Back to Analyses</Link>
      </div>
    );
  }

  const address = analysis.intake_data?.address;
  const isComplete = analysis.status === "complete";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back */}
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="text-[#1A3226]/60 hover:text-[#1A3226] -ml-2">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back
      </Button>

      {/* Header card */}
      <div className="rounded-2xl border border-[#1A3226]/10 bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-[#1A3226]">
              {ASSESSMENT_LABELS[analysis.assessment_type] || analysis.assessment_type}
            </h1>
            {address && (
              <p className="text-sm text-[#1A3226]/60 mt-1">{address}</p>
            )}
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${STATUS_STYLES[analysis.status] || "bg-gray-100 text-gray-600"}`}>
            {analysis.status}
          </span>
        </div>

        {/* Metadata grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-5 pt-5 border-t border-[#1A3226]/8">
          {[
            ["AI Platform", PLATFORM_LABELS[analysis.ai_platform] || analysis.ai_platform],
            ["Property Type", analysis.property_type?.replace(/_/g, " ")],
            ["Output Format", FORMAT_LABELS[analysis.output_format] || analysis.output_format],
            ["Location Class", analysis.location_class?.replace(/_/g, " ")],
            ["Created", analysis.created_date ? new Date(analysis.created_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"],
            analysis.completed_at && ["Completed", new Date(analysis.completed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })],
          ].filter(Boolean).map(([label, value]) => (
            <div key={label}>
              <p className="text-[10px] uppercase tracking-wider text-[#1A3226]/40 mb-0.5">{label}</p>
              <p className="text-sm text-[#1A3226] capitalize">{value || "—"}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Run / View output */}
      {!isComplete ? (
        <div className="rounded-xl border border-[#B8982F]/30 bg-[#B8982F]/5 p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[#1A3226]">Ready to run this analysis</p>
            <p className="text-xs text-[#1A3226]/50 mt-0.5">
              This will use <strong>{PLATFORM_LABELS[analysis.ai_platform]}</strong> to generate your report.
            </p>
          </div>
          <Button
            onClick={() => navigate(`/AnalysisRun?id=${analysis.id}&orgId=${analysis.org_id}`)}
            className="flex-shrink-0 bg-[#1A3226] text-white hover:bg-[#1A3226]/90"
          >
            Run Analysis →
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Clock className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <p className="text-sm text-emerald-700 font-medium">Analysis complete</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/AnalysisRun?id=${analysis.id}&orgId=${analysis.org_id}`)}
            className="flex-shrink-0 border-emerald-300 text-emerald-700 hover:bg-emerald-100 gap-1"
          >
            View Output <ExternalLink className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {/* Export panel — only when complete */}
      {isComplete && (
        <ExportPanel analysis={analysis} orgPlan={orgPlan} />
      )}

      {/* Prompt assembly guidance (for manual copy mode) */}
      {analysis.ai_platform && !isComplete && (
        <div className="rounded-xl border border-[#1A3226]/10 bg-white p-5">
          <h3 className="text-sm font-semibold text-[#1A3226] mb-2">How to run this analysis manually</h3>
          <ol className="space-y-2 text-sm text-[#1A3226]/70 list-decimal list-inside">
            <li>Click "Run Analysis" above to open the analysis runner.</li>
            <li>Copy the assembled prompt from the runner page.</li>
            <li>Paste it into <strong>{PLATFORM_LABELS[analysis.ai_platform]}</strong> and run.</li>
            <li>Paste the AI response back into PropPrompt to save and export your report.</li>
          </ol>
        </div>
      )}
    </div>
  );
}